"use client";

import type { DayData } from "@/types";

const TOTAL_ITEMS = 10;

function countCompleted(data: DayData, waterGoal: number): number {
  let n = 0;
  if (data.medication.dex1.taken) n++;
  if (data.medication.dex2.taken) n++;
  if (data.medication.dex3.taken) n++;
  if (data.medication.bupropion.taken) n++;
  if (data.lunchEaten) n++;
  if (data.smoothieEaten ?? false) n++;
  if (data.snackEaten) n++;
  if (data.waterMl >= waterGoal) n++;
  if (data.workoutDone) n++;
  if (data.walkDone) n++;
  return n;
}

interface Props {
  data: DayData;
  waterGoal?: number;
}

export function DailySummary({ data, waterGoal = 2000 }: Props) {
  const completed = countCompleted(data, waterGoal);

  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-gray-700">
        Today: {completed} / {TOTAL_ITEMS} completed
      </p>
      <p className="text-sm text-muted mt-1">You’re doing fine.</p>
    </section>
  );
}
