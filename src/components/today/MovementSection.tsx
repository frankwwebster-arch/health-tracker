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

export function MovementSection({ data, update, dateKey }: Props) {
  const [pelotonSyncing, setPelotonSyncing] = useState(false);
  const [pelotonMessage, setPelotonMessage] = useState<string | null>(null);
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

  const coachEntries = data.coachWorkoutEntries ?? [];
  const hasCoachEntries = coachEntries.length > 0;
  const hasCoachPostLog = data.workoutCoach?.postLog != null;
  /** Saved Workout Coach duration — read-only on Today (from post-log or coach portion of day total). */
  const coachMinutesReadOnly: number | null =
    data.workoutCoach?.postLog?.garminDurationMin ?? manualWorkoutMinutesForUi ?? null;
  const showLegacyCoachMovement = !hasCoachEntries && (hasCoachPostLog || coachMinutesReadOnly != null);

  const golfOn = data.workoutCoach?.golfToday === true;
  const swimMin = data.manualSwimMinutes ?? null;
  const otherAct = data.manualOtherActivity ?? null;

  const hasPhaseAMovement =
    golfOn ||
    (swimMin != null && swimMin > 0) ||
    otherAct != null;

  const hasSavedWorkout =
    data.workoutMinutes != null || hasSessions || hasPhaseAMovement || hasCoachEntries;

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

  const deleteCoachEntry = (entryId: string) => {
    update((prev) => {
      const currentEntries = prev.coachWorkoutEntries ?? [];
      const removed = currentEntries.find((x) => x.id === entryId);
      const nextEntries = currentEntries.filter((x) => x.id !== entryId);
      const removedMinutes = removed?.minutes ?? 0;
      const nextWorkoutMinutes =
        prev.workoutMinutes == null
          ? null
          : Math.max(0, prev.workoutMinutes - removedMinutes);
      return {
        ...prev,
        workoutMinutes: nextWorkoutMinutes === 0 ? null : nextWorkoutMinutes,
        coachWorkoutEntries: nextEntries,
      };
    });
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
              Golf
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
              {otherAct != null
                ? `${otherAct.name} (${otherAct.minutes} min)`
                : "Other"}
            </button>
          </div>

          {/* Workout Coach entries — saved sessions, each deletable independently */}
          {hasCoachEntries && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3 space-y-2">
              {coachEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-stretch gap-2 rounded-xl border border-emerald-800 bg-emerald-800 text-white text-sm shadow-sm overflow-hidden"
                >
                  <Link
                    href={`/coach/review/${entry.id}?date=${encodeURIComponent(dateKey)}`}
                    className="min-w-0 flex-1 block px-3 py-2.5 hover:bg-emerald-700/70 active:bg-emerald-700"
                    aria-label={`Open review for ${entry.label} workout ${entry.minutes} minutes`}
                  >
                    <p className="font-semibold">
                      {entry.label} · {entry.minutes} min
                    </p>
                    <p className="text-xs text-emerald-100">
                      Completed {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · Tap to review
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteCoachEntry(entry.id)}
                    className="m-2 shrink-0 min-h-[40px] px-3 rounded-lg text-xs font-semibold text-red-800 bg-white border border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Legacy single coach display fallback for older data entries. */}
          {showLegacyCoachMovement && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
              <div className="flex min-w-0 items-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium border border-border bg-white text-gray-800">
                <span className="text-muted shrink-0">Coach:</span>
                <span className="tabular-nums font-semibold text-gray-900" aria-label="Coach workout minutes">
                  {coachMinutesReadOnly != null ? `${coachMinutesReadOnly} min` : "—"}
                </span>
              </div>
            </div>
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
          onDelete={() => {
            update((prev) => ({
              ...prev,
              manualSwimMinutes: null,
              workoutCoach: {
                ...prev.workoutCoach,
                swimToday: false,
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
          onDelete={() => {
            update((prev) => ({
              ...prev,
              manualOtherActivity: null,
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
  onDelete,
}: {
  open: boolean;
  initialMinutes: number | null;
  onClose: () => void;
  onSave: (minutes: number) => void;
  onDelete: () => void;
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
        {initialMinutes != null && initialMinutes > 0 && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-3 w-full min-h-[44px] rounded-xl text-sm font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100"
          >
            Remove
          </button>
        )}
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
  onDelete,
}: {
  open: boolean;
  initial: { name: string; minutes: number } | null;
  onClose: () => void;
  onSave: (entry: { name: string; minutes: number }) => void;
  onDelete: () => void;
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
        {initial != null && (
          <button
            type="button"
            onClick={onDelete}
            className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 mb-2"
          >
            Remove
          </button>
        )}
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
