/**
 * Exercise library + formatted lines (exact weights, reps, notes).
 * Same framework each session — variation inside rotation, not random churn.
 */

import type { WorkoutCoachExercise } from "@/types";
import type { ResolvedEquipment } from "./equipment";
import type { WorkoutCoachSavedExercise } from "@/types";

function ex(name: string, parts: string[]): WorkoutCoachExercise {
  return { name, detail: parts.filter(Boolean).join(" — ") };
}

// —— Block 1: AMRAP lower + pull (2 movements) ————————————————————

export const BLOCK1_PAIR_IDS = [
  "goblet_row",
  "swings_row",
  "rdl_row",
  "thruster_row",
  "goblet_band_row",
  "swings_band_row",
  /** Low-energy / reset days only */
  "glute_bridge_band_row",
] as const;

export type Block1PairId = (typeof BLOCK1_PAIR_IDS)[number];
export type WorkoutIntensityProfile = "standard" | "low" | "recovery";

export function buildBlock1Pair(
  pairId: Block1PairId,
  w: ResolvedEquipment,
  profile: WorkoutIntensityProfile = "standard"
): WorkoutCoachExercise[] {
  const isLow = profile !== "standard";
  const isRecovery = profile === "recovery";
  switch (pairId) {
    case "goblet_row":
      return [
        ex("Goblet squats", [
          w.kbGoblet,
          "squat wedge (default: use wedge)",
          isLow ? "8 reps" : "10 reps",
        ]),
        ex("One-arm KB rows", [w.kbRow, isLow ? "8 reps each side" : "10 reps each side", "strict pull"]),
      ];
    case "swings_row":
      return [
        ex("Kettlebell swings", [w.kbSwing, isRecovery ? "8 reps per set" : isLow ? "10 reps per set" : "12 reps per set", "drive through hips"]),
        ex("One-arm KB rows", [w.kbRow, isLow ? "8 reps each side" : "10 reps each side"]),
      ];
    case "rdl_row":
      return [
        ex("Romanian deadlifts", [w.kbRdl + " KB", isLow ? "8 reps" : "10 reps", "smooth tempo"]),
        ex("One-arm KB rows", [w.kbRow, isLow ? "8 reps each side" : "10 reps each side"]),
      ];
    case "thruster_row":
      return [
        ex("Thrusters", [w.kbThruster + " KB", "front rack", isLow ? "6 reps" : "8 reps", "squat to overhead"]),
        ex("One-arm KB rows", [w.kbRow, isLow ? "8 reps each side" : "10 reps each side"]),
      ];
    case "goblet_band_row":
      return [
        ex("Goblet squats", [w.kbGoblet, "squat wedge", isLow ? "8 reps" : "10 reps"]),
        ex("Band rows / face pulls", ["band", isLow ? "12 reps" : "14 reps", "posture, squeeze back"]),
      ];
    case "swings_band_row":
      return [
        ex("Kettlebell swings", [w.kbSwing, isRecovery ? "8 reps" : isLow ? "10 reps" : "12 reps", "power from hips"]),
        ex("Band rows / face pulls", ["band", isLow ? "12 reps" : "14 reps"]),
      ];
    case "glute_bridge_band_row":
      return [
        ex("Glute bridges / hip thrusts", ["bodyweight or light KB on hips", isLow ? "10 reps" : "12 reps", "pause 1s at top"]),
        ex("Band rows / face pulls", ["band", isLow ? "12 reps" : "14 reps", "posture"]),
      ];
    default:
      return buildBlock1Pair("goblet_row", w, profile);
  }
}

// —— Block 2: structured push ——————————————————————————————

export const BLOCK2_PATTERN_IDS = [
  "bench_shoulder",
  "bench_pushups",
  "shoulder_pushups",
] as const;

export type Block2PatternId = (typeof BLOCK2_PATTERN_IDS)[number];

export function buildBlock2(
  patternId: Block2PatternId,
  w: ResolvedEquipment,
  low: boolean,
  profile: WorkoutIntensityProfile = "standard"
): WorkoutCoachExercise[] {
  const isLow = profile !== "standard";
  const benchParts = [
    w.dbBenchPair,
    isLow ? "6 reps" : "8 reps",
    "strict reps",
  ];
  if (!low && profile === "standard") benchParts.push("optional top set at 15kg pair");
  const bench = ex("Dumbbell bench press", benchParts);
  const shoulder = ex("Dumbbell shoulder press", [
    w.dbShoulderPair,
    isLow ? "6 reps" : "8 reps",
    "no tiptoes",
    "strict reps",
  ]);
  const pushups = ex("Push-ups", [
    "10 reps",
    "drop to knees if form breaks",
  ]);

  switch (patternId) {
    case "bench_shoulder":
      return [bench, shoulder];
    case "bench_pushups":
      return [bench, pushups];
    case "shoulder_pushups":
      return [shoulder, pushups];
    default:
      return [bench, shoulder];
  }
}


// —— Block 3: controlled core circuit —————————————————————————

export const BLOCK3_PATTERN_IDS = [
  "staple_carry_deadbug_raises",
  "staple_deadbug_raises_carry",
  "staple_with_rkc_timer",
  "weighted_side_plank_drag_deadbug",
  "halfkneeling_press_plank_drag_row",
  "renegade_pushup_deadbug_pullover",
] as const;

export type Block3PatternId = (typeof BLOCK3_PATTERN_IDS)[number];

export function buildBlock3(
  patternId: Block3PatternId,
  w: ResolvedEquipment,
  profile: WorkoutIntensityProfile = "standard"
): WorkoutCoachExercise[] {
  const isLow = profile !== "standard";
  const deadbug = ex("Dead bug pullovers", [w.dbDeadBug, isLow ? "6 reps each side" : "8 reps each side", "ribs down"]);
  const legRaises = ex("Bench leg raises", [w.dbLegRaise + " (optional)", isLow ? "6 reps" : "8 reps", "smooth tempo"]);
  const carry = ex("Suitcase carries", ["24kg", "1 length each side per round", "anti-rotation"]);
  const rkc = ex("RKC plank", ["20s hold", "high tension"]);
  const weightedSidePlank = ex("Weighted side plank", ["light dumbbell", "20s each side", "brace hard"]);
  const plankDbDrag = ex("Plank dumbbell drag", [isLow ? "8 drags each side" : "10 drags each side", "hips square"]);
  const halfKneelingPress = ex("Half-kneeling press", [w.dbShoulderPair, isLow ? "6 reps each side" : "8 reps each side", "ribs down"]);
  const crossBodyDeadbugPullover = ex("Cross-body dead bug pullover", [w.dbDeadBug, isLow ? "6 reps each side" : "8 reps each side", "brace hard"]);
  const sidePlankRow = ex("Side plank row", [w.kbRow, isLow ? "6 reps each side" : "8 reps each side", "anti-rotation"]);
  const renegadeRowPushup = ex("Renegade row to push-up", [w.dbBenchPair, isLow ? "5 reps each side" : "6 reps each side", "strict reps"]);

  switch (patternId) {
    case "staple_carry_deadbug_raises":
      return [carry, deadbug, legRaises];
    case "staple_deadbug_raises_carry":
      return [deadbug, legRaises, carry];
    case "staple_with_rkc_timer":
      return [deadbug, legRaises, carry, rkc];
    case "weighted_side_plank_drag_deadbug":
      return [weightedSidePlank, plankDbDrag, crossBodyDeadbugPullover];
    case "halfkneeling_press_plank_drag_row":
      return [halfKneelingPress, plankDbDrag, sidePlankRow];
    case "renegade_pushup_deadbug_pullover":
      return [renegadeRowPushup, deadbug, carry];
    default:
      return [deadbug, legRaises, carry];
  }
}

/** Optional bootcamp-day block — minimal, controlled. */
export function buildOptionalEasyCore(w: ResolvedEquipment): WorkoutCoachExercise[] {
  return [
    ex("Dead bug", ["bodyweight", "10 reps each side", "smooth tempo"]),
    ex("Side plank", ["20s each side"]),
  ];
}

/** Swing ladder — spec: 5-10-15-20-15-10-5 @ 24kg, push-ups between sets. */
export function buildSwingLadderBlock(w: ResolvedEquipment): WorkoutCoachExercise[] {
  const kb = w.swingLadderKb;
  return [
    ex("Kettlebell swing ladder", [
      kb,
      "5 → 10 → 15 → 20 → 15 → 10 → 5 swings",
      "one rung at a time",
    ]),
    ex("Push-ups", [
      "8 reps",
      "drop to knees if form breaks",
    ]),
  ];
}

/** Merge Dashboard “extra” lines into a pool of raw exercises (optional substitution later). */
export function savedToExercises(saved: WorkoutCoachSavedExercise[]): WorkoutCoachExercise[] {
  return saved
    .map((s) => ({ name: s.name.trim(), detail: s.detail.trim() }))
    .filter((x) => x.name && x.detail);
}
