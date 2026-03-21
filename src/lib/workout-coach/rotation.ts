import type { WorkoutCoachRotation } from "@/types";
import {
  BLOCK1_PAIR_IDS,
  BLOCK2_PATTERN_IDS,
  BLOCK3_PATTERN_IDS,
  type Block1PairId,
  type Block2PatternId,
  type Block3PatternId,
} from "./library";

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pushRecent(id: string, list: string[], max = 5): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Prefer not repeating the last 1–2 patterns; pick first in shuffled order that isn’t in `avoid`. */
function pickAvoidingRecent(
  all: readonly string[],
  recent: string[],
  avoidCount = 2
): string {
  const avoid = new Set(recent.slice(0, avoidCount));
  const shuffled = shuffle(all);
  const found = shuffled.find((id) => !avoid.has(id));
  return found ?? shuffled[0] ?? all[0];
}

const BLOCK1_NORMAL = BLOCK1_PAIR_IDS.filter((id) => id !== "glute_bridge_band_row");

/** Block 1 pair candidates for intensity. */
export function block1Candidates(low: boolean, gensSinceThruster: number): Block1PairId[] {
  if (low) {
    return [
      ...BLOCK1_NORMAL.filter((id) => id !== "thruster_row" && id !== "rdl_row"),
      "glute_bridge_band_row",
    ];
  }
  return BLOCK1_NORMAL.filter((id) => {
    if (id === "thruster_row") return gensSinceThruster >= 5;
    return true;
  });
}

export function pickBlock1PairId(
  rotation: WorkoutCoachRotation,
  low: boolean
): Block1PairId {
  const candidates = block1Candidates(low, rotation.gensSinceThruster);
  const picked = pickAvoidingRecent(candidates, rotation.recentBlock1PairIds) as Block1PairId;
  return picked;
}

export function pickBlock2PatternId(rotation: WorkoutCoachRotation): Block2PatternId {
  const picked = pickAvoidingRecent(BLOCK2_PATTERN_IDS, rotation.recentBlock2PatternIds) as Block2PatternId;
  return picked;
}

export function pickBlock3PatternId(rotation: WorkoutCoachRotation): Block3PatternId {
  const picked = pickAvoidingRecent(BLOCK3_PATTERN_IDS, rotation.recentBlock3PatternIds) as Block3PatternId;
  return picked;
}

/** After a standard strength workout (3 blocks). */
export function advanceRotationStandard(
  prev: WorkoutCoachRotation,
  b1: Block1PairId,
  b2: Block2PatternId,
  b3: Block3PatternId
): WorkoutCoachRotation {
  const usedThruster = b1 === "thruster_row";
  return {
    recentBlock1PairIds: pushRecent(b1, prev.recentBlock1PairIds),
    recentBlock2PatternIds: pushRecent(b2, prev.recentBlock2PatternIds),
    recentBlock3PatternIds: pushRecent(b3, prev.recentBlock3PatternIds),
    gensSinceThruster: usedThruster ? 0 : prev.gensSinceThruster + 1,
    generationsSinceLadder: prev.generationsSinceLadder + 1,
  };
}

/** Ladder / conditioning — reset ladder counter; advance thruster gap. */
export function advanceRotationLadder(prev: WorkoutCoachRotation): WorkoutCoachRotation {
  return {
    ...prev,
    gensSinceThruster: prev.gensSinceThruster + 1,
    generationsSinceLadder: 0,
  };
}

/** Bootcamp optional — light touch on rotation. */
export function advanceRotationBootcampOptional(prev: WorkoutCoachRotation): WorkoutCoachRotation {
  return {
    ...prev,
    gensSinceThruster: prev.gensSinceThruster + 1,
    generationsSinceLadder: prev.generationsSinceLadder + 1,
  };
}
