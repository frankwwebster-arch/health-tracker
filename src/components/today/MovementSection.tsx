"use client";

import type { DayData } from "@/types";

type UpdateFn = (prev: DayData) => DayData;

const PRESET_MINS = [30, 45, 60] as const;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
  onSyncPeloton?: () => Promise<void> | void;
  pelotonSyncing?: boolean;
  pelotonSyncStatus?: string | null;
  pelotonConfigured?: boolean | null;
}

function createManualSession(minutes: number) {
  return {
    id: `manual-${Date.now()}`,
    source: "manual" as const,
    label: "Manual workout",
    durationMinutes: minutes,
    discipline: null,
    startTime: null,
  };
}

export function MovementSection({
  data,
  update,
  onSyncPeloton,
  pelotonSyncing = false,
  pelotonSyncStatus = null,
  pelotonConfigured = null,
}: Props) {
  const isPreset = data.workoutMinutes != null && PRESET_MINS.includes(data.workoutMinutes as (typeof PRESET_MINS)[number]);
  const isCustom = data.workoutMinutes != null && !isPreset;
  const sessions = data.workoutSessions ?? [];

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
        Movement
      </h2>
      <div className="space-y-3">
        <div
          className={`rounded-2xl border p-4 shadow-card hover:shadow-card-hover transition-shadow ${
            data.workoutMinutes != null ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-medium text-gray-800">Workout</p>
            {onSyncPeloton && (
              <button
                type="button"
                onClick={() => void onSyncPeloton()}
                disabled={pelotonSyncing}
                className="min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium bg-white/80 text-gray-700 hover:bg-white border border-border disabled:opacity-60"
              >
                {pelotonSyncing ? "Syncing…" : "Sync from Peloton"}
              </button>
            )}
          </div>
          {pelotonConfigured === false && (
            <p className="mb-2 text-xs text-muted">
              Peloton sync is not configured. Connect Peloton in Settings (or set
              PELOTON_USERNAME / PELOTON_PASSWORD).
            </p>
          )}
          {pelotonSyncStatus && (
            <p className="mb-2 text-xs text-muted">{pelotonSyncStatus}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {PRESET_MINS.map((mins) => {
              const selected = data.workoutMinutes === mins;
              return (
                <label
                  key={mins}
                  className={`flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer border transition-colors ${
                    selected
                      ? "bg-accent text-white border-accent shadow-sm"
                      : "bg-white/80 text-gray-600 border-border hover:bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        update((prev) => ({
                          ...prev,
                          workoutMinutes: mins,
                          workoutSessions: [createManualSession(mins)],
                        }));
                      } else {
                        update((prev) => ({
                          ...prev,
                          workoutMinutes: null,
                          workoutSessions: [],
                        }));
                      }
                    }}
                    className="sr-only"
                  />
                  {mins} min
                </label>
              );
            })}
            <label className="flex items-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium border border-border bg-white/80">
              <span className="text-muted shrink-0">Other:</span>
              <input
                type="number"
                min={1}
                max={240}
                placeholder="min"
                value={isCustom && data.workoutMinutes != null ? data.workoutMinutes : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    update((prev) => ({
                      ...prev,
                      workoutMinutes: null,
                      workoutSessions: [],
                    }));
                  } else {
                    const n = Math.min(240, Math.max(1, parseInt(v, 10) || 0));
                    update((prev) => ({
                      ...prev,
                      workoutMinutes: n,
                      workoutSessions: [createManualSession(n)],
                    }));
                  }
                }}
                className="w-16 rounded-lg border-0 bg-transparent px-1 py-0 text-gray-800 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </label>
          </div>
          {sessions.length > 0 && (
            <div className="mt-3 rounded-xl border border-border bg-white/70 p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Workouts logged ({sessions.length})
              </p>
              <ul className="space-y-1.5">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-gray-700">
                      {session.label}
                      {session.discipline ? ` (${session.discipline})` : ""}
                    </span>
                    <span className="text-muted">{session.durationMinutes} min</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.workoutMinutes != null && (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({
                  ...prev,
                  workoutMinutes: null,
                  workoutSessions: [],
                }))
              }
              className="mt-2 text-sm text-muted hover:text-gray-800"
            >
              Clear
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
