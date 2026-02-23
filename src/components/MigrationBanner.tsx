"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { DayData } from "@/types";
import { getAllDayKeys, getDayData, setDayDataFromSync, getMigrationOffered, setMigrationOffered } from "@/db";
import { getDateKey, getAdjacentDateKey } from "@/types";
import { pullRange, pushDay } from "@/lib/sync";

type MigrationState = "idle" | "checking" | "upload" | "download" | "merge" | "done";

export function MigrationBanner() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<MigrationState>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;

    let cancelled = false;
    setState("checking");

    async function check() {
      const offered = await getMigrationOffered();
      if (offered || cancelled) {
        setState("idle");
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        setState("idle");
        return;
      }

      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u || cancelled) return;

      const today = getDateKey();
      const startKey = getAdjacentDateKey(today, -59);
      const localKeys = await getAllDayKeys();
      const localKeysInRange = localKeys.filter((k) => k >= startKey && k <= today);

      let hasLocalData = false;
      for (const k of localKeysInRange) {
        const d = await getDayData(k);
        if (!isEmpty(d)) {
          hasLocalData = true;
          break;
        }
      }

      const cloudRows = await pullRange(60);
      const hasCloudData = cloudRows.some((r) => !isEmpty(r.data));

      if (cancelled) return;

      if (hasLocalData && !hasCloudData) setState("upload");
      else if (hasCloudData && !hasLocalData) setState("download");
      else if (hasLocalData && hasCloudData) setState("merge");
      else setState("done");
    }

    check();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const isEmpty = (d: DayData) =>
    d.medication.dex?.doses?.every((x) => !x.taken) &&
    !d.medication.bupropion?.taken &&
    !d.lunchEaten &&
    !d.smoothieEaten &&
    !d.snackEaten &&
    d.waterMl === 0 &&
    d.workoutMinutes == null &&
    (d.workoutSessions?.length ?? 0) === 0 &&
    !d.walkDone &&
    d.stepsCount == null &&
    d.weightKg == null &&
    !d.bedtime &&
    !d.wakeTime &&
    d.sentimentMorning == null &&
    d.sentimentMidday == null &&
    d.sentimentEvening == null &&
    Object.keys(d.customMedsTaken ?? {}).length === 0;

  const handleUpload = async () => {
    setBusy(true);
    const keys = await getAllDayKeys();
    const today = getDateKey();
    const startKey = getAdjacentDateKey(today, -59);
    for (const k of keys) {
      if (k < startKey || k > today) continue;
      const d = await getDayData(k);
      if (!isEmpty(d)) await pushDay(k, d);
    }
    await setMigrationOffered();
    setBusy(false);
    setState("done");
  };

  const handleDownload = async () => {
    setBusy(true);
    const rows = await pullRange(60);
    for (const { date, data, updated_at } of rows) {
      if (!isEmpty(data)) {
        await setDayDataFromSync(date, data, new Date(updated_at).getTime());
      }
    }
    await setMigrationOffered();
    setBusy(false);
    setState("done");
  };

  const handleMerge = async () => {
    setBusy(true);
    const { syncNow } = await import("@/lib/sync");
    await syncNow(new Set());
    await setMigrationOffered();
    setBusy(false);
    setState("done");
  };

  const dismiss = async () => {
    await setMigrationOffered();
    setState("done");
  };

  if (state === "idle" || state === "checking" || state === "done") return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-2">
      <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 shadow-card">
        <p className="font-medium text-gray-800">
          {state === "upload" && "Upload your existing local data to your account?"}
          {state === "download" && "Download your data to this device?"}
          {state === "merge" && "Merge local and cloud data?"}
        </p>
        <div className="flex gap-2 mt-3">
          {state === "upload" && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
          )}
          {state === "download" && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? "Downloading…" : "Download"}
            </button>
          )}
          {state === "merge" && (
            <button
              type="button"
              onClick={handleMerge}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? "Merging…" : "Merge now"}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
