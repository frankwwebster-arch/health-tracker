import type { WorkoutCoachBlock, WorkoutCoachBlockKind } from "@/types";

export function workoutBlockKindLabel(kind: WorkoutCoachBlockKind): string {
  switch (kind) {
    case "warmup":
      return "Warm-up";
    case "amrap":
      return "AMRAP";
    case "structured_push":
      return "Structured push";
    case "core_circuit":
      return "Core circuit";
    case "kb_ladder":
      return "KB ladder";
  }
}

/** Blocks that use a countdown timer (time-bounded work). */
export function isTimedAmrapStyleBlock(block: WorkoutCoachBlock): boolean {
  return block.kind === "amrap" || block.kind === "kb_ladder";
}

/** Fixed-round strength blocks (not time-tracked in the runner). */
export function isFixedRoundsBlock(block: WorkoutCoachBlock): boolean {
  return (
    (block.kind === "structured_push" || block.kind === "core_circuit") &&
    block.roundTarget != null &&
    block.roundTarget > 0
  );
}

export function roundsWord(n: number): string {
  return n === 1 ? "Round" : "Rounds";
}

/** One-line header for fixed-round blocks, e.g. "Block 2 — Structured push: 3 Rounds" */
export function fixedRoundsBlockHeader(block: WorkoutCoachBlock, index: number): string {
  const target = block.roundTarget ?? 0;
  const label = workoutBlockKindLabel(block.kind);
  return `Block ${index + 1} — ${label}: ${target} ${roundsWord(target)}`;
}
