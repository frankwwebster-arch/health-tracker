"use client";

import type { DayData } from "@/types";

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
}

export function MovementSection({ data, update }: Props) {
  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
        Movement
      </h2>
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow flex items-center justify-between gap-2">
          <div>
            <p className="font-medium text-gray-800">Workout done</p>
            <p className="text-sm text-muted">
              {data.workoutDone ? "Done" : "Not yet"}
            </p>
          </div>
          {data.workoutDone ? (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({ ...prev, workoutDone: false }))
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 shadow-sm"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({ ...prev, workoutDone: true }))
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
            >
              Mark done
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Walk / steps done</p>
              <p className="text-sm text-muted">
                {data.walkDone ? "Done" : "Not yet"}
              </p>
            </div>
            {data.walkDone ? (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({ ...prev, walkDone: false }))
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 shadow-sm"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({ ...prev, walkDone: true }))
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
            >
              Mark done
            </button>
          )}
        </div>
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="steps" className="text-sm text-muted shrink-0">
              Steps:
            </label>
            <input
              id="steps"
              type="number"
              min={0}
              placeholder="e.g. 5000"
              value={data.stepsCount != null ? data.stepsCount : ""}
              onChange={(e) => {
                const v = e.target.value;
                update((prev) => ({
                  ...prev,
                  stepsCount: v === "" ? null : parseInt(v, 10) || null,
                }));
              }}
              className="w-24 rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
