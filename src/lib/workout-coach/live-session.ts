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
  };
}

export function deriveTimedRemainingSeconds(
  live: WarmupCooldownTimedLiveState | AmrapTimedLiveState
): number {
  if (live.status === "active" && live.endAtEpochMs != null) {
    return Math.max(0, Math.ceil((live.endAtEpochMs - Date.now()) / 1000));
  }
  return live.remainingSeconds;
}

export function deriveRestRemainingSeconds(rest: WorkoutCoachRestTimer): number {
  if (rest.endAtEpochMs != null) {
    return Math.max(0, Math.ceil((rest.endAtEpochMs - Date.now()) / 1000));
  }
  return rest.remainingSeconds;
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

/** AMRAP work timer hit zero: mark block completed and start inter-block rest (auto-started). */
export function completeAmrapWorkAndStartRest(
  session: WorkoutCoachLiveSession,
  blockId: string
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
  return {
    ...session,
    sessionStarted: started,
    workoutStatus: started ? "in_progress" : session.workoutStatus,
  };
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
