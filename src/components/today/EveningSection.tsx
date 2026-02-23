"use client";

import type { DayData } from "@/types";

type UpdateFn = (prev: DayData) => DayData;

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
  if (wakeMin < bedMin) wakeMin += 24 * 60;
  const totalMin = wakeMin - bedMin;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
}

export function EveningSection({ data, update }: Props) {
  const bedtime = data.bedtime ?? "";
  const wakeTime = data.wakeTime ?? "";
  const hasSleep = bedtime && wakeTime;
  const value = data.sentimentEvening ?? null;

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
        Evening
      </h2>
      <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Bedtime</span>
              <input
                type="time"
                value={bedtime}
                onChange={(e) =>
                  update((prev) => ({ ...prev, bedtime: e.target.value || null }))
                }
                className="rounded-xl border border-border px-3 py-2 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">How are you feeling?</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        sentimentEvening: value === n ? null : n,
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
                {value != null && (
                  <span className="ml-1 self-center text-sm text-muted">
                    {SENTIMENT_LABELS[value]}
                  </span>
                )}
              </div>
            </div>
          </div>
          {hasSleep && (
            <p className="text-sm text-muted">
              ~{formatSleepDuration(bedtime, wakeTime)} sleep
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
