"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayData, GeneratedWorkout, WorkoutCoachPostLog } from "@/types";
import { getAdjacentDateKey, getDateKey } from "@/types";
import { generateWorkout } from "@/lib/workout-coach/generate";
import { computeFlags, decideWorkout } from "@/lib/workout-coach/decision-engine";
import {
  hasSwimToday,
  isSwimPelotonSession,
  lastWorkoutTypeLabel,
} from "@/lib/workout-coach/peloton";
import { QuickTimersBar } from "./QuickTimers";
import { getDayData } from "@/db";
import { useSettings } from "@/hooks/useTodayData";
import {
  getCoachStatusTone,
  STATUS_CARD_STYLES,
  statusIconEmoji,
} from "@/components/workout-coach/coach-status-ui";
import { CollapsedBlock, WorkoutBlockRunner } from "@/components/workout-coach/workout-block-runner";
import { WorkoutBlocksPreview } from "@/components/workout-coach/WorkoutBlocksPreview";
import { createDefaultWarmupBlock } from "@/lib/workout-coach/generate";

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
  dateKey: string;
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
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [workoutSessionEnded, setWorkoutSessionEnded] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

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

  useEffect(() => {
    if (workout?.generatedAt != null) {
      setActiveBlockIndex(0);
      setWorkoutSessionEnded(false);
      setSessionStarted(false);
    }
  }, [workout?.generatedAt]);

  useEffect(() => {
    if (!workout) {
      setSessionStarted(false);
      setActiveBlockIndex(0);
      setWorkoutSessionEnded(false);
    }
  }, [workout]);

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

  const statusTone = getCoachStatusTone(decision, coach.preferLowEnergy ?? false);

  /** Strength workouts always include warm-up; older saved plans may omit it — prepend for display. */
  const blocksForSession = useMemo(() => {
    if (!workout) return [];
    if (workout.blocks[0]?.kind === "warmup") return workout.blocks;
    return [createDefaultWarmupBlock(), ...workout.blocks];
  }, [workout]);

  const workoutTotalMin = useMemo(
    () => blocksForSession.reduce((sum, b) => sum + b.minutes, 0),
    [blocksForSession]
  );
  /** Hide Generate / toggles whenever a workout exists (preview or in progress; timers stay). */
  const minimalThumbDock = workout != null;

  /** Scroll padding — smaller thumb dock when workout exists (timers only). */
  const scrollPad = isToday
    ? minimalThumbDock
      ? "pb-[calc(14rem+env(safe-area-inset-bottom))]"
      : "pb-[calc(30rem+env(safe-area-inset-bottom))]"
    : "pb-10";

  const handleBlockFinished = () => {
    if (!workout) return;
    if (activeBlockIndex < blocksForSession.length - 1) {
      setActiveBlockIndex((i) => i + 1);
    } else {
      setWorkoutSessionEnded(true);
    }
  };

  const handleSaveWorkout = () => {
    setCoach({ workout: null, postLog: {} });
    setWorkoutSessionEnded(false);
    setActiveBlockIndex(0);
    setSessionStarted(false);
  };

  const handleDiscardWorkout = () => {
    setCoach({ workout: null, postLog: null });
    setWorkoutSessionEnded(false);
    setActiveBlockIndex(0);
    setSessionStarted(false);
  };

  return (
    <div className="relative min-h-[100dvh] w-full max-w-md mx-auto touch-manipulation">
      {/* Upper zone: status + read-only context — scrolls; primary taps live in fixed dock */}
      <div
        className={`overflow-y-auto overscroll-y-contain px-3 pt-2 space-y-4 min-w-0 max-w-full ${scrollPad}`}
      >
        {/* 1 — Status only (no actions — thumb zone is the dock) */}
        <section
          className={`sticky top-0 z-20 rounded-2xl border-2 p-4 sm:p-5 ${STATUS_CARD_STYLES[statusTone]} shadow-md`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none shrink-0 select-none" aria-hidden>
              {statusIconEmoji(statusTone)}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Today</p>
              <h1 className="text-lg sm:text-xl font-extrabold leading-snug">{decision.headline}</h1>
            </div>
          </div>
        </section>

      {showBootcampCard && decision.outcome === "bootcamp_suggestion" && (
        <section className="rounded-2xl border-2 border-sky-200 bg-sky-50/80 p-4 text-sky-950 space-y-3">
          <p className="text-sm font-bold">~{decision.durationMinutes} min bike</p>
          <button
            type="button"
            onClick={() => setShowStrengthInstead(true)}
            className="w-full min-h-[52px] rounded-2xl border-2 border-sky-300 bg-white text-sky-900 text-base font-bold active:bg-sky-50"
          >
            Train at home instead
          </button>
        </section>
      )}

      {/* Optional context — grey, not in the 3-second path */}
      {isToday && (
        <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-slate-700 group">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600 list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span>More context</span>
            <span className="text-slate-400 text-xs">Sleep · steps · Peloton</span>
          </summary>
          <div className="mt-4 space-y-4 pt-2 border-t border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Sleep</p>
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
                    className={`min-h-[48px] px-4 rounded-2xl text-sm font-semibold capitalize border-2 ${
                      coach.sleepQuality === s
                        ? "bg-slate-700 text-white border-slate-700"
                        : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Walking load</p>
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
                    className={`min-h-[48px] px-4 rounded-2xl text-sm font-semibold capitalize border-2 ${
                      coach.stepLevel === s
                        ? "bg-slate-700 text-white border-slate-700"
                        : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {data.stepsCount != null && (
                <p className="text-xs text-slate-500 mt-2">
                  Steps: {data.stepsCount.toLocaleString()}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Rides (7d): {flags.pelotonRidesThisWeek}
              {flags.weeklyCardioRidesTargetMet ? " · cardio target met" : ""} · Bootcamps (7d):{" "}
              {flags.bootcampsThisWeek} · Streak: {flags.consecutiveTrainingDays}d
              {flags.swimToday ? " · Swim" : ""} · Yesterday: {flags.lastWorkoutTypeYesterday}
              {lastType ? ` · Last session: ${lastType}` : ""}
            </p>
          </div>
        </details>
      )}

      {workout && (
        <section className="space-y-4">
          {!workoutSessionEnded && !sessionStarted && (
            <WorkoutBlocksPreview
              blocks={blocksForSession}
              totalMinutes={workoutTotalMin}
              onBegin={() => setSessionStarted(true)}
            />
          )}
          {!workoutSessionEnded && sessionStarted && (
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Workout
              </h2>
              <span className="text-sm font-bold text-slate-700 tabular-nums">~{workoutTotalMin} min</span>
            </div>
          )}
          {workoutSessionEnded && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-4 text-center">
              <p className="text-xl font-extrabold text-emerald-900">Workout complete ✅</p>
              <button
                type="button"
                onClick={handleSaveWorkout}
                className="w-full min-h-[56px] rounded-2xl bg-emerald-600 text-white text-lg font-extrabold shadow-lg"
              >
                Save workout
              </button>
              <button
                type="button"
                onClick={handleDiscardWorkout}
                className="w-full min-h-[48px] rounded-2xl border-2 border-red-300 text-red-700 font-bold text-sm"
              >
                Discard workout
              </button>
            </div>
          )}
          {!workoutSessionEnded &&
            sessionStarted &&
            blocksForSession.map((block, idx) => {
              if (idx < activeBlockIndex) {
                return <CollapsedBlock key={block.id} title={block.title} />;
              }
              if (idx === activeBlockIndex) {
                return (
                  <WorkoutBlockRunner
                    key={block.id}
                    block={block}
                    index={idx}
                    total={blocksForSession.length}
                    onBlockFinished={handleBlockFinished}
                  />
                );
              }
              return null;
            })}
        </section>
      )}

      {canTrainStrength && postLog != null && !workout && (
        <PostWorkoutForm postLog={postLog} onSave={(log) => setCoach({ postLog: log })} />
      )}
      </div>

      {/* Thumb zone: fixed dock — Generate, quick toggles, rest timers (lower ~60% of interaction) */}
      {isToday && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-slate-200 bg-white/98 backdrop-blur-md shadow-[0_-12px_40px_rgba(15,23,42,0.1)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="region"
          aria-label="Workout actions"
        >
          <div className="max-w-md mx-auto px-3 pt-3 space-y-3">
            {!minimalThumbDock && canTrainStrength && (
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full min-h-[56px] rounded-2xl bg-blue-600 text-white text-lg font-extrabold shadow-lg shadow-blue-600/25 active:bg-blue-700 active:scale-[0.99] transition-transform"
              >
                Generate workout
              </button>
            )}
            {!minimalThumbDock && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCoach({ manualBootcampToday: !coach.manualBootcampToday })}
                  className={`min-h-[52px] rounded-2xl text-sm font-bold border-2 active:opacity-90 ${
                    coach.manualBootcampToday
                      ? "border-amber-400 bg-amber-100 text-amber-950"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  Bootcamp
                </button>
                <button
                  type="button"
                  onClick={() => setCoach({ golfToday: !coach.golfToday })}
                  className={`min-h-[52px] rounded-2xl text-sm font-bold border-2 active:opacity-90 ${
                    coach.golfToday
                      ? "border-emerald-400 bg-emerald-100 text-emerald-950"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  Golf
                </button>
                <button
                  type="button"
                  onClick={toggleSwim}
                  className={`min-h-[52px] rounded-2xl text-sm font-bold border-2 active:opacity-90 ${
                    hasSwimToday(data)
                      ? "border-sky-400 bg-sky-100 text-sky-950"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  Swim
                </button>
                <button
                  type="button"
                  onClick={toggleLow}
                  className={`min-h-[52px] rounded-2xl text-sm font-bold border-2 active:opacity-90 ${
                    coach.preferLowEnergy
                      ? "border-amber-400 bg-amber-100 text-amber-950"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  Low energy
                </button>
              </div>
            )}
            {!minimalThumbDock && canTrainStrength && (
              <button
                type="button"
                onClick={toggleShort}
                className={`w-full min-h-[48px] rounded-2xl text-sm font-bold border-2 active:opacity-90 ${
                  coach.preferShort
                    ? "border-slate-500 bg-slate-200 text-slate-950"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Short session
              </button>
            )}
            {!minimalThumbDock &&
              (decision.outcome === "strength" || decision.outcome === "consecutive_training_warning") && (
                <button
                  type="button"
                  onClick={handleApplySuggestion}
                  className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 active:bg-slate-100"
                >
                  Apply coach toggles
                </button>
              )}
            <QuickTimersBar />
          </div>
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
    <details className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-slate-800">
      <summary className="cursor-pointer text-sm font-bold text-slate-600 list-none flex items-center justify-between mb-0 [&::-webkit-details-marker]:hidden">
        <span>Post-workout log</span>
        <span className="text-xs font-normal text-slate-400">Optional</span>
      </summary>
      <div className="space-y-3 mt-4 pt-4 border-t border-slate-200">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Rounds / notes</span>
          <input
            type="number"
            min={0}
            placeholder="Rounds"
            value={rounds === "" ? "" : rounds}
            onChange={(e) => setRounds(e.target.value === "" ? "" : e.target.value)}
            onBlur={persist}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
          />
        </label>
        <div className="flex gap-3 items-center">
          <span className="text-sm font-medium text-slate-800">Top set?</span>
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
              topSet === true ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 bg-white"
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
              topSet === false ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 bg-white"
            }`}
          >
            No
          </button>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={persist}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
          />
        </label>
        <p className="text-xs font-semibold text-slate-500 uppercase pt-2">Garmin (manual)</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block col-span-1">
            <span className="text-xs text-slate-500">Cal</span>
            <input
              type="number"
              min={0}
              placeholder="kcal"
              value={cal === "" ? "" : cal}
              onChange={(e) => setCal(e.target.value === "" ? "" : e.target.value)}
              onBlur={persist}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs text-slate-500">Avg HR</span>
            <input
              type="number"
              min={0}
              placeholder="bpm"
              value={hr === "" ? "" : hr}
              onChange={(e) => setHr(e.target.value === "" ? "" : e.target.value)}
              onBlur={persist}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs text-slate-500">Min</span>
            <input
              type="number"
              min={0}
              placeholder="min"
              value={dur === "" ? "" : dur}
              onChange={(e) => setDur(e.target.value === "" ? "" : e.target.value)}
              onBlur={persist}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-sm font-medium text-slate-800 w-full">Mood</span>
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
                mood === m ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 bg-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-slate-800 w-full">Energy</span>
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
                energy === e ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 bg-white"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
