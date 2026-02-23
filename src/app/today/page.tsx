"use client";

import { useState } from "react";
import { useTodayData, useSettings } from "@/hooks/useTodayData";
import { LayoutHeader } from "@/components/LayoutHeader";
import { DateSelector } from "@/components/today/DateSelector";
import { MedicationSection } from "@/components/today/MedicationSection";
import { FoodWaterSection } from "@/components/today/FoodWaterSection";
import { MovementSection } from "@/components/today/MovementSection";
import { WeightSection } from "@/components/today/WeightSection";
import { SleepMoodSection } from "@/components/today/SleepMoodSection";
import { DailySummary } from "@/components/today/DailySummary";
import { ReminderBanners } from "@/components/reminders/ReminderBanners";
import { ReminderScheduler } from "@/components/reminders/ReminderScheduler";
import { SupplyBanner } from "@/components/reminders/SupplyBanner";
import type { ReminderType } from "@/components/reminders/ReminderContext";
import { getDateKey } from "@/types";

export default function TodayPage() {
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const { data, update } = useTodayData(selectedDateKey);
  const { settings } = useSettings();
  const isToday = selectedDateKey === getDateKey();

  const handleMarkAsTaken = (type: ReminderType, _id: string) => {
    if (type === "lunch") {
      update((prev) => ({ ...prev, lunchEaten: true, lunchAt: Date.now() }));
      return;
    }
    if (type === "dex1" || type === "dex2" || type === "dex3" || type === "bupropion") {
      update((prev) => ({
        ...prev,
        medication: {
          ...prev.medication,
          [type]: { taken: true, takenAt: Date.now() },
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
      <main className="max-w-lg mx-auto px-4 pb-24">
        <DateSelector dateKey={selectedDateKey} onDateChange={setSelectedDateKey} />
        <MedicationSection data={data} settings={settings} update={update} />
        <FoodWaterSection data={data} update={update} settings={settings} />
        <MovementSection data={data} update={update} />
        <WeightSection data={data} update={update} />
        <SleepMoodSection data={data} update={update} />
        <DailySummary data={data} waterGoal={settings?.waterGoalMl ?? 2000} />
      </main>
    </>
  );
}
