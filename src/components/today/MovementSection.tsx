"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DayData } from "@/types";
import { DoneWithUndoAction } from "./DoneWithUndoAction";

type UpdateFn = (prev: DayData) => DayData;

const PRESET_MINS = [30, 45, 60] as const;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
  dateKey: string;
}

export function MovementSection({ data, update, dateKey }: Props) {
  const [pelotonSyncing, setPelotonSyncing] = useState(false);
  const [pelotonMessage, setPelotonMessage] = useState<string | null>(null);
  const [pendingDeleteWorkout, setPendingDeleteWorkout] = useState(false);
  const isPreset = data.workoutMinutes != null && PRESET_MINS.includes(data.workoutMinutes as (typeof PRESET_MINS)[number]);
  const isCustom = data.workoutMinutes != null && !isPreset;
  const hasSessions = (data.workoutSessions ?? []).length > 0;
  const hasSavedWorkout = data.workoutMinutes != null || hasSessions;

  useEffect(() => {
    if (!hasSavedWorkout) setPendingDeleteWorkout(false);
  }, [hasSavedWorkout]);

  const handleSyncFromPeloton = async () => {
    setPelotonSyncing(true);
    setPelotonMessage(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/peloton/workout?date=${dateKey}&timeZone=${encodeURIComponent(tz)}`);
      const json = await res.json();
      if (!res.ok) {
        setPelotonMessage(json.error ?? "Sync failed");
        return;
      }
      if (json.error) {
        setPelotonMessage(json.error);
        return;
      }
      if (json.workoutMinutes != null || (json.workoutSessions ?? []).length > 0) {
        update((prev) => ({
          ...prev,
          workoutMinutes: json.workoutMinutes ?? prev.workoutMinutes,
          workoutSessions: json.workoutSessions ?? prev.workoutSessions,
        }));
        setPelotonMessage(
          json.workoutSessions?.length
            ? `Imported ${json.workoutSessions.length} workout(s)`
            : "No workouts for this date"
        );
      } else {
        setPelotonMessage(json.error ?? "No workouts for this date");
      }
    } catch (e) {
      setPelotonMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setPelotonSyncing(false);
      setTimeout(() => setPelotonMessage(null), 4000);
    }
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
          Movement
        </h2>
        <Link
          href="/coach"
          className="text-sm font-semibold text-accent hover:underline min-h-[44px] inline-flex items-center"
        >
          Workout Coach →
        </Link>
      </div>
      <div className="space-y-3">
        <div
          className={`rounded-2xl border p-4 shadow-card hover:shadow-card-hover transition-shadow ${
            data.workoutMinutes != null ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
          }`}
        >
          <p className="font-medium text-gray-800 mb-3">Workout</p>
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
                        update((prev) => ({ ...prev, workoutMinutes: mins }));
                      } else {
                        update((prev) => ({ ...prev, workoutMinutes: null }));
                      }
                    }}
                    className="sr-only"
                  />
                  {mins} min
                </label>
              );
            })}
            <label
              className={`flex items-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                isCustom
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "border-border bg-white/80 hover:bg-white"
              }`}
            >
              <span className={isCustom ? "text-white/90 shrink-0" : "text-muted shrink-0"}>Other:</span>
              <input
                type="number"
                min={1}
                max={240}
                placeholder="min"
                value={isCustom && data.workoutMinutes != null ? data.workoutMinutes : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    update((prev) => ({ ...prev, workoutMinutes: null }));
                  } else {
                    const n = Math.min(240, Math.max(1, parseInt(v, 10) || 0));
                    update((prev) => ({ ...prev, workoutMinutes: n }));
                  }
                }}
                className={`w-16 rounded-lg border-0 bg-transparent px-1 py-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isCustom ? "text-white placeholder:text-white/60" : "text-gray-800 placeholder:text-muted"}`}
              />
            </label>
          </div>
          {hasSessions && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                From Peloton
              </p>
              <div className="space-y-2">
                {(data.workoutSessions ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl px-3 py-2.5 bg-white/80 border border-border/60 text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">
                        {s.discipline ? s.discipline.replace(/^./, (c) => c.toUpperCase()) : "Workout"}
                      </span>
                      <span className="text-muted shrink-0">{s.durationMinutes} min</span>
                    </div>
                    {(s.title || s.instructor) && (
                      <p className="mt-1 text-muted text-xs leading-snug">
                        {[s.title, s.instructor].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasSavedWorkout &&
              (pendingDeleteWorkout ? (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <span className="text-sm text-amber-800 font-medium">Remove this workout from the day?</span>
                  <button
                    type="button"
                    onClick={() => {
                      update((prev) => ({
                        ...prev,
                        workoutMinutes: null,
                        workoutSessions: undefined,
                        // Workout Coach completion is stored on `workoutCoach.postLog`; clearing
                        // minutes/sessions alone leaves postLog set, so the coach still shows
                        // "Done for today" until this is cleared (see decision-engine strengthDoneToday).
                        workoutCoach: {
                          ...prev.workoutCoach,
                          postLog: null,
                        },
                      }));
                      setPendingDeleteWorkout(false);
                    }}
                    className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:scale-[0.99]"
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteWorkout(false)}
                    className="min-h-[44px] px-4 rounded-xl text-sm font-medium border border-border bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDeleteWorkout(true)}
                  className="min-h-[44px] px-3 rounded-xl text-sm font-medium text-red-700 hover:text-red-900 hover:bg-red-50 border border-red-200"
                >
                  Delete workout
                </button>
              ))}
            <button
              type="button"
              onClick={handleSyncFromPeloton}
              disabled={pelotonSyncing}
              className="text-sm font-medium text-accent hover:text-accent/80 disabled:opacity-50"
            >
              {pelotonSyncing ? "Syncing…" : "Sync from Peloton"}
            </button>
            {pelotonMessage && (
              <span className={`text-sm ${pelotonMessage.startsWith("Imported") ? "text-accent" : "text-amber-600"}`}>
                {pelotonMessage}
              </span>
            )}
          </div>
        </div>
        <div
          className={`rounded-2xl border p-4 shadow-card hover:shadow-card-hover transition-shadow ${
            data.walkDone ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Walk / steps done</p>
              <p className="text-sm text-muted">
                {data.walkDone ? "Done" : "Not yet"}
              </p>
            </div>
            {data.walkDone ? (
              <DoneWithUndoAction
                onUndo={() =>
                  update((prev) => ({ ...prev, walkDone: false }))
                }
              />
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
