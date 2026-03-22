"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DayData } from "@/types";
import { DoneWithUndoAction } from "./DoneWithUndoAction";

type UpdateFn = (prev: DayData) => DayData;

const SWIM_PRESETS = [20, 30, 45, 60] as const;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
  dateKey: string;
}

function pelotonSumFrom(prev: DayData): number {
  return (prev.workoutSessions ?? []).reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
}

export function MovementSection({ data, update, dateKey }: Props) {
  const [pelotonSyncing, setPelotonSyncing] = useState(false);
  const [pelotonMessage, setPelotonMessage] = useState<string | null>(null);
  const [pendingDeleteWorkout, setPendingDeleteWorkout] = useState(false);
  const [swimModalOpen, setSwimModalOpen] = useState(false);
  const [otherModalOpen, setOtherModalOpen] = useState(false);

  const sessions = data.workoutSessions ?? [];
  const hasSessions = sessions.length > 0;
  const pelotonTotalMinutes = hasSessions
    ? sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
    : 0;

  /**
   * Coach-only minutes in `workoutMinutes`: Peloton aggregate is stored separately in sessions;
   * remainder is coach / manual coach entry.
   */
  const manualWorkoutMinutesForUi: number | null = !hasSessions
    ? data.workoutMinutes
    : data.workoutMinutes == null
      ? null
      : (() => {
          const remainder = data.workoutMinutes - pelotonTotalMinutes;
          return remainder > 0 ? remainder : null;
        })();

  const isCustom = manualWorkoutMinutesForUi != null && manualWorkoutMinutesForUi > 0;

  const golfOn = data.workoutCoach?.golfToday === true;
  const swimMin = data.manualSwimMinutes ?? null;
  const otherAct = data.manualOtherActivity ?? null;

  const hasPhaseAMovement =
    golfOn ||
    (swimMin != null && swimMin > 0) ||
    otherAct != null;

  const hasSavedWorkout =
    data.workoutMinutes != null || hasSessions || hasPhaseAMovement;

  const hasCoachPostLog = data.workoutCoach?.postLog != null;
  const hasManualWorkoutEntry = !hasSessions
    ? data.workoutMinutes != null
    : manualWorkoutMinutesForUi != null;
  const hasPlatformWorkoutToDelete = hasManualWorkoutEntry || hasCoachPostLog;

  useEffect(() => {
    if (!hasPlatformWorkoutToDelete) setPendingDeleteWorkout(false);
  }, [hasPlatformWorkoutToDelete]);

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

  const toggleGolf = () => {
    update((prev) => ({
      ...prev,
      workoutCoach: {
        ...prev.workoutCoach,
        golfToday: !prev.workoutCoach?.golfToday,
      },
    }));
  };

  const clearSwim = () => {
    update((prev) => ({
      ...prev,
      manualSwimMinutes: null,
      workoutCoach: {
        ...prev.workoutCoach,
        swimToday: false,
      },
    }));
  };

  const clearOther = () => {
    update((prev) => ({
      ...prev,
      manualOtherActivity: null,
    }));
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
            hasSavedWorkout ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
          }`}
        >
          <p className="font-medium text-gray-800 mb-3">Workout</p>

          {/* Phase A — Golf / Swim / Other */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleGolf}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                golfOn
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "bg-white/80 text-gray-600 border-border hover:bg-white"
              }`}
            >
              {golfOn ? "Golf (selected)" : "Golf"}
            </button>
            <button
              type="button"
              onClick={() => setSwimModalOpen(true)}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                swimMin != null && swimMin > 0
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "bg-white/80 text-gray-600 border-border hover:bg-white"
              }`}
            >
              {swimMin != null && swimMin > 0 ? `Swim (${swimMin} min)` : "Swim"}
            </button>
            <button
              type="button"
              onClick={() => setOtherModalOpen(true)}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                otherAct != null
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "bg-white/80 text-gray-600 border-border hover:bg-white"
              }`}
            >
              {otherAct != null ? `Other (${otherAct.name})` : "Other"}
            </button>
          </div>

          {/* Workout Coach minutes (separate from Phase A) */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label
              className={`flex min-w-0 flex-1 items-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                isCustom
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "border-border bg-white/80 hover:bg-white"
              }`}
            >
              <span className={isCustom ? "text-white/90 shrink-0" : "text-muted shrink-0"}>Coach:</span>
              <input
                type="number"
                min={1}
                max={240}
                placeholder="min"
                value={manualWorkoutMinutesForUi != null ? manualWorkoutMinutesForUi : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    update((prev) => {
                      const pts = pelotonSumFrom(prev);
                      const hasPel = (prev.workoutSessions ?? []).length > 0;
                      return {
                        ...prev,
                        workoutMinutes: hasPel ? (pts > 0 ? pts : null) : null,
                      };
                    });
                  } else {
                    const n = Math.min(240, Math.max(1, parseInt(v, 10) || 0));
                    update((prev) => {
                      const pts = pelotonSumFrom(prev);
                      const hasPel = (prev.workoutSessions ?? []).length > 0;
                      return {
                        ...prev,
                        workoutMinutes: hasPel ? pts + n : n,
                      };
                    });
                  }
                }}
                className={`min-w-0 w-16 rounded-lg border-0 bg-transparent px-1 py-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isCustom ? "text-white placeholder:text-white/60" : "text-gray-800 placeholder:text-muted"}`}
              />
            </label>
            {hasPlatformWorkoutToDelete && !pendingDeleteWorkout && (
              <button
                type="button"
                onClick={() => setPendingDeleteWorkout(true)}
                className="shrink-0 min-h-[44px] px-3 rounded-xl text-sm font-medium text-red-700 hover:text-red-900 hover:bg-red-50 border border-red-200"
              >
                Delete
              </button>
            )}
          </div>

          {/* Phase A activity lines (Coach row above; Peloton below) */}
          {(golfOn || (swimMin != null && swimMin > 0) || otherAct != null) && (
            <ul className="mt-3 space-y-2 text-sm">
              {golfOn && (
                <li className="text-gray-800">
                  <span className="font-semibold text-gray-900">Golf</span>
                </li>
              )}
              {swimMin != null && swimMin > 0 && (
                <li className="flex flex-wrap items-center gap-2 text-gray-800">
                  <span>
                    <span className="font-semibold text-gray-900">Swim:</span> {swimMin} min
                  </span>
                  <button
                    type="button"
                    onClick={clearSwim}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Clear
                  </button>
                </li>
              )}
              {otherAct != null && (
                <li className="flex flex-wrap items-center gap-2 text-gray-800">
                  <span>
                    <span className="font-semibold text-gray-900">{otherAct.name}:</span>{" "}
                    {otherAct.minutes} min
                  </span>
                  <button
                    type="button"
                    onClick={clearOther}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Clear
                  </button>
                </li>
              )}
            </ul>
          )}

          {hasSessions && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                From Peloton
              </p>
              <div className="space-y-2">
                {(data.workoutSessions ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl px-4 py-2.5 min-h-[44px] flex flex-col justify-center bg-accent text-white border border-accent shadow-sm text-sm font-medium"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">
                        {s.discipline ? s.discipline.replace(/^./, (c) => c.toUpperCase()) : "Workout"}
                      </span>
                      <span className="text-white/90 shrink-0 tabular-nums">{s.durationMinutes} min</span>
                    </div>
                    {(s.title || s.instructor) && (
                      <p className="mt-1 text-white/80 text-xs font-normal leading-snug">
                        {[s.title, s.instructor].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasPlatformWorkoutToDelete && pendingDeleteWorkout && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-amber-800 font-medium">Delete this workout?</span>
              <button
                type="button"
                onClick={() => {
                  update((prev) => {
                    const sess = prev.workoutSessions ?? [];
                    const pelotonSum = sess.reduce(
                      (sum, s) => sum + (s.durationMinutes ?? 0),
                      0
                    );
                    const keepPeloton = sess.length > 0 && pelotonSum > 0;
                    return {
                      ...prev,
                      workoutMinutes: keepPeloton ? pelotonSum : null,
                      workoutCoach: {
                        ...prev.workoutCoach,
                        postLog: null,
                      },
                    };
                  });
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
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
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

        <SwimModal
          open={swimModalOpen}
          initialMinutes={swimMin}
          onClose={() => setSwimModalOpen(false)}
          onSave={(minutes) => {
            update((prev) => ({
              ...prev,
              manualSwimMinutes: minutes,
              workoutCoach: {
                ...prev.workoutCoach,
                swimToday: minutes > 0,
              },
            }));
            setSwimModalOpen(false);
          }}
        />
        <OtherActivityModal
          open={otherModalOpen}
          initial={otherAct}
          onClose={() => setOtherModalOpen(false)}
          onSave={(entry) => {
            update((prev) => ({
              ...prev,
              manualOtherActivity: entry,
            }));
            setOtherModalOpen(false);
          }}
        />

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

function SwimModal({
  open,
  initialMinutes,
  onClose,
  onSave,
}: {
  open: boolean;
  initialMinutes: number | null;
  onClose: () => void;
  onSave: (minutes: number) => void;
}) {
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (open) {
      setCustom(
        initialMinutes != null && !SWIM_PRESETS.includes(initialMinutes as (typeof SWIM_PRESETS)[number])
          ? String(initialMinutes)
          : ""
      );
    }
  }, [open, initialMinutes]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swim-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl">
        <p id="swim-modal-title" className="font-semibold text-gray-900 mb-3">
          Swim duration (minutes)
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {SWIM_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSave(m)}
              className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-slate-100 text-gray-800 border border-slate-200 hover:bg-slate-200"
            >
              {m}
            </button>
          ))}
        </div>
        <label className="block text-sm text-muted mb-1">Custom</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={1}
            max={240}
            placeholder="min"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="flex-1 min-h-[44px] rounded-xl border border-border px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const n = Math.min(240, Math.max(1, parseInt(custom, 10) || 0));
              if (n > 0) onSave(n);
            }}
            className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-accent text-white"
          >
            Save
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full min-h-[44px] rounded-xl text-sm font-medium border border-border text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function OtherActivityModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: { name: string; minutes: number } | null;
  onClose: () => void;
  onSave: (entry: { name: string; minutes: number }) => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setMinutes(initial != null ? String(initial.minutes) : "");
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="other-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl">
        <p id="other-modal-title" className="font-semibold text-gray-900 mb-3">
          Other activity
        </p>
        <label className="block text-sm text-muted mb-1">Activity name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tennis"
          className="w-full min-h-[44px] rounded-xl border border-border px-3 text-sm mb-3"
        />
        <label className="block text-sm text-muted mb-1">Minutes</label>
        <input
          type="number"
          min={1}
          max={240}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="min"
          className="w-full min-h-[44px] rounded-xl border border-border px-3 text-sm mb-3"
        />
        <button
          type="button"
          onClick={() => {
            const m = Math.min(240, Math.max(1, parseInt(minutes, 10) || 0));
            const trimmed = name.trim();
            if (trimmed && m > 0) onSave({ name: trimmed, minutes: m });
          }}
          className="w-full min-h-[44px] rounded-xl text-sm font-semibold bg-accent text-white mb-2"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl text-sm font-medium border border-border text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
