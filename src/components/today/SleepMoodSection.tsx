"use client";

import type { DayData } from "@/types";

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
}

const SENTIMENT_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatSleepDuration(bedtime: string, wakeTime: string): string {
  const bedMin = parseTimeToMinutes(bedtime);
  let wakeMin = parseTimeToMinutes(wakeTime);
  if (wakeMin < bedMin) wakeMin += 24 * 60; // next day
  const totalMin = wakeMin - bedMin;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function SleepMoodSection({ data, update }: Props) {
  const bedtime = data.bedtime ?? null;
  const wakeTime = data.wakeTime ?? null;
  const hasSleep = bedtime && wakeTime;

  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
        Sleep & mood
      </h2>
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <p className="font-medium text-gray-800 mb-3">Sleep</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Bedtime</span>
              <input
                type="time"
                value={bedtime ?? ""}
                onChange={(e) =>
                  update((prev) => ({ ...prev, bedtime: e.target.value || null }))
                }
                className="rounded-xl border border-border px-3 py-2 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Wake time</span>
              <input
                type="time"
                value={wakeTime ?? ""}
                onChange={(e) =>
                  update((prev) => ({ ...prev, wakeTime: e.target.value || null }))
                }
                className="rounded-xl border border-border px-3 py-2 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
          </div>
          {hasSleep && (
            <p className="text-sm text-muted mt-2">
              ~{formatSleepDuration(bedtime, wakeTime)} sleep
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <p className="font-medium text-gray-800 mb-3">How are you feeling?</p>
          <div className="space-y-3">
            {(["Morning", "Midday", "Evening"] as const).map((period) => {
              const key = `sentiment${period}` as "sentimentMorning" | "sentimentMidday" | "sentimentEvening";
              const value = data[key] ?? null;
              return (
                <div key={period} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted w-16">{period}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          update((prev) => ({
                            ...prev,
                            [key]: value === n ? null : n,
                          }))
                        }
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          value === n
                            ? "bg-accent text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-accent-soft"
                        }`}
                        title={SENTIMENT_LABELS[n]}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {value != null && (
                    <span className="text-sm text-muted w-14 text-right">
                      {SENTIMENT_LABELS[value]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
