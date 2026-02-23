"use client";

import type { DayData } from "@/types";

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
}

export function MovementSection({ data, update }: Props) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
        Movement
      </h2>
      <div className="space-y-2">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm flex items-center justify-between gap-2">
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
              className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({ ...prev, workoutDone: true }))
              }
              className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:opacity-90"
            >
              Mark done
            </button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
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
                className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Undo
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({ ...prev, walkDone: true }))
                }
                className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:opacity-90"
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
              className="w-24 rounded-lg border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
