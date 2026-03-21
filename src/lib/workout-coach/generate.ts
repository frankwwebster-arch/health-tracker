import type {
  DayData,
  GeneratedWorkout,
  WorkoutCoachBlock,
  WorkoutCoachRotation,
  WorkoutCoachSavedExercise,
  WorkoutCoachVariant,
} from "@/types";
import {
  clampWarmupCooldownMinutes,
  createCooldownBlock,
  createDefaultWarmupBlock,
  newWorkoutBlockId,
} from "./block-factory";
import { todayHasBootcampLike, hasStrengthPelotonToday } from "./peloton";
import { resolveEquipment, type IntensityMode } from "./equipment";
import {
  buildBlock1Pair,
  buildBlock2,
  buildBlock3,
  buildOptionalEasyCore,
  buildSwingLadderBlock,
  type Block1PairId,
  type Block2PatternId,
  type Block3PatternId,
} from "./library";
import {
  advanceRotationBootcampOptional,
  advanceRotationLadder,
  advanceRotationStandard,
  pickBlock1PairId,
  pickBlock2PatternId,
  pickBlock3PatternId,
} from "./rotation";

const ROUND_PUSH = 3;
const ROUND_CORE = 3;

export {
  createDefaultWarmupBlock,
  MIN_WARMUP_COOLDOWN_MINUTES,
  STRENGTH_WARMUP_MINUTES,
} from "./block-factory";

export interface GenerateContext {
  today: DayData;
  yesterday: DayData | null;
  preferShort: boolean;
  preferLowEnergy: boolean;
  /** Fatigue streak override — short, easy, no ladder / no AMRAP grind */
  recoveryMode?: boolean;
  savedExercises?: WorkoutCoachSavedExercise[];
  /** Required — drives rotation memory */
  rotation: WorkoutCoachRotation;
}

export interface GenerateWorkoutResult {
  workout: GeneratedWorkout;
  rotation: WorkoutCoachRotation;
}

function minutesForBlocks(
  short: boolean,
  low: boolean,
  recoveryMode: boolean
): { b1: number; b2: number; b3: number } {
  if (recoveryMode) return { b1: 8, b2: 7, b3: 7 };
  if (low) return { b1: 10, b2: 8, b3: 8 };
  if (short) return { b1: 9, b2: 9, b3: 8 };
  return { b1: 11, b2: 10, b3: 9 };
}

/** Deterministic 4 / 5 / 6 min for coach-adjusted warm-up / cool-down. */
function coachTimedEdgeMinutes(workoutId: string, salt: number): 4 | 5 | 6 {
  let h = salt;
  for (let i = 0; i < workoutId.length; i++) h = (h * 31 + workoutId.charCodeAt(i)) | 0;
  return clampWarmupCooldownMinutes(4 + (Math.abs(h) % 3));
}

function buildWarmupBlock(workoutId: string): WorkoutCoachBlock {
  return createDefaultWarmupBlock(coachTimedEdgeMinutes(workoutId, 0));
}

function standardStrengthBlocks(
  short: boolean,
  low: boolean,
  intensity: IntensityMode,
  b1: Block1PairId,
  b2: Block2PatternId,
  b3: Block3PatternId,
  recoveryMode: boolean,
  workoutId: string
): WorkoutCoachBlock[] {
  const w = resolveEquipment(intensity);
  const m = minutesForBlocks(short, low, recoveryMode);

  const amrapTitle = `${m.b1} min AMRAP`;

  return [
    buildWarmupBlock(workoutId),
    {
      id: newWorkoutBlockId(),
      kind: "amrap",
      blockType: "amrap_timed",
      title: amrapTitle,
      minutes: m.b1,
      durationSeconds: m.b1 * 60,
      exercises: buildBlock1Pair(b1, w),
      coaching: recoveryMode ? "Easy pace. No grind." : undefined,
    },
    {
      id: newWorkoutBlockId(),
      kind: "structured_push",
      blockType: "structured_rounds",
      title: `${ROUND_PUSH} rounds`,
      minutes: m.b2,
      roundTarget: ROUND_PUSH,
      targetRounds: ROUND_PUSH,
      exercises: buildBlock2(b2, w, low),
      coaching: recoveryMode ? "Light loads. Full rest between sets." : undefined,
    },
    {
      id: newWorkoutBlockId(),
      kind: "core_circuit",
      blockType: "structured_rounds",
      title: `${ROUND_CORE} rounds`,
      minutes: m.b3,
      roundTarget: ROUND_CORE,
      targetRounds: ROUND_CORE,
      exercises: buildBlock3(b3, w),
      coaching: recoveryMode ? "Controlled reps." : undefined,
    },
  ];
}

function ladderBlock(low: boolean, workoutId: string): WorkoutCoachBlock[] {
  const w = resolveEquipment(low ? "low" : "normal");
  return [
    buildWarmupBlock(workoutId),
    {
      id: newWorkoutBlockId(),
      kind: "kb_ladder",
      blockType: "amrap_timed",
      title: "24 min AMRAP",
      minutes: 24,
      durationSeconds: 24 * 60,
      exercises: buildSwingLadderBlock(w),
      coaching: undefined,
    },
  ];
}

/**
 * Smart generator: same framework each time; variety from rotation + prefs.
 */
export function generateWorkout(ctx: GenerateContext): GenerateWorkoutResult {
  const { today, yesterday, preferShort, preferLowEnergy, recoveryMode: recoveryModeOpt, rotation } =
    ctx;
  const recoveryMode = recoveryModeOpt === true;

  const bootcampToday = todayHasBootcampLike(today);
  const strengthYesterday =
    yesterday != null &&
    ((yesterday.workoutMinutes != null && yesterday.workoutMinutes >= 20) ||
      hasStrengthPelotonToday(yesterday) ||
      (yesterday.workoutSessions ?? []).some((s) =>
        (s.discipline ?? "").toLowerCase().includes("strength")
      ));

  const short = recoveryMode || preferShort || strengthYesterday;
  const low = recoveryMode || preferLowEnergy || strengthYesterday;
  const intensity: IntensityMode = low ? "low" : "normal";

  const useLadder =
    !recoveryMode &&
    !bootcampToday &&
    !preferShort &&
    !low &&
    !strengthYesterday &&
    rotation.generationsSinceLadder >= 3;

  if (bootcampToday) {
    const w = resolveEquipment("low");
    const workoutId = newWorkoutBlockId();
    const workout: GeneratedWorkout = {
      id: workoutId,
      generatedAt: Date.now(),
      variant: "short",
      blocks: [
        buildWarmupBlock(workoutId),
        {
          id: newWorkoutBlockId(),
          kind: "core_circuit",
          blockType: "structured_rounds",
          title: "1 round",
          minutes: 8,
          roundTarget: 1,
          targetRounds: 1,
          exercises: buildOptionalEasyCore(w),
          coaching: undefined,
        },
        createCooldownBlock(workoutId, coachTimedEdgeMinutes(workoutId, 11)),
      ],
    };
    return {
      workout,
      rotation: advanceRotationBootcampOptional(rotation),
    };
  }

  if (useLadder) {
    const workoutId = newWorkoutBlockId();
    const workout: GeneratedWorkout = {
      id: workoutId,
      generatedAt: Date.now(),
      variant: "ladder",
      blocks: [...ladderBlock(low, workoutId), createCooldownBlock(workoutId, coachTimedEdgeMinutes(workoutId, 11))],
      stretchGoal: undefined,
    };
    return {
      workout,
      rotation: advanceRotationLadder(rotation),
    };
  }

  const b1 = pickBlock1PairId(rotation, low);
  const b2 = pickBlock2PatternId(rotation);
  const b3 = pickBlock3PatternId(rotation);

  const variant: WorkoutCoachVariant = recoveryMode || preferLowEnergy
    ? "low_energy"
    : short
      ? "short"
      : "standard";

  const workoutId = newWorkoutBlockId();
  const blocks = [
    ...standardStrengthBlocks(short, low, intensity, b1, b2, b3, recoveryMode, workoutId),
    createCooldownBlock(workoutId, coachTimedEdgeMinutes(workoutId, 11)),
  ];
  const stretchGoal = undefined;

  const workout: GeneratedWorkout = {
    id: workoutId,
    generatedAt: Date.now(),
    variant,
    blocks,
    stretchGoal,
  };

  return {
    workout,
    rotation: advanceRotationStandard(rotation, b1, b2, b3),
  };
}
