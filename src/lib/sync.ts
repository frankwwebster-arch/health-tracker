import { createClient } from "@/lib/supabase/client";
import type { DayData } from "@/types";
import {
  getDayData,
  setDayDataFromSync,
  getLocalUpdatedAt,
  getAllDayKeys,
  setLastSyncTime,
  getLastSyncTime,
} from "@/db";
import { getDateKey, getAdjacentDateKey } from "@/types";
import { CAN_SYNC_HEALTH_DATA_TO_CLOUD } from "@/lib/privacy";

const SYNC_DAYS = 60;

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  error?: string;
  /** When cloud sync is disabled, explains why nothing was transferred */
  skipped?: boolean;
}

function isEmptyDay(data: DayData): boolean {
  const d = data;
  const dexTaken = d.medication.dex?.doses?.every((x) => !x.taken) ?? true;
  const bupropionTaken = !d.medication.bupropion?.taken;
  return (
    dexTaken &&
    bupropionTaken &&
    !d.lunchEaten &&
    (d.lunchFoods?.length ?? 0) === 0 &&
    !d.smoothieEaten &&
    (d.smoothieFoods?.length ?? 0) === 0 &&
    !d.snackEaten &&
    (d.snackFoods?.length ?? 0) === 0 &&
    d.waterMl === 0 &&
    d.workoutMinutes == null &&
    !d.walkDone &&
    d.stepsCount == null &&
    d.weightKg == null &&
    !d.bedtime &&
    !d.wakeTime &&
    d.sentimentMorning == null &&
    d.sentimentMidday == null &&
    d.sentimentEvening == null &&
    Object.keys(d.customMedsTaken ?? {}).length === 0 &&
    !d.workoutCoach?.workout &&
    !d.workoutCoach?.postLog &&
    !d.workoutCoach?.preferShort &&
    !d.workoutCoach?.preferLowEnergy &&
    !d.workoutCoach?.golfToday &&
    !d.workoutCoach?.manualBootcampToday &&
    !d.workoutCoach?.swimToday &&
    !d.workoutCoach?.sleepQuality &&
    !d.workoutCoach?.stepLevel
  );
}

export async function pushDay(dateKey: string, data: DayData): Promise<boolean> {
  if (!CAN_SYNC_HEALTH_DATA_TO_CLOUD) return false;

  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("tracker_days").upsert(
    {
      user_id: user.id,
      date: dateKey,
      data: data as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );

  return !error;
}

export async function pullRange(days: number = SYNC_DAYS): Promise<{ date: string; data: DayData; updated_at: string }[]> {
  if (!CAN_SYNC_HEALTH_DATA_TO_CLOUD) return [];

  const supabase = createClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = getDateKey();
  const startKey = getAdjacentDateKey(today, -days + 1);

  const { data: rows, error } = await supabase
    .from("tracker_days")
    .select("date, data, updated_at")
    .eq("user_id", user.id)
    .gte("date", startKey)
    .lte("date", today)
    .order("date", { ascending: false });

  if (error || !rows) return [];
  return rows.map((r) => ({
    date: r.date as string,
    data: r.data as DayData,
    updated_at: r.updated_at as string,
  }));
}

function shouldUseCloud(
  localUpdatedAt: number | null,
  cloudUpdatedAt: string,
  localModifiedThisSession: boolean
): boolean {
  const cloudTs = new Date(cloudUpdatedAt).getTime();
  if (localModifiedThisSession && !localUpdatedAt) return false;
  if (!localUpdatedAt) return true;
  return cloudTs > localUpdatedAt;
}

/** Sync a single specific day — fast, used on date navigation */
export async function syncDay(
  scope: string,
  dateKey: string,
  modifiedThisSession: Set<string> = new Set()
): Promise<SyncResult> {
  if (!CAN_SYNC_HEALTH_DATA_TO_CLOUD) {
    return { success: true, pushed: 0, pulled: 0, skipped: true };
  }

  const supabase = createClient();
  if (!supabase) return { success: false, pushed: 0, pulled: 0, error: "Sync not configured" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, pushed: 0, pulled: 0, error: "Not signed in" };

  let pushed = 0;
  let pulled = 0;

  try {
    const localData = await getDayData(scope, dateKey);
    const localUpdatedAt = await getLocalUpdatedAt(scope, dateKey);

    const cloudRow = await supabase
      .from("tracker_days")
      .select("data, updated_at")
      .eq("user_id", user.id)
      .eq("date", dateKey)
      .maybeSingle();

    const cloudUpdatedAt = cloudRow.data?.updated_at as string | undefined;

    if (!isEmptyDay(localData)) {
      const useLocal = !cloudUpdatedAt || !shouldUseCloud(localUpdatedAt, cloudUpdatedAt, modifiedThisSession.has(dateKey));
      if (useLocal) {
        const ok = await pushDay(dateKey, localData);
        if (ok) pushed++;
      }
    }

    if (cloudUpdatedAt && cloudRow.data?.data) {
      const useCloud = shouldUseCloud(localUpdatedAt, cloudUpdatedAt, modifiedThisSession.has(dateKey));
      const cloudData = cloudRow.data.data as DayData;
      if (useCloud && !isEmptyDay(cloudData)) {
        await setDayDataFromSync(scope, dateKey, cloudData, new Date(cloudUpdatedAt).getTime());
        pulled++;
      }
    }

    return { success: true, pushed, pulled };
  } catch (e) {
    return { success: false, pushed, pulled, error: e instanceof Error ? e.message : "Sync failed" };
  }
}

/** Full sync of last N days — run once on app load */
export async function syncNow(
  scope: string,
  modifiedThisSession: Set<string> = new Set()
): Promise<SyncResult> {
  if (!CAN_SYNC_HEALTH_DATA_TO_CLOUD) {
    return { success: true, pushed: 0, pulled: 0, skipped: true };
  }

  const supabase = createClient();
  if (!supabase) {
    return { success: false, pushed: 0, pulled: 0, error: "Sync not configured" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, pushed: 0, pulled: 0, error: "Not signed in" };
  }

  let pushed = 0;
  let pulled = 0;

  try {
    const today = getDateKey();
    const startKey = getAdjacentDateKey(today, -SYNC_DAYS + 1);
    const localKeys = await getAllDayKeys(scope);
    const keysToPush = localKeys.filter((k) => k >= startKey && k <= today);

    for (const dateKey of keysToPush) {
      const data = await getDayData(scope, dateKey);
      if (isEmptyDay(data)) continue;

      const localUpdatedAt = await getLocalUpdatedAt(scope, dateKey);
      const cloudRows = await supabase
        .from("tracker_days")
        .select("updated_at")
        .eq("user_id", user.id)
        .eq("date", dateKey)
        .maybeSingle();

      const cloudUpdatedAt = cloudRows.data?.updated_at as string | undefined;
      const useLocal =
        !cloudUpdatedAt ||
        !shouldUseCloud(localUpdatedAt, cloudUpdatedAt, modifiedThisSession.has(dateKey));

      if (useLocal) {
        const ok = await pushDay(dateKey, data);
        if (ok) pushed++;
      }
    }

    const cloudRows = await pullRange(SYNC_DAYS);
    for (const { date, data, updated_at } of cloudRows) {
      const localUpdatedAt = await getLocalUpdatedAt(scope, date);
      const useCloud = shouldUseCloud(localUpdatedAt, updated_at, modifiedThisSession.has(date));

      if (useCloud && !isEmptyDay(data)) {
        await setDayDataFromSync(scope, date, data, new Date(updated_at).getTime());
        pulled++;
      }
    }

    await setLastSyncTime(scope, Date.now());
    return { success: true, pushed, pulled };
  } catch (e) {
    return {
      success: false,
      pushed,
      pulled,
      error: e instanceof Error ? e.message : "Sync failed",
    };
  }
}

export async function getLastSync(scope: string): Promise<number | null> {
  return getLastSyncTime(scope);
}
