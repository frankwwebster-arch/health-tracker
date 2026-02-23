"use client";

import { useEffect, useState } from "react";
import { LayoutHeader } from "@/components/LayoutHeader";
import { getDayData, getAllDayKeys, getSettings } from "@/db";
import type { DayData } from "@/types";
import { getDateKey, getAdjacentDateKey } from "@/types";

type Period = 7 | 14 | 30;

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function sleepHours(bedtime: string, wakeTime: string): number {
  const bedMin = parseTimeToMinutes(bedtime);
  let wakeMin = parseTimeToMinutes(wakeTime);
  if (wakeMin < bedMin) wakeMin += 24 * 60;
  return (wakeMin - bedMin) / 60;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>(14);
  const [days, setDays] = useState<{ key: string; data: DayData }[]>([]);
  const [waterGoal, setWaterGoal] = useState(2000);
  const [customMedIds, setCustomMedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = getDateKey();
      const startKey = getAdjacentDateKey(today, -period + 1);
      const keys = await getAllDayKeys();
      const keysInRange = keys
        .filter((k) => k >= startKey && k <= today)
        .sort();

      const [dataList, settings] = await Promise.all([
        Promise.all(keysInRange.map(async (k) => ({ key: k, data: await getDayData(k) }))),
        getSettings(),
      ]);

      setDays(dataList);
      setWaterGoal(settings?.waterGoalMl ?? 2000);
      setCustomMedIds((settings?.customMeds ?? []).map((m) => m.id));
      setLoading(false);
    }
    load();
  }, [period]);

  if (loading) {
    return (
      <>
        <LayoutHeader title="Dashboard" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <p className="text-muted">Loading…</p>
        </main>
      </>
    );
  }

  const medTotal = days.length * (3 + 1 + customMedIds.length); // 3 dex + 1 bupropion + custom
  let medTaken = 0;
  let waterHit = 0;
  let lunchLogged = 0;
  let movementDays = 0;
  const sleepHoursList: number[] = [];
  const weightList: number[] = [];
  let exerciseMinutesTotal = 0;
  let exerciseDays = 0;
  const stepsList: number[] = [];
  const sentimentMorning: number[] = [];
  const sentimentMidday: number[] = [];
  const sentimentEvening: number[] = [];

  for (const { data } of days) {
    for (const d of data.medication.dex?.doses ?? []) {
      if (d.taken) medTaken++;
    }
    if (data.medication.bupropion.taken) medTaken++;
    for (const id of customMedIds) {
      if (data.customMedsTaken?.[id]?.taken) medTaken++;
    }
    if (data.waterMl >= waterGoal) waterHit++;
    if (data.lunchEaten) lunchLogged++;
    if (data.workoutMinutes != null || data.walkDone) movementDays++;
    if (data.bedtime && data.wakeTime) {
      sleepHoursList.push(sleepHours(data.bedtime, data.wakeTime));
    }
    if (data.weightKg != null) weightList.push(data.weightKg);
    if (data.workoutMinutes != null) {
      exerciseMinutesTotal += data.workoutMinutes;
      exerciseDays++;
    }
    if (data.stepsCount != null) stepsList.push(data.stepsCount);
    if (data.sentimentMorning != null) sentimentMorning.push(data.sentimentMorning);
    if (data.sentimentMidday != null) sentimentMidday.push(data.sentimentMidday);
    if (data.sentimentEvening != null) sentimentEvening.push(data.sentimentEvening);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const avgSleep = avg(sleepHoursList);
  const avgSentimentM = avg(sentimentMorning);
  const avgSentimentD = avg(sentimentMidday);
  const avgSentimentE = avg(sentimentEvening);

  const statCard = (label: string, value: string, sub?: string) => (
    <div
      key={label}
      className="rounded-2xl border border-border bg-white p-4 shadow-card"
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="text-xl font-semibold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <>
      <LayoutHeader title="Dashboard" />
      <main className="max-w-lg mx-auto px-4 pb-24">
        <div className="flex gap-2 mb-6">
          {([7, 14, 30] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                period === p
                  ? "bg-accent text-white"
                  : "bg-white/80 text-gray-600 hover:bg-accent-soft border border-border"
              }`}
            >
              Last {p} days
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {statCard(
            "Medication",
            medTotal > 0 ? `${Math.round((medTaken / medTotal) * 100)}%` : "—",
            `${medTaken} / ${medTotal} doses`
          )}
          {statCard(
            "Water goal",
            days.length > 0 ? `${Math.round((waterHit / days.length) * 100)}%` : "—",
            `${waterHit} of ${days.length} days`
          )}
          {statCard(
            "Lunch logged",
            days.length > 0 ? `${Math.round((lunchLogged / days.length) * 100)}%` : "—",
            `${lunchLogged} of ${days.length} days`
          )}
          {statCard(
            "Movement",
            days.length > 0 ? `${Math.round((movementDays / days.length) * 100)}%` : "—",
            `${movementDays} days with workout or walk`
          )}
          {statCard(
            "Exercise minutes",
            exerciseMinutesTotal > 0 ? `${exerciseMinutesTotal} min` : "—",
            exerciseDays > 0
              ? `${exerciseDays} workout${exerciseDays === 1 ? "" : "s"} · avg ${Math.round(exerciseMinutesTotal / exerciseDays)} min`
              : "No workouts logged"
          )}
          {statCard(
            "Steps",
            stepsList.length > 0
              ? `${stepsList.reduce((a, b) => a + b, 0).toLocaleString()} total`
              : "—",
            stepsList.length > 0
              ? `avg ${Math.round(stepsList.reduce((a, b) => a + b, 0) / stepsList.length).toLocaleString()} · ${stepsList.length} day${stepsList.length === 1 ? "" : "s"} logged`
              : "Log on Today"
          )}
          {statCard(
            "Weight",
            weightList.length > 0 ? `${weightList[weightList.length - 1].toFixed(1)} kg` : "—",
            weightList.length > 1
              ? `Range: ${Math.min(...weightList).toFixed(1)}–${Math.max(...weightList).toFixed(1)} kg`
              : weightList.length === 1
                ? "1 entry"
                : "Log on Today"
          )}
          {avgSleep != null &&
            statCard(
              "Avg sleep",
              `${avgSleep.toFixed(1)}h`,
              `${sleepHoursList.length} days logged`
            )}
          {(avgSentimentM != null || avgSentimentD != null || avgSentimentE != null) &&
            statCard(
              "Mood (avg 1–5)",
              [
                avgSentimentM != null && `AM ${avgSentimentM.toFixed(1)}`,
                avgSentimentD != null && `Mid ${avgSentimentD.toFixed(1)}`,
                avgSentimentE != null && `PM ${avgSentimentE.toFixed(1)}`,
              ]
                .filter(Boolean)
                .join(" · "),
              undefined
            )}
        </div>

        {days.length === 0 && (
          <p className="text-muted text-center py-8">
            No data for the last {period} days. Log some entries on the Today page.
          </p>
        )}
      </main>
    </>
  );
}
