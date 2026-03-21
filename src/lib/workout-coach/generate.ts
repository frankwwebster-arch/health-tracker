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

  const b1Title = recoveryMode
    ? `Block 1 — Easy flow lower + pull (${m.b1} min)`
    : `Block 1 — AMRAP lower + pull (${m.b1} min)`;
  const b1Coaching = recoveryMode
    ? "Recovery session — steady breathing, no grind. Simple patterns; leave energy in the tank."
    : "Lower / hinge + pull in one flowing block. Pair patterns; avoid doubling heavy leg fatigue unless you want a hard conditioning bias.";

  return [
    {
      id: id(),
      kind: "amrap",
      title: b1Title,
      minutes: m.b1,
      exercises: buildBlock1Pair(b1, w),
      coaching: b1Coaching,
    },
    {
      id: id(),
      kind: "structured_push",
      title: `Block 2 — Structured push (${m.b2} min)`,
      minutes: m.b2,
      exercises: buildBlock2(b2, w, low),
      coaching: recoveryMode
        ? "Light loads, full rest between sets — form and calm breathing over volume."
        : "Bench and shoulder work stay structured (sets/reps), not AMRAP. Rest 45–60s. Progress via reps, top sets, and control — not exercise churn.",
    },
    {
      id: id(),
      kind: "core_circuit",
      title: `Block 3 — Core circuit (${m.b3} min)`,
      minutes: m.b3,
      exercises: buildBlock3(b3, w),
      coaching: recoveryMode
        ? "Easy rounds — quality reps, no rush."
        : "2–3 controlled rounds — not rushed. Dead bugs, leg raises, and carries are staples; RKC plank uses Quick Timer.",
    },
  ];
}

function ladderBlock(low: boolean): WorkoutCoachBlock[] {
  const w = resolveEquipment(low ? "low" : "normal");
  return [
    {
      id: id(),
      kind: "kb_ladder",
      title: "Conditioning — KB swing ladder + push-ups (~24 min)",
      minutes: 24,
      exercises: buildSwingLadderBlock(w),
      coaching:
        "Rungs: 5-10-15-20-15-10-5 swings. Push-ups between each swing set. One rung at a time; walk between if needed.",
    },
  ];
}

/**
 * Smart generator: same framework each time; variety from rotation + prefs.
 * Dashboard “saved” exercises are reserved for future substitution; core library drives structure.
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

  // —— Bootcamp optional easy core ——————————————————————————————
  if (bootcampToday) {
    const w = resolveEquipment("low");
    const workout: GeneratedWorkout = {
      id: id(),
      generatedAt: Date.now(),
      variant: "short",
      blocks: [
        {
          id: id(),
          kind: "core_circuit",
          title: "Optional — easy reset (8 min)",
          minutes: 8,
          exercises: buildOptionalEasyCore(w),
          coaching: "Bootcamp already loaded you. Skip or go easy.",
        },
      ],
    };
    return {
      workout,
      rotation: advanceRotationBootcampOptional(rotation),
    };
  }

  // —— Swing ladder conditioning ————————————————————————————————
  if (useLadder) {
    const workout: GeneratedWorkout = {
      id: id(),
      generatedAt: Date.now(),
      variant: "ladder",
      blocks: ladderBlock(low),
      stretchGoal:
        "Progression = smoother rungs, cleaner push-ups, consistent hinge — not new exercises every week.",
    };
    return {
      workout,
      rotation: advanceRotationLadder(rotation),
    };
  }

  // —— Standard / short / low strength ——————————————————————————
  const b1 = pickBlock1PairId(rotation, low);
  const b2 = pickBlock2PatternId(rotation);
  const b3 = pickBlock3PatternId(rotation);

  const variant: WorkoutCoachVariant = recoveryMode || preferLowEnergy
    ? "low_energy"
    : short
      ? "short"
      : "standard";

  const blocks = standardStrengthBlocks(short, low, intensity, b1, b2, b3, recoveryMode);
  const stretchGoal =
    !recoveryMode && !low && !short
      ? "Progression: more quality rounds in Block 1, optional 15kg bench top set when fresh, tighter core rounds — same structure week to week."
      : undefined;

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
