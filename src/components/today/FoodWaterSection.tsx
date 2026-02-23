"use client";

import type { DayData, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  settings: Settings | null;
  update: (fn: UpdateFn) => void;
}

export function FoodWaterSection({ data, settings, update }: Props) {
  const goal = settings?.waterGoalMl ?? DEFAULT_SETTINGS.waterGoalMl;
  const pct = goal > 0 ? Math.min(100, (data.waterMl / goal) * 100) : 0;

  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
        Food & water
      </h2>

      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Smoothie</p>
              <p className="text-sm text-muted">
                {(data.smoothieEaten ?? false) && data.smoothieAt
                  ? `Logged at ${formatTime(data.smoothieAt)}`
                  : "Not yet"}
              </p>
            </div>
            {(data.smoothieEaten ?? false) ? (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    smoothieEaten: false,
                    smoothieAt: null,
                    smoothieNote: "",
                  }))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
              >
                Undo
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    smoothieEaten: true,
                    smoothieAt: Date.now(),
                  }))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
              >
                Mark eaten
              </button>
            )}
          </div>
          {(data.smoothieEaten ?? false) && (
            <input
              type="text"
              placeholder="What did you have?"
              value={data.smoothieNote ?? ""}
              onChange={(e) =>
                update((prev) => ({ ...prev, smoothieNote: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Lunch eaten</p>
              <p className="text-sm text-muted">
                {data.lunchEaten && data.lunchAt
                  ? `Logged at ${formatTime(data.lunchAt)}`
                  : "Not yet"}
              </p>
            </div>
            {data.lunchEaten ? (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    lunchEaten: false,
                    lunchAt: null,
                    lunchNote: "",
                  }))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
              >
                Undo
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    lunchEaten: true,
                    lunchAt: Date.now(),
                  }))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
              >
                Mark eaten
              </button>
            )}
          </div>
          {data.lunchEaten && (
            <input
              type="text"
              placeholder="What did you have?"
              value={data.lunchNote ?? ""}
              onChange={(e) =>
                update((prev) => ({ ...prev, lunchNote: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Afternoon snack eaten</p>
              <p className="text-sm text-muted">Suppresses food nudges</p>
            </div>
            {(data.snackEaten ?? false) ? (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    snackEaten: false,
                    snackNote: "",
                  }))
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 shadow-sm"
              >
                Undo
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({ ...prev, snackEaten: true }))
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
              >
                Mark eaten
              </button>
            )}
          </div>
          {(data.snackEaten ?? false) && (
            <input
              type="text"
              placeholder="What did you have?"
              value={data.snackNote ?? ""}
              onChange={(e) =>
                update((prev) => ({ ...prev, snackNote: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            />
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
        <p className="font-medium text-gray-800 mb-2">Water</p>
        <div className="h-3 rounded-full bg-gray-100/80 overflow-hidden mb-4">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-muted mb-3">
          {data.waterMl} / {goal} ml
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              update((prev) => ({
                ...prev,
                waterMl: prev.waterMl + 250,
                waterLog: [
                  ...prev.waterLog,
                  { amount: 250, timestamp: Date.now() },
                ],
              }))
            }
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
          >
            +250 ml
          </button>
          <button
            type="button"
            onClick={() =>
              update((prev) => ({
                ...prev,
                waterMl: prev.waterMl + 500,
                waterLog: [
                  ...prev.waterLog,
                  { amount: 500, timestamp: Date.now() },
                ],
              }))
            }
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
          >
            +500 ml
          </button>
          <button
            type="button"
            onClick={() =>
              update((prev) => {
                if (prev.waterLog.length === 0) return prev;
                const last = prev.waterLog[prev.waterLog.length - 1];
                return {
                  ...prev,
                  waterMl: prev.waterMl - last.amount,
                  waterLog: prev.waterLog.slice(0, -1),
                };
              })
            }
            disabled={data.waterLog.length === 0}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Undo last
          </button>
        </div>
      </div>
    </section>
  );
}
