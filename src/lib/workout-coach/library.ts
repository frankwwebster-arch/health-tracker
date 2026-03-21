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

export function buildBlock1Pair(
  pairId: Block1PairId,
  w: ResolvedEquipment
): WorkoutCoachExercise[] {
  switch (pairId) {
    case "goblet_row":
      return [
        ex("Goblet squats", [
          w.kbGoblet,
          "squat wedge (default: use wedge)",
          "8–10 reps",
        ]),
        ex("One-arm KB rows", [w.kbRow, "8–10 reps each side", "strict or lawnmower style"]),
      ];
    case "swings_row":
      return [
        ex("Kettlebell swings", [w.kbSwing, "10–15 reps per set", "hinge, crisp lockout"]),
        ex("One-arm KB rows", [w.kbRow, "8–10 reps each side"]),
      ];
    case "rdl_row":
      return [
        ex("Romanian deadlifts", [w.kbRdl + " KB", "8–10 reps", "slow eccentric"]),
        ex("One-arm KB rows", [w.kbRow, "8–10 reps each side"]),
      ];
    case "thruster_row":
      return [
        ex("Thrusters", [w.kbThruster + " KB", "front rack", "8 reps", "squat to overhead"]),
        ex("One-arm KB rows", [w.kbRow, "8–10 reps each side"]),
      ];
    case "goblet_band_row":
      return [
        ex("Goblet squats", [w.kbGoblet, "squat wedge", "8–10 reps"]),
        ex("Band rows / face pulls", ["band", "12–15 reps", "posture, squeeze back"]),
      ];
    case "swings_band_row":
      return [
        ex("Kettlebell swings", [w.kbSwing, "10–12 reps", "power from hips"]),
        ex("Band rows / face pulls", ["band", "12–15 reps"]),
      ];
    case "glute_bridge_band_row":
      return [
        ex("Glute bridges / hip thrusts", ["bodyweight or light KB on hips", "10–15 reps", "pause 1s at top"]),
        ex("Band rows / face pulls", ["band", "12–15 reps", "posture"]),
      ];
    default:
      return buildBlock1Pair("goblet_row", w);
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
  low: boolean
): WorkoutCoachExercise[] {
  const benchParts = [
    w.dbBenchPair,
    "8–10 reps",
    "3 sets — not AMRAP",
  ];
  if (!low) benchParts.push("optional top set: 15kg pair when fresh");
  const bench = ex("Dumbbell bench press", benchParts);
  const shoulder = ex("Dumbbell shoulder press", [
    w.dbShoulderPair,
    "8 reps strict",
    "no tiptoes",
    "controlled lockout",
  ]);
  const pushups = ex("Push-ups", [
    "quality reps",
    "3×8–12 or between ladder sets",
    "stop before form breaks",
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
] as const;

export type Block3PatternId = (typeof BLOCK3_PATTERN_IDS)[number];

export function buildBlock3(patternId: Block3PatternId, w: ResolvedEquipment): WorkoutCoachExercise[] {
  const deadbug = ex("Dead bug pullovers", [w.dbDeadBug, "8 reps each side", "ribs down"]);
  const legRaises = ex("Bench leg raises", [w.dbLegRaise + " (optional)", "6–8 reps", "slow, no rush"]);
  const carry = ex("Suitcase carries", ["24kg", "1 length each side per round", "anti-rotation"]);
  const rkc = ex("RKC plank", ["20s hold", "high tension"]);

  switch (patternId) {
    case "staple_carry_deadbug_raises":
      return [carry, deadbug, legRaises];
    case "staple_deadbug_raises_carry":
      return [deadbug, legRaises, carry];
    case "staple_with_rkc_timer":
      return [deadbug, legRaises, carry, rkc];
    default:
      return [deadbug, legRaises, carry];
  }
}

/** Optional bootcamp-day block — minimal, controlled. */
export function buildOptionalEasyCore(w: ResolvedEquipment): WorkoutCoachExercise[] {
  return [
    ex("Dead bug", ["bodyweight", "2×10 slow"]),
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
      "between each swing set",
      "clean reps",
      "as needed for quality",
    ]),
  ];
}

/** Merge Dashboard “extra” lines into a pool of raw exercises (optional substitution later). */
export function savedToExercises(saved: WorkoutCoachSavedExercise[]): WorkoutCoachExercise[] {
  return saved
    .map((s) => ({ name: s.name.trim(), detail: s.detail.trim() }))
    .filter((x) => x.name && x.detail);
}
