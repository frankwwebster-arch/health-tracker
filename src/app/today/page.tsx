"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTodayData, useSettings } from "@/hooks/useTodayData";
import { LayoutHeader } from "@/components/LayoutHeader";
import { DateSelector } from "@/components/today/DateSelector";
import { MorningSection } from "@/components/today/MorningSection";
import { MedicationSection } from "@/components/today/MedicationSection";
import { FoodWaterSection } from "@/components/today/FoodWaterSection";
import { MovementSection } from "@/components/today/MovementSection";
import { WeightSection } from "@/components/today/WeightSection";
import { EveningSection } from "@/components/today/EveningSection";
import { DailySummary } from "@/components/today/DailySummary";
import { ReminderBanners } from "@/components/reminders/ReminderBanners";
import { ReminderScheduler } from "@/components/reminders/ReminderScheduler";
import { SupplyBanner } from "@/components/reminders/SupplyBanner";
import { MigrationBanner } from "@/components/MigrationBanner";
import type { ReminderType } from "@/components/reminders/ReminderContext";
import type { WorkoutSession } from "@/types";
import { getDateKey } from "@/types";

interface PelotonWorkoutPayload {
  id?: string;
  label?: string;
  durationMinutes?: number;
  discipline?: string | null;
  startTime?: number | null;
}

interface PelotonWorkoutResponse {
  workoutMinutes?: number | null;
  workouts?: PelotonWorkoutPayload[];
  configured?: boolean;
  error?: string;
}

function toPelotonSessions(workouts: PelotonWorkoutPayload[]): WorkoutSession[] {
  return workouts
    .map((workout, index) => {
      const durationMinutes =
        typeof workout.durationMinutes === "number" && workout.durationMinutes > 0
          ? Math.round(workout.durationMinutes)
          : null;
      if (!durationMinutes) return null;

      const label =
        typeof workout.label === "string" && workout.label.trim() !== ""
          ? workout.label.trim()
          : "Peloton workout";
      const rawId =
        typeof workout.id === "string" && workout.id.trim() !== ""
          ? workout.id
          : `peloton-${workout.startTime ?? "unknown"}-${index}`;

      return {
        id: rawId,
        source: "peloton" as const,
        label,
        durationMinutes,
        discipline:
          typeof workout.discipline === "string" && workout.discipline.trim() !== ""
            ? workout.discipline
            : null,
        startTime:
          typeof workout.startTime === "number" && Number.isFinite(workout.startTime)
            ? workout.startTime
            : null,
      };
    })
    .filter((session): session is WorkoutSession => Boolean(session));
}

export default function TodayPage() {
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const { data, update } = useTodayData(selectedDateKey);
  const { settings } = useSettings();
  const isToday = selectedDateKey === getDateKey();
  const pelotonAttemptedDates = useRef<Set<string>>(new Set());
  const [pelotonSyncing, setPelotonSyncing] = useState(false);
  const [pelotonSyncStatus, setPelotonSyncStatus] = useState<string | null>(null);
  const [pelotonConfigured, setPelotonConfigured] = useState<boolean | null>(null);

  const syncPelotonWorkouts = useCallback(
    async (manualTrigger: boolean, signal?: AbortSignal) => {
      if (pelotonSyncing) return;
      if (manualTrigger) {
        setPelotonSyncStatus("Syncing Peloton workouts…");
      }

      setPelotonSyncing(true);
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
        const query = new URLSearchParams({
          date: selectedDateKey,
          timeZone,
        });
        const response = await fetch(`/api/peloton/workout?${query.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal,
        });
        const payload = (await response.json()) as PelotonWorkoutResponse;

        if (typeof payload.configured === "boolean") {
          setPelotonConfigured(payload.configured);
        }

        if (!response.ok) {
          if (manualTrigger) {
            setPelotonSyncStatus(payload.error ?? "Peloton sync failed.");
          }
          return;
        }

        if (payload.configured === false) {
          if (manualTrigger) {
            setPelotonSyncStatus("Peloton sync is not configured.");
          }
          return;
        }

        const pelotonSessions = toPelotonSessions(payload.workouts ?? []);
        const hasPelotonMinutes =
          typeof payload.workoutMinutes === "number" && payload.workoutMinutes > 0;

        if (pelotonSessions.length === 0 && !hasPelotonMinutes) {
          if (manualTrigger) {
            setPelotonSyncStatus(`No Peloton workouts found for ${selectedDateKey}.`);
          }
          return;
        }

        await update((prev) => {
          const nonPelotonSessions = (prev.workoutSessions ?? []).filter(
            (session) => session.source !== "peloton"
          );
          const mergedSessions = [...nonPelotonSessions, ...pelotonSessions];
          const mergedMinutes = mergedSessions.reduce(
            (sum, session) => sum + session.durationMinutes,
            0
          );
          const nextMinutes =
            mergedMinutes > 0
              ? mergedMinutes
              : hasPelotonMinutes
                ? payload.workoutMinutes ?? null
                : null;

          return {
            ...prev,
            workoutSessions: mergedSessions,
            workoutMinutes: nextMinutes,
          };
        });

        if (manualTrigger) {
          const syncedMinutes = pelotonSessions.reduce(
            (sum, session) => sum + session.durationMinutes,
            0
          );
          const workoutWord = pelotonSessions.length === 1 ? "workout" : "workouts";
          setPelotonSyncStatus(
            `Synced ${pelotonSessions.length} ${workoutWord} (${syncedMinutes} min).`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (manualTrigger) {
          setPelotonSyncStatus("Unable to sync from Peloton right now.");
        }
      } finally {
        if (!signal?.aborted) {
          setPelotonSyncing(false);
        }
      }
    },
    [pelotonSyncing, selectedDateKey, update]
  );

  useEffect(() => {
    if (!data || data.workoutMinutes != null) return;
    if (pelotonAttemptedDates.current.has(selectedDateKey)) return;
    pelotonAttemptedDates.current.add(selectedDateKey);

    const controller = new AbortController();
    void syncPelotonWorkouts(false, controller.signal);
    return () => controller.abort();
  }, [data, selectedDateKey, syncPelotonWorkouts]);

  const handleManualPelotonSync = useCallback(async () => {
    pelotonAttemptedDates.current.add(selectedDateKey);
    await syncPelotonWorkouts(true);
  }, [selectedDateKey, syncPelotonWorkouts]);

  const handleMarkAsTaken = (type: ReminderType, id: string) => {
    if (type === "lunch") {
      update((prev) => ({ ...prev, lunchEaten: true, lunchAt: Date.now() }));
      return;
    }
    if (type === "bupropion") {
      update((prev) => ({
        ...prev,
        medication: {
          ...prev.medication,
          bupropion: { taken: true, takenAt: Date.now() },
        },
      }));
      return;
    }
    const dexMatch = (type as string).match(/^dex-(\d+)$/);
    if (dexMatch) {
      const doseIndex = parseInt(dexMatch[1], 10);
      update((prev) => {
        const doses = [...(prev.medication.dex?.doses ?? [{ taken: false, takenAt: null }, { taken: false, takenAt: null }, { taken: false, takenAt: null }])];
        doses[doseIndex] = { taken: true, takenAt: Date.now() };
        return {
          ...prev,
          medication: {
            ...prev.medication,
            dex: { doses },
          },
        };
      });
      return;
    }
    if (type === "custom") {
      const medId = id.startsWith("custom-") ? id.slice(7) : id;
      update((prev) => ({
        ...prev,
        customMedsTaken: {
          ...(prev.customMedsTaken ?? {}),
          [medId]: { taken: true, takenAt: Date.now() },
        },
      }));
    }
  };

  const handleAddWater = () => {
    update((prev) => ({
      ...prev,
      waterMl: prev.waterMl + 250,
      waterLog: [...prev.waterLog, { amount: 250, timestamp: Date.now() }],
    }));
  };

  if (!data) {
    return (
      <>
        <LayoutHeader title="Today" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <p className="text-muted">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      {isToday && <ReminderScheduler />}
      <LayoutHeader title="Today" />
      {isToday && (
        <ReminderBanners onMarkAsTaken={handleMarkAsTaken} onAddWater={handleAddWater} />
      )}
      <SupplyBanner settings={settings} />
      <MigrationBanner />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <DateSelector dateKey={selectedDateKey} onDateChange={setSelectedDateKey} />
        <MorningSection data={data} update={update} />
        <MedicationSection data={data} settings={settings} update={update} />
        <FoodWaterSection data={data} update={update} settings={settings} />
        <MovementSection
          data={data}
          update={update}
          onSyncPeloton={handleManualPelotonSync}
          pelotonSyncing={pelotonSyncing}
          pelotonSyncStatus={pelotonSyncStatus}
          pelotonConfigured={pelotonConfigured}
        />
        <WeightSection data={data} update={update} />
        <EveningSection data={data} update={update} />
        <DailySummary
          data={data}
          waterGoal={settings?.waterGoalMl ?? 2000}
          customMedIds={(settings?.customMeds ?? []).map((m) => m.id)}
        />
      </main>
    </>
  );
}
