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
import { fixedRoundsBlockHeader } from "@/lib/workout-coach/block-labels";
import {
  deriveRestRemainingSeconds,
  deriveTimedRemainingSeconds,
  patchRestTimer,
  patchStructuredState,
  patchTimedState,
  structuredCompleteExtraRoundAndStartRest,
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
        <p className="text-[11px] font-bold text-red-900 uppercase tracking-wide">Rest</p>
        <span className="text-[10px] font-semibold text-red-800">
          {rest.autoStarted ? "Auto-start" : "After your tap"}
        </span>
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

  const done = live.status === "completed";

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-colors duration-300 min-w-0 max-w-full ${
        done ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">
        {index + 1}/{total}
      </p>
      <h3 className="text-lg font-extrabold text-slate-900 mb-3 break-words [overflow-wrap:anywhere]">
        {block.title}
      </h3>
      <ul className="space-y-2 mb-4">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-base min-w-0 break-words [overflow-wrap:anywhere]">
            <span className="font-bold text-slate-900">{ex.name}</span>
            <span className="text-slate-600"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {!done && live.status === "not_started" && (
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full min-h-[88px] rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center gap-1.5 active:scale-[0.99] shadow-lg shadow-blue-600/20"
        >
          <span className="text-lg font-extrabold">{startLabel}</span>
          <span className="text-3xl font-black tabular-nums opacity-95">{formatMmSs(live.remainingSeconds)}</span>
          <span className="text-[11px] font-semibold uppercase opacity-90">Tap to begin — not a skip</span>
        </button>
      )}
      {!done && live.status === "active" && (
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full min-h-[88px] rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99]"
        >
          <span className="text-4xl font-black tabular-nums">{formatMmSs(rem)}</span>
          <span className="text-xs font-bold uppercase opacity-90">Tap to pause</span>
        </button>
      )}
      {!done && live.status === "paused" && (
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full min-h-[56px] rounded-2xl bg-slate-800 text-white text-lg font-extrabold active:scale-[0.99]"
        >
          Resume ({formatMmSs(rem)})
        </button>
      )}
      {done && <p className="text-center text-sm font-black text-emerald-700 py-1">Done</p>}
    </div>
  );
}

function AmrapTimedBlock({ block, index, total, live, session, onSession }: BaseProps & { live: AmrapTimedLiveState }) {
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

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-colors min-w-0 max-w-full ${
        done ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">
        {index + 1}/{total}
      </p>
      <h3 className="text-lg font-extrabold text-slate-900 mb-3 break-words [overflow-wrap:anywhere]">{block.title}</h3>
      <ul className="space-y-2 mb-4">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-base min-w-0 break-words [overflow-wrap:anywhere]">
            <span className="font-bold text-slate-900">{ex.name}</span>
            <span className="text-slate-600"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {!done && live.status === "not_started" && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full min-h-[104px] rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center gap-1.5 active:scale-[0.99] shadow-lg shadow-blue-600/20 px-4"
        >
          <span className="text-lg font-extrabold">Start block</span>
          <span className="text-4xl font-black tabular-nums">{formatMmSs(live.remainingSeconds)}</span>
          <span className="text-[11px] font-semibold uppercase opacity-90">Countdown runs in this button</span>
        </button>
      )}
      {!done && live.status === "active" && (
        <button
          type="button"
          onClick={handleTapTimer}
          className="w-full min-h-[104px] rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99]"
        >
          <span className="text-4xl font-black tabular-nums">{formatMmSs(rem)}</span>
          <span className="text-xs font-bold uppercase opacity-90">Tap to pause</span>
        </button>
      )}
      {!done && live.status === "paused" && (
        <button
          type="button"
          onClick={handleResume}
          className="w-full min-h-[56px] rounded-2xl bg-slate-800 text-white text-lg font-extrabold active:scale-[0.99]"
        >
          Resume ({formatMmSs(rem)})
        </button>
      )}
      {done && <p className="text-center text-sm font-black text-emerald-700 py-1">Block complete</p>}
    </div>
  );
}

function StructuredRoundsBlock({
  block,
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

  const handleStartRest = () => {
    onSession(structuredStartRest(session, block.id));
  };

  const handleExtraRoundTap = () => {
    if (live.extraRoundState === "available") {
      patch({ ...live, extraRoundState: "armed" });
      return;
    }
    if (live.extraRoundState === "armed") {
      onSession(structuredCompleteExtraRoundAndStartRest(session, block.id));
    }
  };

  const pending = live.status === "rounds_complete_pending_decision";
  const showMainRoundButton =
    live.status === "not_started" ||
    (live.status === "active" && live.completedRounds < live.targetRounds);

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 space-y-3 min-w-0 max-w-full">
      <div className="flex justify-start items-start gap-2 min-w-0">
        <h3 className="text-lg font-extrabold text-slate-900 flex-1 min-w-0 break-words [overflow-wrap:anywhere]">
          {fixedRoundsBlockHeader(block, index)}
        </h3>
        <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums pt-0.5">
          {index + 1}/{total}
        </span>
      </div>
      {live.status === "active" && live.completedRounds < live.targetRounds && (
        <p className="text-sm font-bold text-slate-700">
          Round {live.completedRounds + 1} / {live.targetRounds}
        </p>
      )}
      <ul className="space-y-2">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-base min-w-0 break-words [overflow-wrap:anywhere]">
            <span className="font-bold text-slate-900">{ex.name}</span>
            <span className="text-slate-600"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {block.coaching && <p className="text-xs text-slate-500">{block.coaching}</p>}

      {showMainRoundButton && (
        <button
          type="button"
          onClick={live.status === "not_started" ? handleStartBlock : handleRoundDone}
          className="w-full min-h-[56px] rounded-2xl bg-blue-600 text-white text-lg font-extrabold active:scale-[0.99]"
        >
          {live.status === "not_started"
            ? "Start block"
            : `Round ${live.completedRounds + 1} done`}
        </button>
      )}

      {pending && (
        <div className="space-y-3 pt-3 border-t-2 border-emerald-200 bg-emerald-50/60 -mx-1 px-3 py-3 rounded-xl">
          <p className="text-base font-extrabold text-emerald-950 text-center leading-snug">
            All required rounds complete
          </p>
          <p className="text-xs text-center text-slate-700 leading-snug">
            Rest does not start until you choose one option below.
          </p>
          <button
            type="button"
            onClick={handleStartRest}
            className="w-full min-h-[52px] rounded-2xl bg-slate-900 text-white font-extrabold text-base shadow-md"
          >
            Start rest
          </button>
          <button
            type="button"
            onClick={handleExtraRoundTap}
            className="w-full min-h-[52px] rounded-2xl border-2 border-dashed border-slate-500 bg-white text-slate-900 font-bold"
          >
            {live.extraRoundState === "armed" ? "Extra round done" : "Extra round"}
          </button>
        </div>
      )}
    </div>
  );
}

export function LiveBlockRouter({
  block,
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
        <AmrapTimedBlock block={block} index={index} total={total} live={normalized} session={session} onSession={onSession} />
      );
    case "structured_rounds":
      return (
        <StructuredRoundsBlock
          block={block}
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
}: {
  rest: WorkoutCoachRestTimer;
  session: WorkoutCoachLiveSession;
  onSession: SessionUpdater;
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

  return <WorkoutRestTimerBar rest={rest} onPause={pause} onResume={resume} />;
}
