"use client";

import { useCallback, useEffect, useState } from "react";
import type { DayData, GeneratedWorkout, WorkoutCoachPostLog } from "@/types";
import { generateWorkout } from "@/lib/workout-coach/generate";
import {
  hasPelotonWorkoutToday,
  lastWorkoutTypeLabel,
  todayHasBootcampLike,
} from "@/lib/workout-coach/peloton";
import { signalTimerEnd } from "@/lib/workout-coach/timer-sfx";
import { QuickTimers } from "./QuickTimers";
import { getAdjacentDateKey } from "@/types";
import { getDayData } from "@/db";

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
  dateKey: string;
}

const REST_SEC = 75;

function formatMmSs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WorkoutCoachPanel({ data, update, dateKey }: Props) {
  const coach = data.workoutCoach ?? {};
  const workout = coach.workout ?? null;
  const postLog = coach.postLog ?? null;

  const [yesterdayData, setYesterdayData] = useState<DayData | null>(null);
  useEffect(() => {
    const y = getAdjacentDateKey(dateKey, -1);
    getDayData(y).then(setYesterdayData);
  }, [dateKey]);

  const pelotonDone = hasPelotonWorkoutToday(data);
  const lastType = lastWorkoutTypeLabel(data);
  const manualWorkout = data.workoutMinutes != null && data.workoutMinutes > 0;
  const bootcampNote = todayHasBootcampLike(data);

  const setCoach = useCallback(
    (patch: Partial<NonNullable<DayData["workoutCoach"]>>) => {
      update((prev) => ({
        ...prev,
        workoutCoach: { ...prev.workoutCoach, ...patch },
      }));
    },
    [update]
  );

  const handleGenerate = () => {
    const w = generateWorkout({
      today: data,
      yesterday: yesterdayData,
      preferShort: coach.preferShort ?? false,
      preferLowEnergy: coach.preferLowEnergy ?? false,
    });
    setCoach({ workout: w, postLog: null });
  };

  const handleClearWorkout = () => {
    setCoach({ workout: null });
  };

  const toggleShort = () => setCoach({ preferShort: !coach.preferShort });
  const toggleLow = () => setCoach({ preferLowEnergy: !coach.preferLowEnergy });

  return (
    <div className="pb-40">
      {/* Section 1 — Today status */}
      <section className="mb-8 rounded-2xl border border-border bg-white p-4 shadow-card">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Today
        </h2>
        {pelotonDone ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900">
              Exercise already completed today ✅
            </p>
            <p className="text-muted">No additional workout required.</p>
            {lastType && (
              <p className="text-sm text-gray-700">
                Last: <span className="font-medium">{lastType}</span>
                {bootcampNote && " · includes bootcamp-style"}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900">Ready to train</p>
            {manualWorkout && (
              <p className="text-sm text-amber-700">
                Movement logged today (not from Peloton). Coach below is optional.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Section 2 — Generate (hidden messaging when Peloton done but allow optional toggles for tomorrow prep - actually hide generate when peloton done) */}
      {!pelotonDone && (
        <section className="mb-8 space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Session
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleShort}
              className={`min-h-[48px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
                coach.preferShort
                  ? "bg-accent text-white border-accent"
                  : "bg-white border-border text-gray-800"
              }`}
            >
              Short (20–25 min)
            </button>
            <button
              type="button"
              onClick={toggleLow}
              className={`min-h-[48px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
                coach.preferLowEnergy
                  ? "bg-accent text-white border-accent"
                  : "bg-white border-border text-gray-800"
              }`}
            >
              Low energy
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full min-h-[56px] rounded-2xl bg-accent text-white text-lg font-semibold shadow-md active:scale-[0.99] transition-transform"
          >
            Generate workout
          </button>
          {workout && (
            <button
              type="button"
              onClick={handleClearWorkout}
              className="text-sm text-muted hover:text-gray-800"
            >
              Clear workout
            </button>
          )}
        </section>
      )}

      {pelotonDone && (
        <p className="text-sm text-muted mb-6 text-center">
          Peloton logged — open this tab tomorrow for a fresh session, or use quick timers anytime.
        </p>
      )}

      {/* Section 3 — Workout + block timers */}
      {workout && !pelotonDone && (
        <section className="mb-8 space-y-6">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Your workout
          </h2>
          {workout.stretchGoal && (
            <p className="text-sm text-gray-700 border-l-4 border-accent pl-3 py-1">
              Stretch: {workout.stretchGoal}
            </p>
          )}
          {workout.blocks.map((block, idx) => (
            <BlockCard
              key={block.id}
              block={block}
              index={idx}
              total={workout.blocks.length}
            />
          ))}
        </section>
      )}

      {/* Section 4 — Post log */}
      {!pelotonDone && workout && (
        <PostWorkoutForm
          postLog={postLog}
          onSave={(log) => setCoach({ postLog: log })}
        />
      )}

      <QuickTimers />
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
}: {
  block: GeneratedWorkout["blocks"][0];
  index: number;
  total: number;
}) {
  const [phase, setPhase] = useState<"idle" | "work" | "rest">("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerKey, setTimerKey] = useState(0);

  const workSeconds = block.minutes * 60;

  useEffect(() => {
    if (phase !== "work" && phase !== "rest") return;
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          signalTimerEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, timerKey]);

  useEffect(() => {
    if (secondsLeft > 0) return;
    if (phase === "work") {
      setPhase("rest");
      setSecondsLeft(REST_SEC);
      setTimerKey((k) => k + 1);
    } else if (phase === "rest") {
      setPhase("idle");
    }
  }, [secondsLeft, phase]);

  const handleStart = () => {
    setPhase("work");
    setSecondsLeft(workSeconds);
    setTimerKey((k) => k + 1);
  };

  const handleNextAfterRest = () => {
    setPhase("idle");
    setSecondsLeft(0);
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase">
            Block {index + 1} / {total}
          </p>
          <h3 className="text-base font-semibold text-gray-900 mt-1">{block.title}</h3>
        </div>
        {(phase === "work" || phase === "rest") && (
          <div className="text-3xl font-bold tabular-nums text-accent shrink-0">
            {formatMmSs(secondsLeft)}
          </div>
        )}
      </div>
      <ul className="space-y-2 mb-3">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium text-gray-900">{ex.name}</span>
            <span className="text-muted"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {block.coaching && (
        <p className="text-xs text-muted mb-3 border-t border-border pt-2">{block.coaching}</p>
      )}
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full min-h-[48px] rounded-xl bg-gray-900 text-white font-semibold"
        >
          Start block
        </button>
      )}
      {phase === "work" && <p className="text-sm font-medium text-accent text-center">Go</p>}
      {phase === "rest" && (
        <div className="space-y-2">
          <p className="text-sm text-center text-muted">Rest — then next block when ready</p>
          <button
            type="button"
            onClick={handleNextAfterRest}
            className="w-full min-h-[48px] rounded-xl border border-border font-semibold text-gray-800"
          >
            Rest done — next block
          </button>
        </div>
      )}
    </div>
  );
}

function PostWorkoutForm({
  postLog,
  onSave,
}: {
  postLog: WorkoutCoachPostLog | null;
  onSave: (log: WorkoutCoachPostLog) => void;
}) {
  const [rounds, setRounds] = useState(postLog?.roundsAmrap ?? "");
  const [topSet, setTopSet] = useState<boolean | null>(postLog?.topSet ?? null);
  const [notes, setNotes] = useState(postLog?.notes ?? "");
  const [cal, setCal] = useState(postLog?.garminCalories ?? "");
  const [hr, setHr] = useState(postLog?.garminAvgHr ?? "");
  const [dur, setDur] = useState(postLog?.garminDurationMin ?? "");
  const [mood, setMood] = useState<WorkoutCoachPostLog["mood"]>(postLog?.mood ?? null);
  const [energy, setEnergy] = useState<WorkoutCoachPostLog["energy"]>(postLog?.energy ?? null);

  const persist = () => {
    onSave({
      roundsAmrap: rounds === "" ? null : Number(rounds),
      topSet,
      notes: notes.trim() || undefined,
      garminCalories: cal === "" ? null : Number(cal),
      garminAvgHr: hr === "" ? null : Number(hr),
      garminDurationMin: dur === "" ? null : Number(dur),
      mood,
      energy,
    });
  };

  return (
    <section className="mb-8 rounded-2xl border border-border bg-white p-4 shadow-card">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
        Log (optional)
      </h2>
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-800">AMRAP rounds / notes</span>
          <input
            type="number"
            min={0}
            placeholder="Rounds"
            value={rounds === "" ? "" : rounds}
            onChange={(e) => setRounds(e.target.value === "" ? "" : e.target.value)}
            onBlur={persist}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
          />
        </label>
        <div className="flex gap-3 items-center">
          <span className="text-sm font-medium text-gray-800">Top set?</span>
          <button
            type="button"
            onClick={() => {
              setTopSet(true);
              onSave({
                ...postLog,
                topSet: true,
                roundsAmrap: rounds === "" ? null : Number(rounds),
                notes,
                garminCalories: cal === "" ? null : Number(cal),
                garminAvgHr: hr === "" ? null : Number(hr),
                garminDurationMin: dur === "" ? null : Number(dur),
                mood,
                energy,
              });
            }}
            className={`min-h-[44px] px-4 rounded-xl font-medium border ${
              topSet === true ? "bg-accent text-white border-accent" : "border-border"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setTopSet(false);
              onSave({
                ...postLog,
                topSet: false,
                roundsAmrap: rounds === "" ? null : Number(rounds),
                notes,
                garminCalories: cal === "" ? null : Number(cal),
                garminAvgHr: hr === "" ? null : Number(hr),
                garminDurationMin: dur === "" ? null : Number(dur),
                mood,
                energy,
              });
            }}
            className={`min-h-[44px] px-4 rounded-xl font-medium border ${
              topSet === false ? "bg-accent text-white border-accent" : "border-border"
            }`}
          >
            No
          </button>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={persist}
            rows={2}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
          />
        </label>
        <p className="text-xs font-semibold text-muted uppercase pt-2">Garmin (manual)</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block col-span-1">
            <span className="text-xs text-muted">Cal</span>
            <input
              type="number"
              min={0}
              placeholder="kcal"
              value={cal === "" ? "" : cal}
              onChange={(e) => setCal(e.target.value === "" ? "" : e.target.value)}
              onBlur={persist}
              className="mt-1 w-full rounded-xl border border-border px-2 py-2 text-sm"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs text-muted">Avg HR</span>
            <input
              type="number"
              min={0}
              placeholder="bpm"
              value={hr === "" ? "" : hr}
              onChange={(e) => setHr(e.target.value === "" ? "" : e.target.value)}
              onBlur={persist}
              className="mt-1 w-full rounded-xl border border-border px-2 py-2 text-sm"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs text-muted">Min</span>
            <input
              type="number"
              min={0}
              placeholder="min"
              value={dur === "" ? "" : dur}
              onChange={(e) => setDur(e.target.value === "" ? "" : e.target.value)}
              onBlur={persist}
              className="mt-1 w-full rounded-xl border border-border px-2 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-sm font-medium text-gray-800 w-full">Mood</span>
          {(["good", "flat", "tired"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMood(m);
                onSave({
                  ...postLog,
                  mood: m,
                  roundsAmrap: rounds === "" ? null : Number(rounds),
                  topSet,
                  notes,
                  garminCalories: cal === "" ? null : Number(cal),
                  garminAvgHr: hr === "" ? null : Number(hr),
                  garminDurationMin: dur === "" ? null : Number(dur),
                  energy,
                });
              }}
              className={`min-h-[44px] px-3 rounded-xl text-sm font-medium border capitalize ${
                mood === m ? "bg-accent text-white border-accent" : "border-border"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-800 w-full">Energy</span>
          {(["high", "ok", "low"] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setEnergy(e);
                onSave({
                  ...postLog,
                  energy: e,
                  roundsAmrap: rounds === "" ? null : Number(rounds),
                  topSet,
                  notes,
                  garminCalories: cal === "" ? null : Number(cal),
                  garminAvgHr: hr === "" ? null : Number(hr),
                  garminDurationMin: dur === "" ? null : Number(dur),
                  mood,
                });
              }}
              className={`min-h-[44px] px-3 rounded-xl text-sm font-medium border capitalize ${
                energy === e ? "bg-accent text-white border-accent" : "border-border"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
