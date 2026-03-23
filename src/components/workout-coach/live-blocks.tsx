"use client";

import { useCallback } from "react";
import type {
  AmrapTimedLiveState,
  StructuredRoundsLiveState,
  WarmupCooldownTimedLiveState,
  WorkoutCoachBlock,
  WorkoutCoachBlockLiveState,
  WorkoutCoachLiveSession,
  WorkoutCoachRestTimer,
} from "@/types";
import {
  fixedRoundsBlockHeader,
  formatExerciseLineConcise,
  timedBlockDisplayTitle,
} from "@/lib/workout-coach/block-labels";
import {
  completeAmrapWorkAndStartRest,
  completeRestTimer,
  completeWarmupCooldownWork,
  deriveRestRemainingSeconds,
  deriveTimedRemainingSeconds,
  patchRestTimer,
  patchStructuredState,
  patchTimedState,
  structuredCompleteExtraRoundAndStartRest,
  structuredSkipToNextPhase,
  structuredStartRest,
} from "@/lib/workout-coach/live-session";

export function formatMmSs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CollapsedBlock({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 flex items-center gap-2 min-h-[48px] min-w-0 max-w-full overflow-hidden motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out motion-safe:origin-top">
      <span className="text-emerald-700 text-lg font-bold shrink-0">✓</span>
      <span className="font-bold text-emerald-900 text-sm min-w-0 break-words [overflow-wrap:anywhere] line-clamp-2">
        {title}
      </span>
    </div>
  );
}

type SessionUpdater = (next: WorkoutCoachLiveSession) => void;

type BaseProps = {
  block: WorkoutCoachBlock;
  blocks: WorkoutCoachBlock[];
  index: number;
  total: number;
  session: WorkoutCoachLiveSession;
  onSession: SessionUpdater;
};

/** Legacy sessions may still have rest_started; treat as completed for UI. */
function normalizeLiveForRouter(live: WorkoutCoachBlockLiveState): WorkoutCoachBlockLiveState {
  if (live.blockType === "structured_rounds" && live.status === "rest_started") {
    return { ...live, status: "completed" };
  }
  // Legacy: old "armed" two-tap flow → single in-progress extra round
  if (live.blockType === "structured_rounds") {
    const er = live.extraRoundState as string;
    if (er === "armed") {
      return {
        ...live,
        status: "extra_round_in_progress",
        extraRoundState: "in_progress",
      };
    }
  }
  return live;
}

export function WorkoutRestTimerBar({
  rest,
  onPause,
  onResume,
}: {
  rest: WorkoutCoachRestTimer;
  onPause: () => void;
  onResume: () => void;
}) {
  const rem = deriveRestRemainingSeconds(rest);

  return (
    <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 space-y-2 shadow-md shadow-red-900/10">
      <div className="flex justify-between items-center gap-2">
        <p className="text-[11px] font-bold text-red-900 uppercase tracking-wide">Timer</p>
      </div>
      <button
        type="button"
        onClick={rest.endAtEpochMs != null ? onPause : onResume}
        className="w-full min-h-[72px] rounded-2xl bg-red-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99] shadow-inner"
      >
        <span className="text-4xl font-black tabular-nums">{formatMmSs(rem)}</span>
        <span className="text-xs font-bold uppercase opacity-95">
          {rest.endAtEpochMs != null ? "Tap to pause" : "Tap to resume"}
        </span>
      </button>
    </div>
  );
}

function TimedWorkBlock({
  block,
  blocks,
  index,
  total,
  live,
  session,
  onSession,
  variant,
}: BaseProps & {
  live: WarmupCooldownTimedLiveState;
  variant: "warmup" | "cooldown";
}) {
  const rem = deriveTimedRemainingSeconds(live);
  const startLabel = variant === "warmup" ? "Start warm-up" : "Start cooldown";

  const patch = useCallback(
    (next: WarmupCooldownTimedLiveState) => {
      onSession(patchTimedState(session, block.id, next));
    },
    [block.id, onSession, session]
  );

  const handlePrimary = () => {
    if (live.status === "not_started") {
      patch({
        ...live,
        status: "active",
        remainingSeconds: live.remainingSeconds,
        endAtEpochMs: Date.now() + live.remainingSeconds * 1000,
      });
      return;
    }
    if (live.status === "active") {
      patch({
        ...live,
        status: "paused",
        remainingSeconds: rem,
        endAtEpochMs: null,
      });
      return;
    }
    if (live.status === "paused") {
      patch({
        ...live,
        status: "active",
        remainingSeconds: rem,
        endAtEpochMs: Date.now() + rem * 1000,
      });
    }
  };

  const handleSkip = () => {
    onSession(completeWarmupCooldownWork(session, block.id, blocks));
  };

  const done = live.status === "completed";
  const title = timedBlockDisplayTitle(block, index);

  return (
    <div
      className={`rounded-2xl border-2 p-1 transition-colors duration-300 min-w-0 max-w-full ${
        done ? "border-emerald-500 bg-emerald-50" : "border-sky-200 bg-sky-50/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Time</span>
        <span className="text-[10px] text-sky-700">Start · Pause · Resume</span>
      </div>
      <div
        className={`rounded-xl p-3 ${done ? "bg-emerald-50/80" : "bg-white border border-sky-100"}`}
      >
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">
          {index + 1}/{total}
        </p>
        <h3 className="text-base font-extrabold text-slate-900 mb-2 break-words [overflow-wrap:anywhere] leading-snug">
          {title}
        </h3>
        <ul className="space-y-1.5 mb-3">
          {block.exercises.map((ex, i) => (
            <li key={i} className="text-sm min-w-0 break-words [overflow-wrap:anywhere] text-slate-800">
              {formatExerciseLineConcise(ex)}
            </li>
          ))}
        </ul>
      {!done && live.status === "not_started" && (
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full min-h-[88px] rounded-2xl bg-sky-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99] shadow-md"
        >
          <span className="text-base font-extrabold">{startLabel}</span>
          <span className="text-3xl font-black tabular-nums">{formatMmSs(live.remainingSeconds)}</span>
        </button>
      )}
      {!done && live.status === "active" && (
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full min-h-[88px] rounded-2xl bg-sky-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99]"
        >
          <span className="text-4xl font-black tabular-nums">{formatMmSs(rem)}</span>
          <span className="text-[10px] font-bold uppercase opacity-90">Pause</span>
        </button>
      )}
      {!done && live.status === "paused" && (
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full min-h-[52px] rounded-2xl bg-slate-800 text-white text-base font-extrabold active:scale-[0.99]"
        >
          Resume · {formatMmSs(rem)}
        </button>
      )}
      {!done && (
        <button
          type="button"
          onClick={handleSkip}
          className="mt-2 w-full min-h-[40px] rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold active:scale-[0.99]"
        >
          Skip
        </button>
      )}
      {done && <p className="text-center text-xs font-bold text-emerald-800 py-1">Done</p>}
      </div>
    </div>
  );
}

function AmrapTimedBlock({ block, blocks, index, total, live, session, onSession }: BaseProps & { live: AmrapTimedLiveState }) {
  const rem = deriveTimedRemainingSeconds(live);
  const done = live.status === "completed";

  const patch = useCallback(
    (next: AmrapTimedLiveState) => {
      onSession(patchTimedState(session, block.id, next));
    },
    [block.id, onSession, session]
  );

  const handleStart = () => {
    patch({
      ...live,
      status: "active",
      remainingSeconds: live.remainingSeconds,
      endAtEpochMs: Date.now() + live.remainingSeconds * 1000,
    });
  };

  const handleTapTimer = () => {
    if (live.status !== "active") return;
    patch({
      ...live,
      status: "paused",
      remainingSeconds: rem,
      endAtEpochMs: null,
    });
  };

  const handleResume = () => {
    patch({
      ...live,
      status: "active",
      remainingSeconds: rem,
      endAtEpochMs: Date.now() + rem * 1000,
    });
  };

  const handleSkip = () => {
    onSession(completeAmrapWorkAndStartRest(session, block.id, blocks));
  };

  const title = timedBlockDisplayTitle(block, index);

  return (
    <div
      className={`rounded-2xl border-2 p-1 transition-colors min-w-0 max-w-full ${
        done ? "border-emerald-500 bg-emerald-50" : "border-sky-200 bg-sky-50/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Time</span>
        <span className="text-[10px] text-sky-700">Start · Pause · Resume</span>
      </div>
      <div className={`rounded-xl p-3 ${done ? "bg-emerald-50/80" : "bg-white border border-sky-100"}`}>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">
          {index + 1}/{total}
        </p>
        <h3 className="text-base font-extrabold text-slate-900 mb-2 break-words [overflow-wrap:anywhere] leading-snug">
          {title}
        </h3>
        <ul className="space-y-1.5 mb-3">
          {block.exercises.map((ex, i) => (
            <li key={i} className="text-sm min-w-0 break-words [overflow-wrap:anywhere] text-slate-800">
              {formatExerciseLineConcise(ex)}
            </li>
          ))}
        </ul>
        {!done && live.status === "not_started" && (
          <button
            type="button"
            onClick={handleStart}
            className="w-full min-h-[100px] rounded-2xl bg-sky-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99] shadow-md px-3"
          >
            <span className="text-base font-extrabold">Start block</span>
            <span className="text-4xl font-black tabular-nums">{formatMmSs(live.remainingSeconds)}</span>
          </button>
        )}
        {!done && live.status === "active" && (
          <button
            type="button"
            onClick={handleTapTimer}
            className="w-full min-h-[100px] rounded-2xl bg-sky-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99]"
          >
            <span className="text-4xl font-black tabular-nums">{formatMmSs(rem)}</span>
            <span className="text-[10px] font-bold uppercase opacity-90">Pause</span>
          </button>
        )}
        {!done && live.status === "paused" && (
          <button
            type="button"
            onClick={handleResume}
            className="w-full min-h-[52px] rounded-2xl bg-slate-800 text-white text-base font-extrabold active:scale-[0.99]"
          >
            Resume · {formatMmSs(rem)}
          </button>
        )}
        {!done && (
          <button
            type="button"
            onClick={handleSkip}
            className="mt-2 w-full min-h-[40px] rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold active:scale-[0.99]"
          >
            Skip
          </button>
        )}
        {done && <p className="text-center text-xs font-bold text-emerald-800 py-1">Done</p>}
      </div>
    </div>
  );
}

function StructuredRoundsBlock({
  block,
  blocks,
  index,
  total,
  live,
  session,
  onSession,
}: BaseProps & { live: StructuredRoundsLiveState }) {
  const patch = useCallback(
    (next: StructuredRoundsLiveState) => {
      onSession(patchStructuredState(session, block.id, next));
    },
    [block.id, onSession, session]
  );

  const handleStartBlock = () => {
    patch({ ...live, status: "active", extraRoundState: "unavailable" });
  };

  const handleRoundDone = () => {
    if (live.status !== "active") return;
    const next = live.completedRounds + 1;
    if (next >= live.targetRounds) {
      patch({
        ...live,
        completedRounds: next,
        status: "rounds_complete_pending_decision",
        extraRoundState: "available",
      });
    } else {
      patch({ ...live, completedRounds: next });
    }
  };

  const handleBeginRest = () => {
    onSession(structuredStartRest(session, block.id));
  };

  const handleDoExtraRound = () => {
    patch({
      ...live,
      status: "extra_round_in_progress",
      extraRoundState: "in_progress",
    });
  };

  const handleExtraRoundComplete = () => {
    onSession(structuredCompleteExtraRoundAndStartRest(session, block.id));
  };

  const handleSkip = () => {
    onSession(structuredSkipToNextPhase(session, block.id, blocks));
  };

  const pendingDecision = live.status === "rounds_complete_pending_decision";
  const inExtraRound = live.status === "extra_round_in_progress";
  const showMainRoundButton =
    live.status === "not_started" ||
    (live.status === "active" && live.completedRounds < live.targetRounds);

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-1 min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">Rounds</span>
        <span className="text-[10px] text-emerald-800">Rounds · Begin rest or extra round</span>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-white p-3 space-y-2">
        <div className="flex justify-start items-start gap-2 min-w-0">
          <h3 className="text-base font-extrabold text-slate-900 flex-1 min-w-0 break-words [overflow-wrap:anywhere] leading-snug">
            {fixedRoundsBlockHeader(block, index)}
          </h3>
          <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums pt-0.5">
            {index + 1}/{total}
          </span>
        </div>
        {live.status === "active" && live.completedRounds < live.targetRounds && (
          <p className="text-xs font-bold text-emerald-900">
            Round {live.completedRounds + 1} / {live.targetRounds}
          </p>
        )}
        <ul className="space-y-1.5">
          {block.exercises.map((ex, i) => (
            <li key={i} className="text-sm min-w-0 break-words [overflow-wrap:anywhere] text-slate-800">
              {formatExerciseLineConcise(ex)}
            </li>
          ))}
        </ul>

        {showMainRoundButton && (
          <button
            type="button"
            onClick={live.status === "not_started" ? handleStartBlock : handleRoundDone}
            className="w-full min-h-[52px] rounded-2xl bg-emerald-700 text-white text-base font-extrabold active:scale-[0.99]"
          >
            {live.status === "not_started"
              ? "Start block"
              : `Round ${live.completedRounds + 1} done`}
          </button>
        )}

        {pendingDecision && (
          <div className="space-y-2 pt-2 border-t border-emerald-200">
            <p className="text-sm font-extrabold text-emerald-950 text-center">Rounds complete</p>
            <button
              type="button"
              onClick={handleBeginRest}
              className="w-full min-h-[48px] rounded-2xl bg-red-600 text-white font-extrabold text-sm hover:bg-red-700 active:scale-[0.99]"
            >
              Begin rest
            </button>
            <button
              type="button"
              onClick={handleDoExtraRound}
              className="w-full min-h-[48px] rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold text-sm active:scale-[0.99]"
            >
              Do extra round
            </button>
          </div>
        )}
        {inExtraRound && (
          <div className="space-y-2 pt-2 border-t border-emerald-200">
            <p className="text-sm text-center text-emerald-900">
              Extra round in progress — finish when ready.
            </p>
            <button
              type="button"
              onClick={handleExtraRoundComplete}
              className="w-full min-h-[48px] rounded-2xl bg-emerald-700 text-white font-extrabold text-sm active:scale-[0.99]"
            >
              Extra round
            </button>
          </div>
        )}
        {live.status !== "completed" && (
          <button
            type="button"
            onClick={handleSkip}
            className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold active:scale-[0.99]"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export function LiveBlockRouter({
  block,
  blocks,
  index,
  total,
  live,
  session,
  onSession,
}: BaseProps & { live: WorkoutCoachBlockLiveState }) {
  const normalized = normalizeLiveForRouter(live);
  switch (normalized.blockType) {
    case "warmup_timed":
      return (
        <TimedWorkBlock
          block={block}
          blocks={blocks}
          index={index}
          total={total}
          live={normalized}
          session={session}
          onSession={onSession}
          variant="warmup"
        />
      );
    case "cooldown_timed":
      return (
        <TimedWorkBlock
          block={block}
          blocks={blocks}
          index={index}
          total={total}
          live={normalized}
          session={session}
          onSession={onSession}
          variant="cooldown"
        />
      );
    case "amrap_timed":
      return (
        <AmrapTimedBlock block={block} blocks={blocks} index={index} total={total} live={normalized} session={session} onSession={onSession} />
      );
    case "structured_rounds":
      return (
        <StructuredRoundsBlock
          block={block}
          blocks={blocks}
          index={index}
          total={total}
          live={normalized}
          session={session}
          onSession={onSession}
        />
      );
    default:
      return null;
  }
}

export function RestTimerDock({
  rest,
  onSession,
  session,
  blocks,
}: {
  rest: WorkoutCoachRestTimer;
  session: WorkoutCoachLiveSession;
  onSession: SessionUpdater;
  blocks: WorkoutCoachBlock[];
}) {
  const rem = deriveRestRemainingSeconds(rest);

  const pause = () => {
    if (rest.endAtEpochMs == null) return;
    onSession(
      patchRestTimer(session, {
        ...rest,
        active: true,
        remainingSeconds: rem,
        endAtEpochMs: null,
      })
    );
  };

  const resume = () => {
    onSession(
      patchRestTimer(session, {
        ...rest,
        active: true,
        remainingSeconds: rem,
        endAtEpochMs: Date.now() + rem * 1000,
      })
    );
  };

  const skip = () => {
    onSession(completeRestTimer(session, blocks));
  };

  return (
    <div className="space-y-2">
      <WorkoutRestTimerBar rest={rest} onPause={pause} onResume={resume} />
      <button
        type="button"
        onClick={skip}
        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold active:scale-[0.99]"
      >
        Skip
      </button>
    </div>
  );
}
