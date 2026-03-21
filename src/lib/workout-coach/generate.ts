import type {
  DayData,
  GeneratedWorkout,
  WorkoutCoachBlock,
  WorkoutCoachRotation,
  WorkoutCoachSavedExercise,
  WorkoutCoachVariant,
} from "@/types";
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

function id(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

/** Included in total workout length for every strength session. */
export const STRENGTH_WARMUP_MINUTES = 4;

export function createDefaultWarmupBlock(): WorkoutCoachBlock {
  return {
    id: id(),
    kind: "warmup",
    title: "Warm-up (3–4 min)",
    minutes: STRENGTH_WARMUP_MINUTES,
    exercises: [
      { name: "Bodyweight squats", detail: "10 reps" },
      { name: "Push-ups", detail: "10 reps" },
      { name: "Plank", detail: "20s" },
      { name: "Arm circles", detail: "10 each way" },
    ],
  };
}

function buildWarmupBlock(): WorkoutCoachBlock {
  return createDefaultWarmupBlock();
}

function standardStrengthBlocks(
  short: boolean,
  low: boolean,
  intensity: IntensityMode,
  b1: Block1PairId,
  b2: Block2PatternId,
  b3: Block3PatternId,
  recoveryMode: boolean
): WorkoutCoachBlock[] {
  const w = resolveEquipment(intensity);
  const m = minutesForBlocks(short, low, recoveryMode);

  const amrapTitle = recoveryMode ? `${m.b1} min easy flow` : `${m.b1} min AMRAP`;

  return [
    buildWarmupBlock(),
    {
      id: id(),
      kind: "amrap",
      title: amrapTitle,
      minutes: m.b1,
      exercises: buildBlock1Pair(b1, w),
      coaching: recoveryMode ? "Easy pace. No grind." : undefined,
    },
    {
      id: id(),
      kind: "structured_push",
      title: `${ROUND_PUSH} rounds`,
      minutes: m.b2,
      roundTarget: ROUND_PUSH,
      exercises: buildBlock2(b2, w, low),
      coaching: recoveryMode ? "Light loads. Full rest between sets." : undefined,
    },
    {
      id: id(),
      kind: "core_circuit",
      title: `${ROUND_CORE} rounds`,
      minutes: m.b3,
      roundTarget: ROUND_CORE,
      exercises: buildBlock3(b3, w),
      coaching: recoveryMode ? "Controlled reps." : undefined,
    },
  ];
}

function ladderBlock(low: boolean): WorkoutCoachBlock[] {
  const w = resolveEquipment(low ? "low" : "normal");
  return [
    buildWarmupBlock(),
    {
      id: id(),
      kind: "kb_ladder",
      title: "24 min AMRAP",
      minutes: 24,
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
    const workout: GeneratedWorkout = {
      id: id(),
      generatedAt: Date.now(),
      variant: "short",
      blocks: [
        buildWarmupBlock(),
        {
          id: id(),
          kind: "core_circuit",
          title: "1 round",
          minutes: 8,
          roundTarget: 1,
          exercises: buildOptionalEasyCore(w),
          coaching: undefined,
        },
      ],
    };
    return {
      workout,
      rotation: advanceRotationBootcampOptional(rotation),
    };
  }

  if (useLadder) {
    const workout: GeneratedWorkout = {
      id: id(),
      generatedAt: Date.now(),
      variant: "ladder",
      blocks: ladderBlock(low),
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

  const blocks = standardStrengthBlocks(short, low, intensity, b1, b2, b3, recoveryMode);
  const stretchGoal = undefined;

  const workout: GeneratedWorkout = {
    id: id(),
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
