import { get, set, del, createStore, keys } from "idb-keyval";
import type { DayData, Settings, MedicationEntry } from "@/types";
import {
  createEmptyDayData,
  getDateKey,
  DEFAULT_SETTINGS,
} from "@/types";
import { defaultEnabledModules } from "@/lib/modules/registry";

const DAYS_STORE = "health-days";

/** Anonymous / device-local scope id */
export const LOCAL_STORAGE_SCOPE = "local";

const LEGACY_MIGRATION_FLAG = "__legacy_flat_migrated_v1";
const LOCAL_TO_USER_PREFIX = "__local_copied_to_";

const daysStore = createStore("health-tracker-db", DAYS_STORE);

/** IndexedDB key for a day's JSON blob */
export function dayStorageKey(scope: string, dateKey: string): string {
  return `${scope}:${dateKey}`;
}

export function settingsStorageKey(scope: string): string {
  return `settings:${scope}`;
}

function syncMetaStorageKey(scope: string): string {
  return `${scope}:health-sync-meta`;
}

function lastSyncStorageKey(scope: string): string {
  return `${scope}:health-last-sync`;
}

function migrationOfferedStorageKey(scope: string): string {
  return `${scope}:health-migration-offered`;
}

function lastNotifiedStorageKey(scope: string, dateKey: string): string {
  return `${scope}:health-last-notified`;
}

/** One-time: move legacy unscoped keys into `local` scope. */
export async function migrateLegacyFlatKeysOnce(): Promise<void> {
  const done = await get<boolean>(LEGACY_MIGRATION_FLAG, daysStore);
  if (done) return;

  const allKeys = await keys(daysStore);
  for (const k of allKeys) {
    if (typeof k !== "string") continue;
    if (k === LEGACY_MIGRATION_FLAG) continue;
    if (k.startsWith(`${LOCAL_STORAGE_SCOPE}:`) || k.startsWith("settings:")) continue;

    if (k === "health-settings") {
      const v = await get<Settings>(k, daysStore);
      if (v) await set(settingsStorageKey(LOCAL_STORAGE_SCOPE), v, daysStore);
      await del(k, daysStore);
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
      const v = await get<DayData>(k, daysStore);
      if (v) await set(dayStorageKey(LOCAL_STORAGE_SCOPE, k), v, daysStore);
      await del(k, daysStore);
      continue;
    }
    const legacyCopy = await get(k, daysStore);
    if (legacyCopy !== undefined) {
      await set(`${LOCAL_STORAGE_SCOPE}:${k}`, legacyCopy, daysStore);
      await del(k, daysStore);
    }
  }
  await set(LEGACY_MIGRATION_FLAG, true, daysStore);
}

/**
 * First sign-in on this device: copy `local` dataset into the signed-in user's scope
 * if that scope has no settings yet.
 */
export async function migrateLocalScopeToUserIfNeeded(userId: string): Promise<void> {
  await migrateLegacyFlatKeysOnce();
  const flag = `${LOCAL_TO_USER_PREFIX}${userId}`;
  if (await get<boolean>(flag, daysStore)) return;

  const userSettings = await get<Settings>(settingsStorageKey(userId), daysStore);
  if (userSettings) {
    await set(flag, true, daysStore);
    return;
  }

  const localSettings = await get<Settings>(settingsStorageKey(LOCAL_STORAGE_SCOPE), daysStore);
  if (localSettings) {
    await set(settingsStorageKey(userId), migrateSettings(localSettings), daysStore);
  }

  const allKeys = await keys(daysStore);
  for (const k of allKeys) {
    if (typeof k !== "string") continue;
    if (!k.startsWith(`${LOCAL_STORAGE_SCOPE}:`)) continue;
    const rest = k.slice(LOCAL_STORAGE_SCOPE.length + 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rest)) continue;
    const v = await get<DayData>(k, daysStore);
    if (v) await set(dayStorageKey(userId, rest), v, daysStore);
  }

  await set(flag, true, daysStore);
}

function migrateDayData(data: DayData): DayData {
  const base = createEmptyDayData();
  let result: DayData;

  if ((data.medication as Record<string, unknown>)?.dex1 && !(data.medication as Record<string, unknown>)?.dex) {
    const old = data.medication as unknown as {
      dex1?: MedicationEntry;
      dex2?: MedicationEntry;
      dex3?: MedicationEntry;
      bupropion?: MedicationEntry;
    };
    result = {
      ...base,
      ...data,
      medication: {
        dex: {
          doses: [
            old.dex1 ?? { taken: false, takenAt: null },
            old.dex2 ?? { taken: false, takenAt: null },
            old.dex3 ?? { taken: false, takenAt: null },
          ],
        },
        bupropion: old.bupropion ?? base.medication.bupropion,
      },
    } as DayData;
  } else {
    result = { ...base, ...data } as DayData;
  }

  const raw = result as unknown as Record<string, unknown>;
  if ("workoutDone" in raw && typeof raw.workoutDone === "boolean") {
    const { workoutDone, ...rest } = raw;
    result = { ...rest, workoutMinutes: workoutDone ? 30 : null } as DayData;
  }

  if (!Array.isArray((result as unknown as Record<string, unknown>).lunchFoods)) {
    result = { ...result, lunchFoods: [] } as DayData;
  }
  if (!Array.isArray((result as unknown as Record<string, unknown>).snackFoods)) {
    result = { ...result, snackFoods: [] } as DayData;
  }

  return result;
}

export async function getDayData(scope: string, dateKey: string): Promise<DayData> {
  await migrateLegacyFlatKeysOnce();
  const data = await get<DayData>(dayStorageKey(scope, dateKey), daysStore);
  if (!data) return createEmptyDayData();
  return migrateDayData(data);
}

export async function setDayData(scope: string, dateKey: string, data: DayData): Promise<void> {
  await migrateLegacyFlatKeysOnce();
  await set(dayStorageKey(scope, dateKey), data, daysStore);
  const meta = (await get<Record<string, number>>(syncMetaStorageKey(scope), daysStore)) ?? {};
  meta[dateKey] = Date.now();
  await set(syncMetaStorageKey(scope), meta, daysStore);
}

function migrateSettings(s: Settings): Settings {
  const def = DEFAULT_SETTINGS;
  const times = s.medicationTimes as Record<string, unknown>;
  if (times?.dex1 && !Array.isArray(times?.dex)) {
    return migrateSettings({
      ...def,
      ...s,
      medicationTimes: {
        dex: [String(times.dex1), String(times.dex2 ?? "12:30"), String(times.dex3 ?? "15:30")],
        bupropion: String(times.bupropion ?? def.medicationTimes.bupropion),
      },
      medicationSupply: {
        dex:
          ((s.medicationSupply as Record<string, number>)?.dex1 ?? 0) +
          ((s.medicationSupply as Record<string, number>)?.dex2 ?? 0) +
          ((s.medicationSupply as Record<string, number>)?.dex3 ?? 0),
        bupropion: (s.medicationSupply as Record<string, number>)?.bupropion ?? 0,
      },
      medicationPillsPerDay: {
        dex: 3,
        bupropion: (s.medicationPillsPerDay as Record<string, number>)?.bupropion ?? 1,
      },
    });
  }
  const merged = { ...def, ...s } as Settings;
  if (!Array.isArray(merged.workoutCoachSavedExercises)) {
    merged.workoutCoachSavedExercises = [];
  }
  if (!merged.workoutCoachRotation || typeof merged.workoutCoachRotation !== "object") {
    merged.workoutCoachRotation = { ...def.workoutCoachRotation };
  } else {
    const r = merged.workoutCoachRotation;
    if (!Array.isArray(r.recentBlock1PairIds)) r.recentBlock1PairIds = [];
    if (!Array.isArray(r.recentBlock2PatternIds)) r.recentBlock2PatternIds = [];
    if (!Array.isArray(r.recentBlock3PatternIds)) r.recentBlock3PatternIds = [];
    if (typeof r.gensSinceThruster !== "number") r.gensSinceThruster = def.workoutCoachRotation.gensSinceThruster;
    if (typeof r.generationsSinceLadder !== "number") r.generationsSinceLadder = def.workoutCoachRotation.generationsSinceLadder;
  }
  if (!merged.enabledModules?.length) {
    merged.enabledModules = defaultEnabledModules();
  }
  if (!merged.profile) {
    merged.profile = { displayName: null, email: null };
  }
  if (!merged.userMedications) merged.userMedications = [];
  merged.reminderPreferences = {
    globalEnabled: merged.remindersEnabled,
    weekdayOnly: merged.weekdayOnly,
    ...(merged.reminderPreferences ?? {}),
  };
  if (!merged.appPreferences) merged.appPreferences = {};
  if (merged.settingsVersion == null) merged.settingsVersion = 2;
  return merged;
}

export async function getSettings(scope: string): Promise<Settings> {
  await migrateLegacyFlatKeysOnce();
  const s = await get<Settings>(settingsStorageKey(scope), daysStore);
  return s ? migrateSettings(s) : { ...DEFAULT_SETTINGS };
}

export async function setSettings(scope: string, settings: Settings): Promise<void> {
  await migrateLegacyFlatKeysOnce();
  await set(settingsStorageKey(scope), settings, daysStore);
}

export async function getLastNotified(scope: string, dateKey: string): Promise<Record<string, number>> {
  await migrateLegacyFlatKeysOnce();
  const key = `${lastNotifiedStorageKey(scope, dateKey)}-${dateKey}`;
  const data = await get<Record<string, number>>(key, daysStore);
  return data ?? {};
}

export async function setLastNotified(
  scope: string,
  dateKey: string,
  reminderId: string,
  timestamp: number
): Promise<void> {
  await migrateLegacyFlatKeysOnce();
  const key = `${lastNotifiedStorageKey(scope, dateKey)}-${dateKey}`;
  const current = await getLastNotified(scope, dateKey);
  await set(key, { ...current, [reminderId]: timestamp }, daysStore);
}

export async function getAllDayKeys(scope: string): Promise<string[]> {
  await migrateLegacyFlatKeysOnce();
  const prefix = `${scope}:`;
  const allKeys = await keys(daysStore);
  const out: string[] = [];
  for (const k of allKeys) {
    if (typeof k !== "string") continue;
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rest)) out.push(rest);
  }
  return out.sort();
}

export async function resetToday(scope: string): Promise<void> {
  const todayKey = getDateKey();
  await setDayData(scope, todayKey, createEmptyDayData());
  const lnKey = `${lastNotifiedStorageKey(scope, todayKey)}-${todayKey}`;
  await del(lnKey, daysStore);
}

export async function getLocalUpdatedAt(scope: string, dateKey: string): Promise<number | null> {
  await migrateLegacyFlatKeysOnce();
  const meta = (await get<Record<string, number>>(syncMetaStorageKey(scope), daysStore)) ?? {};
  return meta[dateKey] ?? null;
}

export async function setDayDataFromSync(
  scope: string,
  dateKey: string,
  data: DayData,
  updatedAt: number
): Promise<void> {
  await set(dayStorageKey(scope, dateKey), data, daysStore);
  const meta = (await get<Record<string, number>>(syncMetaStorageKey(scope), daysStore)) ?? {};
  meta[dateKey] = updatedAt;
  await set(syncMetaStorageKey(scope), meta, daysStore);
}

export async function getLastSyncTime(scope: string): Promise<number | null> {
  return (await get<number>(lastSyncStorageKey(scope), daysStore)) ?? null;
}

export async function setLastSyncTime(scope: string, ts: number): Promise<void> {
  await set(lastSyncStorageKey(scope), ts, daysStore);
}

export async function getMigrationOffered(scope: string): Promise<boolean> {
  return (await get<boolean>(migrationOfferedStorageKey(scope), daysStore)) ?? false;
}

export async function setMigrationOffered(scope: string): Promise<void> {
  await set(migrationOfferedStorageKey(scope), true, daysStore);
}
