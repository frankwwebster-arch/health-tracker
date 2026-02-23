import { get, set, del, createStore, keys } from "idb-keyval";
import type { DayData, Settings, MedicationEntry } from "@/types";
import {
  createEmptyDayData,
  getDateKey,
  DEFAULT_SETTINGS,
} from "@/types";

const DAYS_STORE = "health-days";
const SETTINGS_KEY = "health-settings";
const LAST_NOTIFIED_KEY = "health-last-notified";
const SYNC_META_KEY = "health-sync-meta"; // { [dateKey]: updatedAt }
const LAST_SYNC_KEY = "health-last-sync";
const MIGRATION_OFFERED_KEY = "health-migration-offered";

const daysStore = createStore("health-tracker-db", DAYS_STORE);

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

  // Migrate old workoutDone to workoutMinutes
  const raw = result as unknown as Record<string, unknown>;
  if ("workoutDone" in raw && typeof raw.workoutDone === "boolean") {
    const { workoutDone, ...rest } = raw;
    result = { ...rest, workoutMinutes: workoutDone ? 30 : null } as DayData;
  }

  // Ensure lunchFoods exists for old data
  if (!Array.isArray((result as unknown as Record<string, unknown>).lunchFoods)) {
    result = { ...result, lunchFoods: [] } as DayData;
  }

  // Ensure snackFoods exists for old data
  if (!Array.isArray((result as unknown as Record<string, unknown>).snackFoods)) {
    result = { ...result, snackFoods: [] } as DayData;
  }

  return result;
}

export async function getDayData(dateKey: string): Promise<DayData> {
  const data = await get<DayData>(dateKey, daysStore);
  if (!data) return createEmptyDayData();
  return migrateDayData(data);
}

export async function setDayData(dateKey: string, data: DayData): Promise<void> {
  await set(dateKey, data, daysStore);
  const meta = (await get<Record<string, number>>(SYNC_META_KEY, daysStore)) ?? {};
  meta[dateKey] = Date.now();
  await set(SYNC_META_KEY, meta, daysStore);
}

function migrateSettings(s: Settings): Settings {
  const def = DEFAULT_SETTINGS;
  const times = s.medicationTimes as Record<string, unknown>;
  if (times?.dex1 && !Array.isArray(times?.dex)) {
    return {
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
    };
  }
  return { ...def, ...s };
}

export async function getSettings(): Promise<Settings> {
  const s = await get<Settings>(SETTINGS_KEY);
  return s ? migrateSettings(s) : { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Settings): Promise<void> {
  await set(SETTINGS_KEY, settings);
}

export async function getLastNotified(dateKey: string): Promise<Record<string, number>> {
  const key = `${LAST_NOTIFIED_KEY}-${dateKey}`;
  const data = await get<Record<string, number>>(key);
  return data ?? {};
}

export async function setLastNotified(
  dateKey: string,
  reminderId: string,
  timestamp: number
): Promise<void> {
  const key = `${LAST_NOTIFIED_KEY}-${dateKey}`;
  const current = await getLastNotified(dateKey);
  await set(key, { ...current, [reminderId]: timestamp });
}

export async function getAllDayKeys(): Promise<string[]> {
  const allKeys = await keys(daysStore);
  return allKeys.filter((k): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k));
}

export async function resetToday(): Promise<void> {
  const todayKey = getDateKey();
  await setDayData(todayKey, createEmptyDayData());
  await del(`${LAST_NOTIFIED_KEY}-${todayKey}`);
}

export async function getLocalUpdatedAt(dateKey: string): Promise<number | null> {
  const meta = (await get<Record<string, number>>(SYNC_META_KEY, daysStore)) ?? {};
  return meta[dateKey] ?? null;
}

export async function setDayDataFromSync(dateKey: string, data: DayData, updatedAt: number): Promise<void> {
  await set(dateKey, data, daysStore);
  const meta = (await get<Record<string, number>>(SYNC_META_KEY, daysStore)) ?? {};
  meta[dateKey] = updatedAt;
  await set(SYNC_META_KEY, meta, daysStore);
}

export async function getLastSyncTime(): Promise<number | null> {
  return await get<number>(LAST_SYNC_KEY, daysStore) ?? null;
}

export async function setLastSyncTime(ts: number): Promise<void> {
  await set(LAST_SYNC_KEY, ts, daysStore);
}

export async function getMigrationOffered(): Promise<boolean> {
  return (await get<boolean>(MIGRATION_OFFERED_KEY, daysStore)) ?? false;
}

export async function setMigrationOffered(): Promise<void> {
  await set(MIGRATION_OFFERED_KEY, true, daysStore);
}
