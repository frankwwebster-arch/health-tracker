"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DayData,
  GeneratedWorkout,
  WorkoutCoachBlockKind,
  WorkoutCoachPostLog,
} from "@/types";
import { getAdjacentDateKey, getDateKey } from "@/types";
import { generateWorkout } from "@/lib/workout-coach/generate";
import {
  computeFlags,
  decideWorkout,
  SUGGESTED_WEEKLY_CARDIO_RIDES,
} from "@/lib/workout-coach/decision-engine";
import {
  hasSwimToday,
  isSwimPelotonSession,
  lastWorkoutTypeLabel,
} from "@/lib/workout-coach/peloton";
import { signalTimerEnd } from "@/lib/workout-coach/timer-sfx";
import { QuickTimers } from "./QuickTimers";
import { getDayData } from "@/db";
import { useSettings } from "@/hooks/useTodayData";
import { kbWeightLabel } from "@/lib/workout-coach/exercise-catalog";
import { nextExtraPushSuggestion } from "@/lib/workout-coach/stretch-suggestions";

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
  const { settings, setSettings } = useSettings();
  const coach = data.workoutCoach ?? {};
  const workout = coach.workout ?? null;
  const postLog = coach.postLog ?? null;
  const isToday = dateKey === getDateKey();

  const [yesterdayData, setYesterdayData] = useState<DayData | null>(null);
  const [last30Days, setLast30Days] = useState<{ dateKey: string; data: DayData }[]>([]);
  const [showStrengthInstead, setShowStrengthInstead] = useState(false);

  const last7Days = useMemo(() => last30Days.slice(0, 7), [last30Days]);

  useEffect(() => {
    const y = getAdjacentDateKey(dateKey, -1);
    getDayData(y).then(setYesterdayData);
  }, [dateKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows: { dateKey: string; data: DayData }[] = [];
      for (let i = 0; i < 30; i++) {
        const k = getAdjacentDateKey(dateKey, -i);
        const d = await getDayData(k);
        rows.push({ dateKey: k, data: d });
      }
      if (!cancelled) setLast30Days(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const decision = useMemo(
    () =>
      decideWorkout({
        today: data,
        yesterday: yesterdayData,
        last7Days,
        last30Days,
        preferLowEnergyToggle: coach.preferLowEnergy ?? false,
      }),
    [data, yesterdayData, last7Days, last30Days, coach.preferLowEnergy]
  );

  const flags = useMemo(
    () =>
      computeFlags({
        today: data,
        yesterday: yesterdayData,
        last7Days,
        last30Days,
        preferLowEnergyToggle: coach.preferLowEnergy ?? false,
      }),
    [data, yesterdayData, last7Days, last30Days, coach.preferLowEnergy]
  );

  useEffect(() => {
    setShowStrengthInstead(false);
  }, [decision.outcome, dateKey]);

  const lastType = lastWorkoutTypeLabel(data);

  const canTrainStrength =
    decision.outcome === "no_workout"
      ? false
      : decision.outcome === "strength" ||
        decision.outcome === "consecutive_training_warning" ||
        (decision.outcome === "bootcamp_suggestion" && showStrengthInstead);

  const showBootcampCard = decision.outcome === "bootcamp_suggestion" && !showStrengthInstead;

  const setCoach = useCallback(
    (patch: Partial<NonNullable<DayData["workoutCoach"]>>) => {
      update((prev) => ({
        ...prev,
        workoutCoach: { ...prev.workoutCoach, ...patch },
      }));
    },
    [update]
  );

  const toggleSwim = useCallback(() => {
    const manualSwimId = `manual-swim-${dateKey}`;
    update((prev) => {
      const sessions = [...(prev.workoutSessions ?? [])];
      const manualIdx = sessions.findIndex((s) => s.id === manualSwimId);
      const hadManualSession = manualIdx >= 0;
      const flagOn = prev.workoutCoach?.swimToday === true;

      if (hadManualSession || flagOn) {
        const nextSessions = sessions.filter((s) => s.id !== manualSwimId);
        return {
          ...prev,
          workoutSessions: nextSessions.length ? nextSessions : undefined,
          workoutCoach: { ...prev.workoutCoach, swimToday: false },
        };
      }

      const alreadyHasSwimSession = sessions.some(isSwimPelotonSession);
      if (alreadyHasSwimSession) {
        return {
          ...prev,
          workoutCoach: { ...prev.workoutCoach, swimToday: true },
        };
      }

      if (!sessions.some((s) => s.id === manualSwimId)) {
        sessions.push({
          id: manualSwimId,
          discipline: "Swim",
          title: "Swim",
          durationMinutes: 0,
        });
      }
      return {
        ...prev,
        workoutSessions: sessions,
        workoutCoach: { ...prev.workoutCoach, swimToday: true },
      };
    });
  }, [dateKey, update]);

  const handleGenerate = async () => {
    if (!settings) return;
    const recoveryMode = decision.outcome === "consecutive_training_warning";
    const result = generateWorkout({
      today: data,
      yesterday: yesterdayData,
      preferShort: recoveryMode || (coach.preferShort ?? false),
      preferLowEnergy: recoveryMode || (coach.preferLowEnergy ?? false),
      recoveryMode,
      savedExercises: settings.workoutCoachSavedExercises ?? [],
      rotation: settings.workoutCoachRotation,
    });
    setCoach({
      workout: result.workout,
      postLog: null,
      ...(recoveryMode ? { preferShort: true, preferLowEnergy: true } : {}),
    });
    await setSettings({ ...settings, workoutCoachRotation: result.rotation });
  };

  const handleClearWorkout = () => {
    setCoach({ workout: null });
  };

  const toggleShort = () => setCoach({ preferShort: !coach.preferShort });
  const toggleLow = () => setCoach({ preferLowEnergy: !coach.preferLowEnergy });

  const handleApplySuggestion = () => {
    if (decision.outcome === "strength") {
      setCoach({
        preferShort: decision.preferShort,
        preferLowEnergy: decision.preferLowEnergy,
      });
    }
    if (decision.outcome === "consecutive_training_warning") {
      setCoach({
        preferShort: true,
        preferLowEnergy: true,
      });
    }
  };

  return (
    <div className="pb-40">
      {/* Coach decision */}
      <section className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-card">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Coach says
        </h2>
        <p className="text-lg font-semibold text-gray-900 leading-snug">{decision.headline}</p>
        {decision.subline && (
          <p className="text-sm text-muted mt-2 leading-relaxed">{decision.subline}</p>
        )}
        {(decision.outcome === "strength" || decision.outcome === "consecutive_training_warning") && (
          <button
            type="button"
            onClick={handleApplySuggestion}
            className="mt-4 min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-accent text-accent hover:bg-accent-soft/60"
          >
            Use these session toggles (short / low energy)
          </button>
        )}
        {isToday && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <p className="text-xs font-semibold text-muted uppercase">Quick inputs</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCoach({ golfToday: !coach.golfToday })}
                className={`min-h-[44px] px-3 rounded-xl text-sm font-medium border ${
                  coach.golfToday ? "bg-accent text-white border-accent" : "border-border bg-white"
                }`}
              >
                Golf today
              </button>
              <button
                type="button"
                onClick={() => setCoach({ manualBootcampToday: !coach.manualBootcampToday })}
                className={`min-h-[44px] px-3 rounded-xl text-sm font-medium border ${
                  coach.manualBootcampToday ? "bg-accent text-white border-accent" : "border-border bg-white"
                }`}
              >
                I already did a bootcamp
              </button>
              <button
                type="button"
                onClick={toggleSwim}
                className={`min-h-[44px] px-3 rounded-xl text-sm font-medium border ${
                  hasSwimToday(data) ? "bg-accent text-white border-accent" : "border-border bg-white"
                }`}
              >
                Swim
              </button>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Sleep (optional)</p>
              <div className="flex flex-wrap gap-2">
                {(["good", "ok", "poor"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setCoach({
                        sleepQuality: coach.sleepQuality === s ? undefined : s,
                      })
                    }
                    className={`min-h-[40px] px-3 rounded-lg text-sm capitalize border ${
                      coach.sleepQuality === s ? "bg-gray-800 text-white border-gray-800" : "border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Walking load (optional — auto from steps if unset)</p>
              <div className="flex flex-wrap gap-2">
                {(["low", "medium", "high"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setCoach({
                        stepLevel: coach.stepLevel === s ? undefined : s,
                      })
                    }
                    className={`min-h-[40px] px-3 rounded-lg text-sm capitalize border ${
                      coach.stepLevel === s ? "bg-gray-800 text-white border-gray-800" : "border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {data.stepsCount != null && (
                <p className="text-xs text-muted mt-1">Steps today: {data.stepsCount.toLocaleString()}</p>
              )}
            </div>
          </div>
        )}
        {isToday && (
          <p className="text-xs text-muted mt-4 pt-3 border-t border-border leading-relaxed">
            <span className="text-gray-700">
              Peloton rides (last 7 days): {flags.pelotonRidesThisWeek} —{" "}
              {flags.weeklyCardioRidesTargetMet
                ? `${SUGGESTED_WEEKLY_CARDIO_RIDES}/${SUGGESTED_WEEKLY_CARDIO_RIDES} suggested cardio from rides met ✅ (more is fine)`
                : `toward ${SUGGESTED_WEEKLY_CARDIO_RIDES}/week suggested cardio`}
            </span>
            <br />
            Bootcamp days (7d): {flags.bootcampsThisWeek} · Training streak:{" "}
            {flags.consecutiveTrainingDays}d
            {flags.swimToday ? " · Swim: yes" : ""} · Yesterday: {flags.lastWorkoutTypeYesterday}
            {lastType ? ` · Today Peloton: ${lastType}` : ""}
          </p>
        )}
      </section>

      {showBootcampCard && decision.outcome === "bootcamp_suggestion" && (
        <section className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft/30 p-4">
          <p className="text-sm text-gray-800">
            <span className="font-semibold">On the bike:</span> aim for a{" "}
            <strong>{decision.durationMinutes} min</strong> bootcamp-style class. You can still
            switch to home strength below.
          </p>
          <button
            type="button"
            onClick={() => setShowStrengthInstead(true)}
            className="mt-3 text-sm font-semibold text-accent underline"
          >
            I&apos;ll train at home instead →
          </button>
        </section>
      )}

      {/* Strength session controls */}
      {canTrainStrength && (
        <section className="mb-8 space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Home strength
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

      {/* Section 3 — Workout + block timers */}
      {workout && canTrainStrength && (
        <section className="mb-8 space-y-6">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Your workout
          </h2>
          {workout.stretchGoal && (
            <p className="text-sm text-gray-700 border-l-4 border-accent pl-3 py-1">
              Extra: {workout.stretchGoal}
            </p>
          )}
          {workout.blocks.map((block, idx) => (
            <BlockCard
              key={block.id}
              block={block}
              index={idx}
              total={workout.blocks.length}
              preferLowEnergy={
                (coach.preferLowEnergy ?? false) ||
                decision.outcome === "consecutive_training_warning"
              }
            />
          ))}
        </section>
      )}

      {/* Section 4 — Post log */}
      {canTrainStrength && workout && (
        <PostWorkoutForm
          postLog={postLog}
          onSave={(log) => setCoach({ postLog: log })}
        />
      )}

      <QuickTimers />
    </div>
  );
}

function BlockExtraPushRow({
  blockKind,
  preferLowEnergy,
}: {
  blockKind: WorkoutCoachBlockKind;
  preferLowEnergy: boolean;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const [last, setLast] = useState<string | undefined>(undefined);
  const kbHint = kbWeightLabel(preferLowEnergy);

  const handleExtraPush = () => {
    const line = nextExtraPushSuggestion(blockKind, { avoid: last, kbHint });
    setLast(line);
    setHint(line);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/80">
      <button
        type="button"
        onClick={handleExtraPush}
        className="w-full min-h-[44px] rounded-xl border border-dashed border-accent/50 bg-accent-soft/40 text-accent font-semibold text-sm hover:bg-accent-soft/70 transition-colors"
      >
        Extra Push
      </button>
      {hint && (
        <p className="mt-2 text-sm text-gray-800 font-medium leading-snug rounded-xl bg-gray-50 px-3 py-2 border border-border">
          {hint}
        </p>
      )}
      {hint && (
        <button
          type="button"
          onClick={handleExtraPush}
          className="mt-2 text-sm text-muted hover:text-gray-800 underline"
        >
          Another idea
        </button>
      )}
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  preferLowEnergy,
}: {
  block: GeneratedWorkout["blocks"][0];
  index: number;
  total: number;
  preferLowEnergy: boolean;
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
      <BlockExtraPushRow blockKind={block.kind} preferLowEnergy={preferLowEnergy} />
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
