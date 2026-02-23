"use client";

import { useEffect, useRef, useState } from "react";
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
import { getDateKey } from "@/types";

export default function TodayPage() {
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const { data, update } = useTodayData(selectedDateKey);
  const { settings } = useSettings();
  const isToday = selectedDateKey === getDateKey();
  const pelotonAttemptedDates = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data || data.workoutMinutes != null) return;
    if (pelotonAttemptedDates.current.has(selectedDateKey)) return;
    pelotonAttemptedDates.current.add(selectedDateKey);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    const controller = new AbortController();

    const hydrateWorkoutFromPeloton = async () => {
      try {
        const query = new URLSearchParams({
          date: selectedDateKey,
          timeZone,
        });
        const response = await fetch(`/api/peloton/workout?${query.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { workoutMinutes?: number | null };
        if (typeof payload.workoutMinutes !== "number" || payload.workoutMinutes <= 0) {
          return;
        }

        await update((prev) =>
          prev.workoutMinutes == null
            ? { ...prev, workoutMinutes: payload.workoutMinutes }
            : prev
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    };

    void hydrateWorkoutFromPeloton();
    return () => controller.abort();
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
        <MovementSection data={data} update={update} />
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
