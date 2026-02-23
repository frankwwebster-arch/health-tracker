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
import { getDateKey, getAdjacentDateKey, createEmptyDayData } from "@/types";

const SYNC_DAYS = 60; // Sync last N days

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  error?: string;
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
    Object.keys(d.customMedsTaken ?? {}).length === 0
  );
}

export async function pushDay(dateKey: string, data: DayData): Promise<boolean> {
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

/** Resolve conflict: keep newer. If local has no updated_at, treat cloud newer unless local modified this session. */
function shouldUseCloud(
  localUpdatedAt: number | null,
  cloudUpdatedAt: string,
  localModifiedThisSession: boolean
): boolean {
  const cloudTs = new Date(cloudUpdatedAt).getTime();
  if (localModifiedThisSession && !localUpdatedAt) return false; // Prefer local
  if (!localUpdatedAt) return true; // No local timestamp, use cloud
  return cloudTs > localUpdatedAt;
}

export async function syncNow(
  modifiedThisSession: Set<string> = new Set()
): Promise<SyncResult> {
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
    const localKeys = await getAllDayKeys();
    const keysToPush = localKeys.filter((k) => k >= startKey && k <= today);

    for (const dateKey of keysToPush) {
      const data = await getDayData(dateKey);
      if (isEmptyDay(data)) continue;

      const localUpdatedAt = await getLocalUpdatedAt(dateKey);
      const cloudRows = await supabase
        .from("tracker_days")
        .select("updated_at")
        .eq("user_id", user.id)
        .eq("date", dateKey)
        .maybeSingle();

      const cloudUpdatedAt = cloudRows.data?.updated_at as string | undefined;
      const useLocal =
        !cloudUpdatedAt ||
        !shouldUseCloud(
          localUpdatedAt,
          cloudUpdatedAt,
          modifiedThisSession.has(dateKey)
        );

      if (useLocal) {
        const ok = await pushDay(dateKey, data);
        if (ok) pushed++;
      }
    }

    const cloudRows = await pullRange(SYNC_DAYS);
    for (const { date, data, updated_at } of cloudRows) {
      const localData = await getDayData(date);
      const localUpdatedAt = await getLocalUpdatedAt(date);
      const useCloud = shouldUseCloud(
        localUpdatedAt,
        updated_at,
        modifiedThisSession.has(date)
      );

      if (useCloud && !isEmptyDay(data)) {
        await setDayDataFromSync(date, data, new Date(updated_at).getTime());
        pulled++;
      }
    }

    await setLastSyncTime(Date.now());
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

export async function getLastSync(): Promise<number | null> {
  return getLastSyncTime();
}
