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

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
}

export function MorningSection({ data, update }: Props) {
  const wakeTime = data.wakeTime ?? "";
  const value = data.sentimentMorning ?? null;

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
        Morning
      </h2>
      <div
        className={`rounded-2xl border p-4 shadow-card hover:shadow-card-hover transition-shadow ${
          wakeTime && value != null ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
        }`}
      >
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Wake time</span>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) =>
                update((prev) => ({ ...prev, wakeTime: e.target.value || null }))
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
                      sentimentMorning: value === n ? null : n,
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
      </div>
    </section>
  );
}
