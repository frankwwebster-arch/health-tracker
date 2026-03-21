import type {
  AmrapTimedLiveState,
  GeneratedWorkout,
  StructuredRoundsLiveState,
  WarmupCooldownTimedLiveState,
  WorkoutCoachBlock,
  WorkoutCoachBlockLiveState,
  WorkoutCoachLiveSession,
  WorkoutCoachRestTimer,
} from "@/types";
import { normalizeWorkoutBlocks } from "./normalize-blocks";

export const REST_SECONDS = 120;
export type WorkoutCoachTransitionEvent =
  | "AMRAP_COMPLETED"
  | "REST_STARTED"
  | "REST_COMPLETED"
  | "COOLDOWN_COMPLETED"
  | "WORKOUT_COMPLETED";

export interface WorkoutCoachStateMachineStep {
  session: WorkoutCoachLiveSession;
  events: WorkoutCoachTransitionEvent[];
}

export type WorkoutCoachRenderMode = "NONE" | "PREVIEW" | "LIVE" | "COMPLETE";

/**
 * Single source-of-truth render precedence for workout UI.
 * 1) LIVE: live session exists and is in progress
 * 2) COMPLETE: workout is completed
 * 3) PREVIEW: workout exists but not active/completed
 * 4) NONE: no workout
 */
export function resolveWorkoutRenderMode(
  workout: GeneratedWorkout | null | undefined,
  liveSession: WorkoutCoachLiveSession | null | undefined
): WorkoutCoachRenderMode {
  if (!workout) return "NONE";
  if (liveSession?.workoutStatus === "in_progress" && liveSession.sessionStarted === true) {
    return "LIVE";
  }
  if (liveSession?.workoutStatus === "completed") {
    return "COMPLETE";
  }
  return "PREVIEW";
}

/**
 * Explicit entry transition for workout flow.
 * Always creates a fresh in-progress session anchored to block index 0.
 */
export function startWorkoutSession(workout: GeneratedWorkout): WorkoutCoachLiveSession {
  const initial = createInitialLiveSession(workout);
  return setSessionStarted(
    {
      ...initial,
      activeBlockIndex: 0,
      restTimer: null,
    },
    true
  );
}

export function isLiveSessionStale(
  session: WorkoutCoachLiveSession | null | undefined,
  workout: GeneratedWorkout | null
): boolean {
  if (!workout) return true;
  if (!session) return true;
  return session.workoutId !== workout.id || session.workoutGeneratedAt !== workout.generatedAt;
}

/** Exported for UI fallback when blockStates is missing an entry (prevents blank active block). */
export function defaultLiveStateForBlock(block: WorkoutCoachBlock): WorkoutCoachBlockLiveState {
  const bt = block.blockType ?? "amrap_timed";
  if (bt === "structured_rounds") {
    const tr = block.targetRounds ?? block.roundTarget ?? 3;
    return {
      blockId: block.id,
      blockType: "structured_rounds",
      status: "not_started",
      completedRounds: 0,
      targetRounds: tr,
      extraRoundState: "unavailable",
    };
  }
  const ds = block.durationSeconds ?? Math.max(60, block.minutes * 60);
  if (bt === "amrap_timed") {
    return {
      blockId: block.id,
      blockType: "amrap_timed",
      status: "not_started",
      remainingSeconds: ds,
      endAtEpochMs: null,
    };
  }
  return {
    blockId: block.id,
    blockType: bt as "warmup_timed" | "cooldown_timed",
    status: "not_started",
    remainingSeconds: ds,
    endAtEpochMs: null,
  };
}

/** Add default live states for new blocks (e.g. after normalization appends cooldown) without wiping progress. */
export function mergeLiveSessionBlockStates(
  session: WorkoutCoachLiveSession,
  blocks: WorkoutCoachBlock[]
): WorkoutCoachLiveSession {
  let blockStates = { ...session.blockStates };
  let changed = false;
  for (const b of blocks) {
    if (!blockStates[b.id]) {
      blockStates[b.id] = defaultLiveStateForBlock(b);
      changed = true;
    }
  }
  return changed ? { ...session, blockStates } : session;
}

export function createInitialLiveSession(workout: GeneratedWorkout): WorkoutCoachLiveSession {
  const blocks = normalizeWorkoutBlocks(workout.blocks, {
    id: workout.id,
    generatedAt: workout.generatedAt,
  });
  const blockStates: Record<string, WorkoutCoachBlockLiveState> = {};
  for (const b of blocks) {
    blockStates[b.id] = defaultLiveStateForBlock(b);
  }
  return {
    workoutId: workout.id,
    workoutGeneratedAt: workout.generatedAt,
    sessionStarted: false,
    workoutStatus: "preview",
    activeBlockIndex: 0,
    blockStates,
    restTimer: null,
    sessionStartEpochMs: null,
  };
}

export function deriveTimedRemainingSeconds(
  live: WarmupCooldownTimedLiveState | AmrapTimedLiveState
): number {
  return deriveTimedRemainingSecondsAt(live, Date.now());
}

export function deriveTimedRemainingSecondsAt(
  live: WarmupCooldownTimedLiveState | AmrapTimedLiveState,
  nowEpochMs: number
): number {
  if (live.status === "active" && live.endAtEpochMs != null) {
    return Math.max(0, Math.ceil((live.endAtEpochMs - nowEpochMs) / 1000));
  }
  return Math.max(0, live.remainingSeconds);
}

export function deriveRestRemainingSeconds(rest: WorkoutCoachRestTimer): number {
  return deriveRestRemainingSecondsAt(rest, Date.now());
}

export function deriveRestRemainingSecondsAt(
  rest: WorkoutCoachRestTimer,
  nowEpochMs: number
): number {
  if (rest.endAtEpochMs != null) {
    return Math.max(0, Math.ceil((rest.endAtEpochMs - nowEpochMs) / 1000));
  }
  return Math.max(0, rest.remainingSeconds);
}

function activateRestTimer(
  session: WorkoutCoachLiveSession,
  sourceBlockId: string,
  autoStarted: boolean
): WorkoutCoachLiveSession {
  const now = Date.now();
  return {
    ...session,
    restTimer: {
      active: true,
      sourceBlockId,
      durationSeconds: REST_SECONDS,
      remainingSeconds: REST_SECONDS,
      autoStarted,
      endAtEpochMs: now + REST_SECONDS * 1000,
    },
  };
}

/** Warm-up / cooldown: complete work segment, advance index or end workout (no inter-block rest). */
export function completeWarmupCooldownWork(
  session: WorkoutCoachLiveSession,
  blockId: string,
  blocks: WorkoutCoachBlock[]
): WorkoutCoachLiveSession {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return session;
  const live = session.blockStates[blockId] as WarmupCooldownTimedLiveState;
  const nextLive: WarmupCooldownTimedLiveState = {
    ...live,
    status: "completed",
    remainingSeconds: 0,
    endAtEpochMs: null,
  };
  const blockStates = { ...session.blockStates, [blockId]: nextLive };
  const idx = blocks.findIndex((b) => b.id === blockId);
  const nextIdx = idx + 1;
  if (nextIdx >= blocks.length) {
    return {
      ...session,
      blockStates,
      workoutStatus: "completed",
    };
  }
  return {
    ...session,
    blockStates,
    activeBlockIndex: nextIdx,
  };
}

/** AMRAP work timer hit zero: mark block complete; start rest unless next block is cooldown. */
export function completeAmrapWorkAndStartRest(
  session: WorkoutCoachLiveSession,
  blockId: string,
  blocks: WorkoutCoachBlock[]
): WorkoutCoachLiveSession {
  const live = session.blockStates[blockId] as AmrapTimedLiveState;
  const nextLive: AmrapTimedLiveState = {
    ...live,
    status: "completed",
    remainingSeconds: 0,
    endAtEpochMs: null,
  };
  const blockStates = { ...session.blockStates, [blockId]: nextLive };
  let s: WorkoutCoachLiveSession = { ...session, blockStates };
  const idx = blocks.findIndex((b) => b.id === blockId);
  const nextBlock = idx >= 0 ? blocks[idx + 1] : undefined;
  if (nextBlock?.blockType === "cooldown_timed") {
    return { ...s, activeBlockIndex: idx + 1 };
  }
  return activateRestTimer(s, blockId, true);
}

/** Rest timer reached zero: advance to next block or finish workout. */
export function completeRestTimer(
  session: WorkoutCoachLiveSession,
  blocks: WorkoutCoachBlock[]
): WorkoutCoachLiveSession {
  const s: WorkoutCoachLiveSession = { ...session, restTimer: null };
  const nextIdx = s.activeBlockIndex + 1;
  if (nextIdx >= blocks.length) {
    return { ...s, workoutStatus: "completed" };
  }
  return { ...s, activeBlockIndex: nextIdx };
}

/**
 * Single explicit state-machine step.
 * Executes at most one transition per call:
 * - block_active(amrap <= 0) -> block_completed + rest_active
 * - rest_active(rest <= 0) -> rest_completed + next block/workout_complete
 * - block_active(cooldown <= 0) -> block_completed + workout_complete
 */
export function stepWorkoutStateMachine(
  session: WorkoutCoachLiveSession,
  blocks: WorkoutCoachBlock[],
  nowEpochMs: number = Date.now()
): WorkoutCoachStateMachineStep {
  const events: WorkoutCoachTransitionEvent[] = [];

  if (session.workoutStatus === "completed") {
    return { session, events };
  }

  if (session.restTimer?.active) {
    const rem = deriveRestRemainingSecondsAt(session.restTimer, nowEpochMs);
    if (rem <= 0) {
      const next = completeRestTimer(
        {
          ...session,
          restTimer: {
            ...session.restTimer,
            remainingSeconds: 0,
            endAtEpochMs: null,
          },
        },
        blocks
      );
      events.push("REST_COMPLETED");
      if (next.workoutStatus === "completed") {
        events.push("WORKOUT_COMPLETED");
      }
      return { session: next, events };
    }
    return { session, events };
  }

  const idx = session.activeBlockIndex;
  const block = blocks[idx];
  if (!block) return { session, events };

  const live = session.blockStates[block.id];
  if (!live || live.blockType === "structured_rounds") {
    return { session, events };
  }
  if (live.status !== "active") {
    return { session, events };
  }

  const rem = deriveTimedRemainingSecondsAt(
    live as WarmupCooldownTimedLiveState | AmrapTimedLiveState,
    nowEpochMs
  );
  if (rem > 0) return { session, events };

  if (live.blockType === "amrap_timed") {
    const next = completeAmrapWorkAndStartRest(
      {
        ...session,
        blockStates: {
          ...session.blockStates,
          [block.id]: {
            ...(live as AmrapTimedLiveState),
            remainingSeconds: 0,
            endAtEpochMs: null,
          },
        },
      },
      block.id,
      blocks
    );
    events.push("AMRAP_COMPLETED", "REST_STARTED");
    return { session: next, events };
  }

  if (live.blockType === "warmup_timed" || live.blockType === "cooldown_timed") {
    const next = completeWarmupCooldownWork(
      {
        ...session,
        blockStates: {
          ...session.blockStates,
          [block.id]: {
            ...(live as WarmupCooldownTimedLiveState),
            remainingSeconds: 0,
            endAtEpochMs: null,
          },
        },
      },
      block.id,
      blocks
    );
    if (live.blockType === "cooldown_timed") {
      events.push("COOLDOWN_COMPLETED");
    }
    if (next.workoutStatus === "completed") {
      events.push("WORKOUT_COMPLETED");
    }
    return { session: next, events };
  }

  return { session, events };
}

/** Structured: Start Rest — block marked complete immediately (green/collapsed), then 2 min rest (manual semantics). */
export function structuredStartRest(
  session: WorkoutCoachLiveSession,
  blockId: string
): WorkoutCoachLiveSession {
  const live = session.blockStates[blockId] as StructuredRoundsLiveState;
  const next: StructuredRoundsLiveState = {
    ...live,
    status: "completed",
    extraRoundState: "unavailable",
  };
  const blockStates = { ...session.blockStates, [blockId]: next };
  let s: WorkoutCoachLiveSession = { ...session, blockStates };
  return activateRestTimer(s, blockId, false);
}

/** Structured: extra round done — block complete, auto-started rest. */
export function structuredCompleteExtraRoundAndStartRest(
  session: WorkoutCoachLiveSession,
  blockId: string
): WorkoutCoachLiveSession {
  const live = session.blockStates[blockId] as StructuredRoundsLiveState;
  const next: StructuredRoundsLiveState = {
    ...live,
    status: "completed",
    extraRoundState: "completed",
  };
  const blockStates = { ...session.blockStates, [blockId]: next };
  let s: WorkoutCoachLiveSession = { ...session, blockStates };
  return activateRestTimer(s, blockId, true);
}

export function setSessionStarted(session: WorkoutCoachLiveSession, started: boolean): WorkoutCoachLiveSession {
  const now = Date.now();
  return {
    ...session,
    sessionStarted: started,
    workoutStatus: started ? "in_progress" : session.workoutStatus,
    sessionStartEpochMs:
      started && (session.sessionStartEpochMs == null || session.sessionStartEpochMs <= 0)
        ? now
        : session.sessionStartEpochMs ?? null,
  };
}

/**
 * Minutes to store on Save (wall clock from Begin → Save). Falls back to planned block total if missing.
 */
export function computeSavedWorkoutMinutes(
  session: WorkoutCoachLiveSession | null | undefined,
  fallbackPlannedTotalMinutes: number
): number {
  const start = session?.sessionStartEpochMs;
  if (start == null || start <= 0) {
    return Math.max(1, Math.round(fallbackPlannedTotalMinutes));
  }
  const sec = Math.floor((Date.now() - start) / 1000);
  return Math.max(1, Math.round(sec / 60));
}

export function patchTimedState(
  session: WorkoutCoachLiveSession,
  blockId: string,
  next: WarmupCooldownTimedLiveState | AmrapTimedLiveState
): WorkoutCoachLiveSession {
  return {
    ...session,
    blockStates: { ...session.blockStates, [blockId]: next },
  };
}

export function patchStructuredState(
  session: WorkoutCoachLiveSession,
  blockId: string,
  next: StructuredRoundsLiveState
): WorkoutCoachLiveSession {
  return {
    ...session,
    blockStates: { ...session.blockStates, [blockId]: next },
  };
}

export function patchRestTimer(session: WorkoutCoachLiveSession, rest: WorkoutCoachRestTimer | null): WorkoutCoachLiveSession {
  return { ...session, restTimer: rest };
}

/**
 * Explicit transition for entering a timed block's running state.
 * Supports warmup / amrap / cooldown timed blocks.
 */
export function startTimedBlock(
  session: WorkoutCoachLiveSession,
  blockId: string,
  nowEpochMs: number = Date.now()
): WorkoutCoachLiveSession {
  const live = session.blockStates[blockId];
  if (!live || live.blockType === "structured_rounds") return session;
  if (live.status === "completed") return session;

  const rem = deriveTimedRemainingSecondsAt(
    live as WarmupCooldownTimedLiveState | AmrapTimedLiveState,
    nowEpochMs
  );
  if (rem <= 0) return session;

  const next: WarmupCooldownTimedLiveState | AmrapTimedLiveState = {
    ...(live as WarmupCooldownTimedLiveState | AmrapTimedLiveState),
    status: "active",
    remainingSeconds: rem,
    endAtEpochMs: nowEpochMs + rem * 1000,
  };
  return patchTimedState(session, blockId, next);
}
