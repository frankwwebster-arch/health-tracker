"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DayData,
  WorkoutCoachBlock,
  WorkoutCoachLiveSession,
  WorkoutCoachPostLog,
} from "@/types";
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
import { useStorageScope } from "@/components/AuthProvider";
import { useWakeLock } from "@/hooks/useWakeLock";
import {
  getCoachStatusTone,
  STATUS_CARD_STYLES,
  statusIconEmoji,
} from "@/components/workout-coach/coach-status-ui";
import {
  CollapsedBlock,
  LiveBlockRouter,
  RestTimerDock,
} from "@/components/workout-coach/live-blocks";
import { WorkoutBlocksPreview } from "@/components/workout-coach/WorkoutBlocksPreview";
import { normalizeWorkoutBlocks } from "@/lib/workout-coach/normalize-blocks";
import {
  completeAmrapWorkAndStartRest,
  completeWarmupCooldownWork,
  computeSavedWorkoutMinutes,
  createInitialLiveSession,
  defaultLiveStateForBlock,
  deriveTimedRemainingSecondsAt,
  isLiveSessionStale,
  mergeLiveSessionBlockStates,
  resolveWorkoutRenderMode,
  startWorkoutSession,
  stepWorkoutStateMachine,
} from "@/lib/workout-coach/live-session";
import {
  extractQuickTimerPresetsFromBlock,
  fixedRoundsBlockHeader,
  isAmrapOrKbLadderBlock,
  isFixedRoundsBlock,
  timedBlockDisplayTitle,
} from "@/lib/workout-coach/block-labels";
import { signalTimerEnd } from "@/lib/workout-coach/timer-sfx";

type UpdateFn = (prev: DayData) => DayData;

/** When a structured block records an extra round completion, append for saved review. */
function collectNewStructuredExtraRoundCompletions(
  existing: WorkoutCoachPostLog["structuredExtraRoundCompletions"],
  prevSession: WorkoutCoachLiveSession | null | undefined,
  nextSession: WorkoutCoachLiveSession,
  blocks: WorkoutCoachBlock[]
): { blockId: string; blockLabel: string }[] {
  const seen = new Set(existing?.map((e) => e.blockId) ?? []);
  for (const [, s] of Object.entries(prevSession?.blockStates ?? {})) {
    if (s.blockType === "structured_rounds" && s.extraRoundState === "completed") {
      seen.add(s.blockId);
    }
  }
  const added: { blockId: string; blockLabel: string }[] = [];
  for (const [id, s] of Object.entries(nextSession.blockStates)) {
    if (s.blockType !== "structured_rounds" || s.extraRoundState !== "completed") continue;
    if (seen.has(id)) continue;
    const idx = blocks.findIndex((b) => b.id === id);
    const block = idx >= 0 ? blocks[idx] : undefined;
    added.push({
      blockId: id,
      blockLabel: block ? fixedRoundsBlockHeader(block, idx) : id,
    });
    seen.add(id);
  }
  return added;
}

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
  dateKey: string;
}

export function WorkoutCoachPanel({ data, update, dateKey }: Props) {
  const { scope } = useStorageScope();
  const { settings, setSettings } = useSettings();
  const coach = data.workoutCoach ?? {};
  const workout = coach.workout ?? null;
  const postLog = coach.postLog ?? null;
  const isToday = dateKey === getDateKey();

  const [yesterdayData, setYesterdayData] = useState<DayData | null>(null);
  const [last30Days, setLast30Days] = useState<{ dateKey: string; data: DayData }[]>([]);
  const [showStrengthInstead, setShowStrengthInstead] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uiNowMs, setUiNowMs] = useState(() => Date.now());

  const last7Days = useMemo(() => last30Days.slice(0, 7), [last30Days]);

  useEffect(() => {
    const y = getAdjacentDateKey(dateKey, -1);
    getDayData(scope, y).then(setYesterdayData);
  }, [dateKey, scope]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows: { dateKey: string; data: DayData }[] = [];
      for (let i = 0; i < 30; i++) {
        const k = getAdjacentDateKey(dateKey, -i);
        const d = await getDayData(scope, k);
        rows.push({ dateKey: k, data: d });
      }
      if (!cancelled) setLast30Days(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [dateKey, scope]);

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
    setMounted(true);
  }, []);

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

  const handleLiveSessionUpdate = useCallback(
    (nextSession: WorkoutCoachLiveSession) => {
      update((prev) => {
        const c = prev.workoutCoach ?? {};
        const w = c.workout;
        if (!w?.id) {
          return { ...prev, workoutCoach: { ...c, liveSession: nextSession } };
        }
        const blocks = normalizeWorkoutBlocks(w.blocks, { id: w.id, generatedAt: w.generatedAt });
        const additions = collectNewStructuredExtraRoundCompletions(
          c.postLog?.structuredExtraRoundCompletions,
          c.liveSession,
          nextSession,
          blocks
        );
        return {
          ...prev,
          workoutCoach: {
            ...c,
            liveSession: nextSession,
            ...(additions.length > 0
              ? {
                  postLog: {
                    ...c.postLog,
                    structuredExtraRoundCompletions: [
                      ...(c.postLog?.structuredExtraRoundCompletions ?? []),
                      ...additions,
                    ],
                  },
                }
              : {}),
          },
        };
      });
    },
    [update]
  );

  /** Persist / merge live session when workout exists but session is missing, stale, or blocks were normalized. */
  useEffect(() => {
    if (!workout) return;
    update((prev) => {
      const c = prev.workoutCoach ?? {};
      const w = c.workout;
      if (!w || w.id !== workout.id) return prev;
      const blocks = normalizeWorkoutBlocks(w.blocks, { id: w.id, generatedAt: w.generatedAt });
      let session = c.liveSession;
      if (!session || isLiveSessionStale(session, w)) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[WorkoutCoach] initializing live session", {
            dateKey,
            reason: !session ? "missing" : "stale",
            workoutId: w.id,
            generatedAt: w.generatedAt,
            previousStatus: session?.workoutStatus ?? null,
            previousStarted: session?.sessionStarted ?? null,
          });
        }
        return {
          ...prev,
          workoutCoach: { ...c, liveSession: createInitialLiveSession(w) },
        };
      }
      const merged = mergeLiveSessionBlockStates(session, blocks);
      if (merged !== session) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[WorkoutCoach] merged live session block states", {
            dateKey,
            workoutId: w.id,
            workoutStatus: merged.workoutStatus,
            sessionStarted: merged.sessionStarted,
            activeBlockIndex: merged.activeBlockIndex,
          });
        }
        return { ...prev, workoutCoach: { ...c, liveSession: merged } };
      }
      return prev;
    });
  }, [dateKey, workout?.id, workout?.generatedAt, update, workout]);

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
      liveSession: createInitialLiveSession(result.workout),
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

  const blocksForSession = useMemo(() => {
    if (!workout) return [];
    return normalizeWorkoutBlocks(workout.blocks, { id: workout.id, generatedAt: workout.generatedAt });
  }, [workout]);

  const liveSession = useMemo(() => {
    if (!workout) return null;
    if (!isLiveSessionStale(coach.liveSession, workout)) return coach.liveSession!;
    return createInitialLiveSession(workout);
  }, [workout, coach.liveSession]);

  const renderMode = resolveWorkoutRenderMode(workout, liveSession);
  const workoutSessionEnded = renderMode === "COMPLETE";
  const isLiveWorkoutActive = renderMode === "LIVE";
  const isPreviewMode = renderMode === "PREVIEW";
  const activeBlockIndex = liveSession?.activeBlockIndex ?? 0;
  const currentBlock = blocksForSession[activeBlockIndex] ?? null;
  const currentLiveBlock = currentBlock && liveSession
    ? liveSession.blockStates[currentBlock.id] ?? null
    : null;
  const currentBlockStatus =
    currentLiveBlock && "status" in currentLiveBlock
      ? String((currentLiveBlock as { status?: string }).status ?? "null")
      : "null";

  const keepScreenAwake =
    Boolean(workout && isLiveWorkoutActive);
  useWakeLock(keepScreenAwake);

  /**
   * UI ticker for visible countdown updates.
   * Timer math is wall-clock based (`endAtEpochMs`), but React still needs periodic re-renders
   * while a timer is active so `derive*RemainingSeconds` can visibly decrement on screen.
   */
  useEffect(() => {
    if (!isLiveWorkoutActive || !liveSession) return;

    const runningRestTimer = Boolean(
      liveSession.restTimer?.active && liveSession.restTimer.endAtEpochMs != null
    );
    const runningBlockTimer = Boolean(
      currentLiveBlock &&
        currentLiveBlock.blockType !== "structured_rounds" &&
        currentLiveBlock.status === "active" &&
        currentLiveBlock.endAtEpochMs != null
    );

    if (!runningRestTimer && !runningBlockTimer) return;

    const id = setInterval(() => {
      setUiNowMs(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, [isLiveWorkoutActive, liveSession, currentLiveBlock]);

  /**
   * Completion engine: evaluate zero-boundary transitions off the same ticking clock
   * used for visible countdown. If UI reaches 0:00, this effect runs and commits completion.
   */
  useEffect(() => {
    if (!isLiveWorkoutActive || !workout) return;
    update((prev) => {
      const c = prev.workoutCoach ?? {};
      const w = c.workout;
      const session = c.liveSession;
      if (!w || !session?.sessionStarted) return prev;
      const blocks = normalizeWorkoutBlocks(w.blocks, { id: w.id, generatedAt: w.generatedAt });

      // Hard guard: if active timed block has reached zero, force completion immediately.
      const activeBlock = blocks[session.activeBlockIndex];
      const activeLive = activeBlock ? session.blockStates[activeBlock.id] : null;
      if (
        activeBlock &&
        activeLive &&
        activeLive.blockType !== "structured_rounds" &&
        activeLive.status === "active"
      ) {
        const rem = deriveTimedRemainingSecondsAt(activeLive, uiNowMs);
        if (rem <= 0) {
          const nextSession =
            activeLive.blockType === "amrap_timed"
              ? completeAmrapWorkAndStartRest(session, activeBlock.id, blocks)
              : completeWarmupCooldownWork(session, activeBlock.id, blocks);
          if (process.env.NODE_ENV !== "production") {
            console.debug("[WorkoutCoach] forced timed-block completion at <= 0", {
              dateKey,
              blockId: activeBlock.id,
              blockType: activeLive.blockType,
              rem,
              activeBlockIndexBefore: session.activeBlockIndex,
              activeBlockIndexAfter: nextSession.activeBlockIndex,
              statusAfter: nextSession.workoutStatus,
            });
          }
          signalTimerEnd();
          return {
            ...prev,
            workoutCoach: {
              ...c,
              liveSession: nextSession,
            },
          };
        }
      }

      const stepped = stepWorkoutStateMachine(session, blocks, uiNowMs);
      if (stepped.events.length === 0) return prev;
      if (process.env.NODE_ENV !== "production") {
        console.debug("[WorkoutCoach] state-machine completion events", {
          dateKey,
          events: stepped.events,
          activeBlockIndexBefore: session.activeBlockIndex,
          activeBlockIndexAfter: stepped.session.activeBlockIndex,
          statusAfter: stepped.session.workoutStatus,
        });
      }
      signalTimerEnd();
      return {
        ...prev,
        workoutCoach: {
          ...c,
          liveSession: stepped.session,
        },
      };
    });
  }, [dateKey, isLiveWorkoutActive, uiNowMs, update, workout]);

  /** Live: quick timers only when block copy lists matching seconds (e.g. 20s plank); never on AMRAP/KB ladder. */
  const quickTimerPresetsForBar = useMemo(() => {
    if (!isLiveWorkoutActive) return undefined;
    const block = blocksForSession[activeBlockIndex];
    if (!block) return undefined;
    return extractQuickTimerPresetsFromBlock(block);
  }, [isLiveWorkoutActive, blocksForSession, activeBlockIndex]);

  const showQuickTimersInDock = useMemo(() => {
    if (!workout) return true;
    if (workoutSessionEnded) return false;
    if (!isLiveWorkoutActive) return true;
    if (liveSession?.restTimer?.active) return false;
    const block = blocksForSession[activeBlockIndex];
    if (!block) return false;
    if (isAmrapOrKbLadderBlock(block)) return false;
    return extractQuickTimerPresetsFromBlock(block).length > 0;
  }, [
    workout,
    workoutSessionEnded,
    isLiveWorkoutActive,
    liveSession?.restTimer?.active,
    blocksForSession,
    activeBlockIndex,
  ]);

  const workoutTotalMin = useMemo(
    () => blocksForSession.reduce((sum, b) => sum + b.minutes, 0),
    [blocksForSession]
  );
  /** Hide Generate / toggles whenever a workout exists (preview or in progress; timers stay). */
  const minimalThumbDock = workout != null;

  /** Fixed thumb dock for all coach actions on today (Begin / End / timers / Save / Generate). */
  const showThumbDock = isToday;

  /** Scroll padding — room for thumb-zone dock (live workout + completion + generate). */
  const scrollPad = isToday
    ? "pb-[calc(20rem+env(safe-area-inset-bottom))]"
    : "pb-10";

  const handleSaveWorkout = useCallback(() => {
    const minutes = computeSavedWorkoutMinutes(coach.liveSession, workoutTotalMin);
    update((prev) => ({
      ...prev,
      workoutMinutes: minutes,
      workoutCoach: {
        ...prev.workoutCoach,
        workout: null,
        postLog: { ...prev.workoutCoach?.postLog, garminDurationMin: minutes },
        liveSession: null,
      },
    }));
  }, [coach.liveSession, workoutTotalMin, update]);

  const handleDiscardWorkout = () => {
    setCoach({ workout: null, postLog: null, liveSession: null });
  };

  const handleBeginSession = () => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[WorkoutCoach] Begin Workout tapped", {
        dateKey,
        hasWorkout: Boolean(workout),
        workoutId: workout?.id ?? null,
        existingStatus: coach.liveSession?.workoutStatus ?? null,
        existingStarted: coach.liveSession?.sessionStarted ?? null,
      });
    }
    update((prev) => {
      const c = prev.workoutCoach ?? {};
      const w = c.workout;
      if (!w) return prev;
      const nextSession = startWorkoutSession(w);
      if (process.env.NODE_ENV !== "production") {
        console.debug("[WorkoutCoach] WORKOUT_STARTED", {
          dateKey,
          workoutId: w.id,
          workoutStatus: nextSession.workoutStatus,
          sessionStarted: nextSession.sessionStarted,
          activeBlockIndex: nextSession.activeBlockIndex,
        });
      }
      return {
        ...prev,
        workoutCoach: {
          ...c,
          liveSession: nextSession,
        },
      };
    });
  };

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    console.debug("[WorkoutCoach] live session snapshot", {
      dateKey,
      hasWorkout: Boolean(workout),
      renderMode,
      hasLiveSession: Boolean(coach.liveSession),
      workoutStatus: coach.liveSession?.workoutStatus ?? null,
      sessionStarted: coach.liveSession?.sessionStarted ?? null,
      activeBlockIndex: coach.liveSession?.activeBlockIndex ?? null,
    });
  }, [
    dateKey,
    workout,
    coach.liveSession,
    coach.liveSession?.workoutStatus,
    coach.liveSession?.sessionStarted,
    coach.liveSession?.activeBlockIndex,
    renderMode,
  ]);

  const activeBlockScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLiveWorkoutActive || workoutSessionEnded) return;
    activeBlockScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeBlockIndex, isLiveWorkoutActive, workoutSessionEnded]);

  const handleEndWorkout = () => {
    if (typeof window !== "undefined" && window.confirm("End workout? Progress will be lost.")) {
      setCoach({ workout: null, postLog: null, liveSession: null });
    }
  };

  function collapsedTitleForBlock(block: (typeof blocksForSession)[number], idx: number): string {
    if (isFixedRoundsBlock(block)) {
      return fixedRoundsBlockHeader(block, idx);
    }
    return timedBlockDisplayTitle(block, idx);
  }

  return (
    <div className="relative min-h-[100dvh] w-full max-w-md mx-auto touch-manipulation">
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed right-2 top-20 z-40 rounded-lg border border-slate-300 bg-white/95 px-2 py-1.5 text-[10px] leading-tight shadow max-w-[210px]">
          <p><strong>mode:</strong> {renderMode}</p>
          <p><strong>status:</strong> {liveSession?.workoutStatus ?? "null"}</p>
          <p><strong>liveSession:</strong> {liveSession ? "true" : "false"}</p>
          <p><strong>started:</strong> {String(liveSession?.sessionStarted ?? false)}</p>
          <p><strong>activeIdx:</strong> {liveSession?.activeBlockIndex ?? -1}</p>
          <p><strong>blockType:</strong> {currentLiveBlock?.blockType ?? "null"}</p>
          <p><strong>blockStatus:</strong> {currentBlockStatus}</p>
          <p><strong>restActive:</strong> {String(Boolean(liveSession?.restTimer?.active))}</p>
          <p><strong>mounted:</strong> {String(mounted)}</p>
          <p><strong>tickMs:</strong> {uiNowMs}</p>
        </div>
      )}
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

      {!isLiveWorkoutActive && showBootcampCard && decision.outcome === "bootcamp_suggestion" && (
        <section className="rounded-2xl border-2 border-sky-200 bg-sky-50/80 p-4 text-sky-950 space-y-3">
          <p className="text-sm font-bold">{decision.durationMinutes} min bike</p>
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
          {isPreviewMode && (
            <WorkoutBlocksPreview blocks={blocksForSession} totalMinutes={workoutTotalMin} />
          )}
          {!workoutSessionEnded && isLiveWorkoutActive && (
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Workout
              </h2>
              <span className="text-sm font-bold text-slate-700 tabular-nums ml-auto">
                Plan {workoutTotalMin} min
              </span>
            </div>
          )}
          {workoutSessionEnded && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 p-5 text-center">
              <p className="text-lg font-extrabold text-emerald-900">Done for today ✅</p>
              <p className="text-sm text-emerald-800/90 mt-2">
                Save or discard below — your choice is remembered for the day.
              </p>
              {(postLog?.structuredExtraRoundCompletions?.length ?? 0) > 0 && (
                <p className="text-xs text-emerald-800/90 mt-3 font-medium">
                  Extra round completed:{" "}
                  {postLog!.structuredExtraRoundCompletions!.map((x) => x.blockLabel).join(", ")}
                </p>
              )}
            </div>
          )}
          {!workoutSessionEnded &&
            isLiveWorkoutActive &&
            liveSession &&
            blocksForSession.map((block, idx) => {
              if (idx < activeBlockIndex) {
                return (
                  <CollapsedBlock key={block.id} title={collapsedTitleForBlock(block, idx)} />
                );
              }
              if (idx > activeBlockIndex) return null;
              if (
                liveSession.restTimer?.active &&
                liveSession.restTimer.sourceBlockId === block.id &&
                idx === activeBlockIndex
              ) {
                return (
                  <div
                    key={block.id}
                    ref={activeBlockScrollRef}
                    className="space-y-3 scroll-mt-4"
                  >
                    <CollapsedBlock title={collapsedTitleForBlock(block, idx)} />
                    <RestTimerDock
                      rest={liveSession.restTimer}
                      session={liveSession}
                      onSession={handleLiveSessionUpdate}
                      blocks={blocksForSession}
                    />
                  </div>
                );
              }
              const live = liveSession.blockStates[block.id] ?? defaultLiveStateForBlock(block);
              return (
                <div
                  key={block.id}
                  ref={activeBlockScrollRef}
                  className="scroll-mt-4"
                >
                  <LiveBlockRouter
                    block={block}
                    blocks={blocksForSession}
                    index={idx}
                    total={blocksForSession.length}
                    live={live}
                    session={liveSession}
                    onSession={handleLiveSessionUpdate}
                  />
                </div>
              );
            })}
        </section>
      )}

      {canTrainStrength && postLog != null && !workout && (
        <PostWorkoutForm postLog={postLog} onSave={(log) => setCoach({ postLog: log })} />
      )}
      </div>

      {/* Thumb zone: primary actions only (mobile-first, one-handed) */}
      {showThumbDock && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-slate-200 bg-white/98 backdrop-blur-md shadow-[0_-12px_40px_rgba(15,23,42,0.1)]"
          role="region"
          aria-label="Workout actions"
        >
          <div className="max-w-md mx-auto px-3 pt-3 space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {workout && workoutSessionEnded && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDiscardWorkout}
                  className="w-full min-h-[48px] rounded-full border-2 border-red-200 bg-red-50/90 text-red-800 text-sm font-bold active:scale-[0.99]"
                >
                  Discard workout
                </button>
                <button
                  type="button"
                  onClick={handleSaveWorkout}
                  className="w-full min-h-[56px] rounded-full bg-emerald-600 text-white text-lg font-extrabold shadow-md shadow-emerald-600/20 active:scale-[0.99]"
                >
                  Save workout
                </button>
              </div>
            )}
            {workout && !workoutSessionEnded && isLiveWorkoutActive && (
              <div className="space-y-3">
                <QuickTimersBar visible={showQuickTimersInDock} presets={quickTimerPresetsForBar} />
                <button
                  type="button"
                  onClick={handleEndWorkout}
                  className="w-full min-h-[52px] rounded-full border-2 border-red-300 bg-white text-red-700 text-base font-extrabold active:bg-red-50 active:scale-[0.99]"
                >
                  End workout
                </button>
              </div>
            )}
            {workout && !workoutSessionEnded && !isLiveWorkoutActive && (
              <div className="space-y-3">
                <QuickTimersBar visible={true} />
                <button
                  type="button"
                  onClick={handleBeginSession}
                  className="w-full min-h-[56px] rounded-full bg-blue-600 text-white text-lg font-extrabold shadow-lg shadow-blue-600/25 active:bg-blue-700 active:scale-[0.99]"
                >
                  Begin workout
                </button>
              </div>
            )}
            {!minimalThumbDock && canTrainStrength && (
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full min-h-[56px] rounded-full bg-blue-600 text-white text-lg font-extrabold shadow-lg shadow-blue-600/25 active:bg-blue-700 active:scale-[0.99] transition-transform"
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
                  className="w-full min-h-[48px] rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 active:bg-slate-100"
                >
                  Apply coach toggles
                </button>
              )}
            {!workout && <QuickTimersBar visible={true} />}
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
      ...postLog,
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
        {postLog?.structuredExtraRoundCompletions &&
          postLog.structuredExtraRoundCompletions.length > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-950">
              <p className="font-semibold text-emerald-900">Extra round completed (structured blocks)</p>
              <ul className="list-disc list-inside mt-1 text-emerald-800">
                {postLog.structuredExtraRoundCompletions.map((x) => (
                  <li key={x.blockId}>{x.blockLabel}</li>
                ))}
              </ul>
            </div>
          )}
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
