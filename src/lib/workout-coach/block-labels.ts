import type { WorkoutCoachBlock, WorkoutCoachBlockKind, WorkoutCoachExercise } from "@/types";

/** Title-case display for block kind (e.g. Structured Push). */
export function workoutBlockKindDisplayName(kind: WorkoutCoachBlockKind): string {
  switch (kind) {
    case "warmup":
      return "Warm-up";
    case "amrap":
      return "AMRAP";
    case "structured_push":
      return "Structured Push";
    case "core_circuit":
      return "Core Circuit";
    case "kb_ladder":
      return "KB Ladder";
    case "cooldown":
      return "Cool-down";
  }
}

/** @deprecated use workoutBlockKindDisplayName */
export function workoutBlockKindLabel(kind: WorkoutCoachBlockKind): string {
  return workoutBlockKindDisplayName(kind);
}

/** Blocks that use a countdown timer (time-bounded work). */
export function isTimedAmrapStyleBlock(block: WorkoutCoachBlock): boolean {
  if (block.blockType === "amrap_timed") return true;
  return block.kind === "amrap" || block.kind === "kb_ladder";
}

/** Warm-up, cool-down, AMRAP, KB ladder — main timer lives in the block UI, not quick presets. */
export function isTimedCountdownBlock(block: WorkoutCoachBlock): boolean {
  if (
    block.blockType === "warmup_timed" ||
    block.blockType === "cooldown_timed" ||
    block.blockType === "amrap_timed"
  ) {
    return true;
  }
  return (
    block.kind === "warmup" ||
    block.kind === "cooldown" ||
    block.kind === "amrap" ||
    block.kind === "kb_ladder"
  );
}

/** Heuristic: structured block includes a timed hold (plank, etc.) — quick timer presets are relevant. */
export function blockHasHoldLikeExercise(block: WorkoutCoachBlock): boolean {
  return block.exercises.some((ex) =>
    /\b(hold|plank|bridge|iso)\b/i.test(`${ex.name} ${ex.detail}`)
  );
}

/** Fixed-round strength blocks (not time-tracked in the runner). */
export function isFixedRoundsBlock(block: WorkoutCoachBlock): boolean {
  if (block.blockType === "structured_rounds") return true;
  return (
    (block.kind === "structured_push" || block.kind === "core_circuit") &&
    block.roundTarget != null &&
    block.roundTarget > 0
  );
}

export function roundsWord(n: number): string {
  return n === 1 ? "Round" : "Rounds";
}

/** e.g. Block 2 — Structured Push — 3 Rounds */
export function fixedRoundsBlockHeader(block: WorkoutCoachBlock, index: number): string {
  const target = block.targetRounds ?? block.roundTarget ?? 0;
  const label = workoutBlockKindDisplayName(block.kind);
  return `Block ${index + 1} — ${label} — ${target} ${roundsWord(target)}`;
}

/** Warm-up — 4 min, Block 1 — 10 min AMRAP, Cool-down — 4 min (no rounds). */
export function timedBlockDisplayTitle(block: WorkoutCoachBlock, index: number): string {
  const sec = block.durationSeconds ?? Math.max(60, block.minutes * 60);
  const mins = Math.max(1, Math.round(sec / 60));

  if (block.blockType === "warmup_timed" || block.kind === "warmup") {
    return `Warm-up — ${mins} min`;
  }
  if (block.blockType === "cooldown_timed" || block.kind === "cooldown") {
    return `Cool-down — ${mins} min`;
  }
  const n = index + 1;
  return `Block ${n} — ${mins} min AMRAP`;
}

/** One line: Name — concise detail (trimmed). */
export function formatExerciseLineConcise(ex: WorkoutCoachExercise, maxLen = 96): string {
  const detail = ex.detail.replace(/\s+/g, " ").trim();
  const tail = detail.length > maxLen ? `${detail.slice(0, Math.max(0, maxLen - 1))}…` : detail;
  return tail ? `${ex.name} — ${tail}` : ex.name;
}
