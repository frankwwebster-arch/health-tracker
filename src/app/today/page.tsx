"use client";

import { useState, useEffect, useRef } from "react";
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
import { StreakBanner } from "@/components/today/StreakBanner";
import type { ReminderType } from "@/components/reminders/ReminderContext";
import { getDateKey } from "@/types";
import { useSync } from "@/components/SyncContext";
export default function TodayPage() {
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const [isSyncing, setIsSyncing] = useState(false);
  const { data, update, refresh } = useTodayData(selectedDateKey);
  const { settings } = useSettings();
  const isToday = selectedDateKey === getDateKey();
  const pelotonAutoSyncDone = useRef<Set<string>>(new Set());
  const sync = useSync();
  const syncRef = useRef(sync);
  const fullSyncDone = useRef(false);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // Full sync once on first load
  useEffect(() => {
    if (!sync || fullSyncDone.current) return;
    fullSyncDone.current = true;
    sync.sync().then(() => refresh());
  }, [sync]);

  // Fast single-day sync on date navigation
  useEffect(() => {
    const s = syncRef.current;
    if (!s) return;
    setIsSyncing(true);
    s
      .syncDayNow(selectedDateKey)
      .then(() => refresh())
      .finally(() => setIsSyncing(false));
  }, [selectedDateKey, refresh]);

  useEffect(() => {
    if (!data) return;
    if (data.workoutMinutes != null) return;
    if ((data.workoutSessions ?? []).length > 0) return;
    if (pelotonAutoSyncDone.current.has(selectedDateKey)) return;
    pelotonAutoSyncDone.current.add(selectedDateKey);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/peloton/workout?date=${selectedDateKey}&timeZone=${encodeURIComponent(tz)}`)
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
  }, [data, selectedDateKey, update]);

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

  if (!data || isSyncing) {
    return (
      <>
        <LayoutHeader title="Today" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-muted">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p>Syncing…</p>
          </div>
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
      <StreakBanner />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <DateSelector dateKey={selectedDateKey} onDateChange={setSelectedDateKey} />
        <MorningSection data={data} update={update} />
        <MedicationSection data={data} settings={settings} update={update} />
        <FoodWaterSection
          data={data}
          dateKey={selectedDateKey}
          update={update}
          settings={settings}
        />
        <MovementSection data={data} update={update} dateKey={selectedDateKey} />
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