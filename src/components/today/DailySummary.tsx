"use client";

import type { DayData } from "@/types";

function countCompleted(data: DayData, waterGoal: number, customMedIds: string[]): number {
  let n = 0;
  for (const d of data.medication.dex?.doses ?? []) {
    if (d.taken) n++;
  }
  if (data.medication.bupropion.taken) n++;
  for (const id of customMedIds) {
    if (data.customMedsTaken?.[id]?.taken) n++;
  }
  if (data.lunchEaten) n++;
  if (data.smoothieEaten ?? false) n++;
  if (data.snackEaten) n++;
  if (data.waterMl >= waterGoal) n++;
  if (data.workoutMinutes != null) n++;
  if (data.walkDone) n++;
  return n;
}

interface Props {
  data: DayData;
  waterGoal?: number;
  customMedIds?: string[];
}

export function DailySummary({ data, waterGoal = 2000, customMedIds = [] }: Props) {
  const totalItems = 10 + customMedIds.length;
  const completed = countCompleted(data, waterGoal, customMedIds);

  return (
    <section className="rounded-2xl border border-accent/20 bg-accent-soft/50 p-5 shadow-card">
      <p className="text-gray-800 font-medium">
        Today: {completed} / {totalItems} completed
      </p>
      <p className="text-sm text-muted mt-1">You’re doing fine.</p>
    </section>
  );
}
