import type { WorkoutCoachBlockKind } from "@/types";

/**
 * Short "stretch" prompts — extra work after a block (tap button to rotate).
 * Add strings here to grow the variety per block type.
 */

const AMRAP: string[] = [
  "One more full round of the circuit.",
  "+10 KB swings — crisp hinges.",
  "+5 goblet squats — wedge, depth you own.",
  "+8 one-arm rows per side — slow negative.",
  "Add 2 min to the AMRAP clock — same moves.",
  "One heavier set: pick one exercise, +2 reps.",
  "Farmer carry: 40 steps with {kb} (or best you have).",
];

const PUSH: string[] = [
  "One more set of bench — same weight, +2 reps if clean.",
  "Top set: add 1 rep to shoulder press.",
  "Slow eccentrics: 4 sec down on last set.",
  "Extra set of floor press — stop before grind.",
  "10 push-ups between your next two sets.",
  "One rest-pause: 4 reps, 10s, 2 reps.",
];

const CORE: string[] = [
  "One more full round of the core circuit.",
  "+10 dead bug pullovers — ribs down.",
  "+6 leg raises — no swing.",
  "Extra suitcase carry: +20 steps each side.",
  "Plank: 30s after the circuit.",
  "Side plank: +15s each side.",
];

const LADDER: string[] = [
  "Repeat the top rung (20 swings) once.",
  "+5 push-ups after the last ladder.",
  "Walk one extra minute before cool-down.",
  "Add a light set: 10 swings + 5 push-ups.",
];

const GENERIC: string[] = [
  "Five deep breaths, then one quality set of anything above.",
  "+2 min easy bike or walk — flush legs.",
];

const BY_KIND: Record<WorkoutCoachBlockKind, readonly string[]> = {
  warmup: GENERIC,
  amrap: AMRAP,
  structured_push: PUSH,
  core_circuit: CORE,
  kb_ladder: LADDER,
  cooldown: GENERIC,
};

function fillKb(text: string, kbHint: string): string {
  return text.replace(/\{kb\}/g, kbHint);
}

/**
 * Next suggestion for this block kind. Pass previous text to avoid immediate repeat when possible.
 */
/** Random line for the "Extra Push" button after a block. */
export function nextExtraPushSuggestion(
  kind: WorkoutCoachBlockKind,
  opts?: { avoid?: string; kbHint?: string }
): string {
  const pool = [...BY_KIND[kind], ...GENERIC];
  const filtered = opts?.avoid
    ? pool.filter((s) => s !== opts.avoid)
    : pool;
  const pickFrom = filtered.length > 0 ? filtered : pool;
  const line = pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? "One more easy round.";
  const kb = opts?.kbHint ?? "your KB";
  return fillKb(line, kb);
}
