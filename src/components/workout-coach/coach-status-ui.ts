import type { DailyWorkoutFlags, DecisionResult } from "@/lib/workout-coach/decision-engine";

export type CoachStatusTone = "green" | "amber" | "blue";

/** Traffic-light status for the top card. */
export function getCoachStatusTone(
  decision: DecisionResult,
  preferLowEnergy: boolean
): CoachStatusTone {
  if (decision.outcome === "no_workout") return "green";
  if (decision.outcome === "consecutive_training_warning") return "amber";
  if (decision.headline.includes("Rest day")) return "amber";
  if (preferLowEnergy) return "amber";
  if (decision.outcome === "strength") {
    const h = decision.headline.toLowerCase();
    if (
      decision.preferLowEnergy ||
      h.includes("light") ||
      h.includes("optional") ||
      h.includes("recovery")
    ) {
      return "amber";
    }
  }
  return "blue";
}

export const STATUS_CARD_STYLES: Record<CoachStatusTone, string> = {
  green:
    "bg-emerald-50 border-emerald-200/90 text-emerald-950 shadow-sm ring-1 ring-emerald-100",
  amber:
    "bg-amber-50 border-amber-200/90 text-amber-950 shadow-sm ring-1 ring-amber-100",
  blue: "bg-sky-50 border-sky-200/90 text-sky-950 shadow-sm ring-1 ring-sky-100",
};

/** Mirrors headline — no duplicate “suggested” line (single source: decision.headline). */
export function getTodayDecisionLabel(decision: DecisionResult): string {
  return decision.headline;
}

/** Removed explanatory hints from UI — keep API for callers that expect optional string. */
export function getTodayDecisionHint(
  _decision: DecisionResult,
  _flags: DailyWorkoutFlags
): string | undefined {
  return undefined;
}

export function statusIconEmoji(tone: CoachStatusTone): string {
  switch (tone) {
    case "green":
      return "✓";
    case "amber":
      return "⚠";
    case "blue":
      return "→";
    default:
      return "";
  }
}
