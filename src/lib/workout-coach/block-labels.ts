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

/** Preset seconds allowed in the quick-timer dock (must match QuickTimers PRESETS). */
export const QUICK_TIMER_PRESET_SECONDS = [15, 20, 30, 45, 60] as const;

/**
 * Seconds from block copy that map to quick timers (e.g. 20s plank → [20]).
 * Only values in QUICK_TIMER_PRESET_SECONDS are returned.
 */
export function extractQuickTimerPresetsFromBlock(block: WorkoutCoachBlock): number[] {
  const text = block.exercises.map((e) => `${e.name} ${e.detail}`).join(" ");
  const found = new Set<number>();
  const allowed = new Set<number>(QUICK_TIMER_PRESET_SECONDS);

  const rangeRe = /(\d{1,2})\s*[–-]\s*(\d{1,2})\s*s\b/gi;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(text)) !== null) {
    const a = parseInt(m[1]!, 10);
    const b = parseInt(m[2]!, 10);
    if (allowed.has(a)) found.add(a);
    if (allowed.has(b)) found.add(b);
  }

  const singleRe = /\b(\d{1,2})\s*s\b/gi;
  while ((m = singleRe.exec(text)) !== null) {
    const n = parseInt(m[1]!, 10);
    if (allowed.has(n)) found.add(n);
  }

  return Array.from(found).sort((a, b) => a - b);
}

/** AMRAP / KB ladder — main workout timer in the block; no quick preset strip. */
export function isAmrapOrKbLadderBlock(block: WorkoutCoachBlock): boolean {
  return block.kind === "amrap" || block.kind === "kb_ladder";
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
