"use client";

import { useEffect, useRef } from "react";
import { LayoutHeader } from "@/components/LayoutHeader";
import { WorkoutCoachPanel } from "@/components/workout-coach/WorkoutCoachPanel";
import { useTodayData } from "@/hooks/useTodayData";
import { useSync } from "@/components/SyncContext";
import { syncDay } from "@/lib/sync";
import { getDateKey } from "@/types";

export default function CoachPage() {
  const todayKey = getDateKey();
  const { data, update, refresh } = useTodayData(todayKey);
  const sync = useSync();
  const fullSyncDone = useRef(false);
  const pelotonAutoSyncDone = useRef(false);

  useEffect(() => {
    if (!sync || fullSyncDone.current) return;
    fullSyncDone.current = true;
    sync.sync().then(() => refresh());
  }, [sync, refresh]);

  useEffect(() => {
    if (!sync) return;
    syncDay(todayKey).then(() => refresh());
  }, [sync, todayKey, refresh]);

  useEffect(() => {
    if (!data) return;
    if (data.workoutMinutes != null) return;
    if ((data.workoutSessions ?? []).length > 0) return;
    if (pelotonAutoSyncDone.current) return;
    pelotonAutoSyncDone.current = true;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/peloton/workout?date=${todayKey}&timeZone=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.configured) return;
        if (json.workoutMinutes != null || (json.workoutSessions ?? []).length > 0) {
          update((prev) => ({
            ...prev,
            workoutMinutes: json.workoutMinutes ?? prev.workoutMinutes,
            workoutSessions: json.workoutSessions ?? prev.workoutSessions,
          }));
        }
      })
      .catch(() => {});
  }, [data, todayKey, update]);

  if (!data) {
    return (
      <>
        <LayoutHeader title="Workout Coach" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <p className="text-muted">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <LayoutHeader title="Workout Coach" />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-8">
        <p className="text-sm text-muted mb-6">
          One tap → train → log. No planning.
        </p>
        <WorkoutCoachPanel data={data} update={update} dateKey={todayKey} />
      </main>
    </>
  );
}
