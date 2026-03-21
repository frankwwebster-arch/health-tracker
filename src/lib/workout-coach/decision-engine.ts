/**
 * Workout Decision Engine — one clear call: what should today look like?
 * Priority: golf → already trained (bootcamp/strength) → bootcamp weekly cap → swim influence
 * → consecutive fatigue → low-energy toggle → yesterday / weekly balance → default.
 */

import type { DayData } from "@/types";
import {
  hasPelotonWorkoutToday,
  hasStrengthPelotonToday,
  hasSwimToday,
  isPelotonRideSession,
  todayHasBootcampLike,
} from "./peloton";
import { computeConsecutiveTrainingDays } from "./training-streak";

export type WorkoutActivityType = "strength" | "bootcamp" | "ride" | "golf" | "swim" | "rest";

/** Suggested minimum Peloton **rides** (cycling cardio) per rolling 7 days toward weekly cardio balance. */
export const SUGGESTED_WEEKLY_CARDIO_RIDES = 2;

export interface DailyWorkoutFlags {
  bootcampDoneToday: boolean;
  strengthDoneToday: boolean;
  golfToday: boolean;
  /** Manual `swimToday` and/or logged swim session — not bootcamp, ride, or strength. */
  swimToday: boolean;
  bootcampsThisWeek: number;
  /** Peloton cycling rides in last 7 days (each ride counts toward suggested cardio target). */
  pelotonRidesThisWeek: number;
  /** True when ride count meets or exceeds suggested weekly cardio from rides alone. */
  weeklyCardioRidesTargetMet: boolean;
  /** Strength / bootcamp / golf / swim streak (not rides-only days). */
  consecutiveTrainingDays: number;
  trainedYesterday: boolean;
  lastWorkoutTypeYesterday: WorkoutActivityType;
  sleepQuality?: "good" | "ok" | "poor";
  stepLevel?: "low" | "medium" | "high";
}

export interface DecisionEngineInput {
  today: DayData;
  yesterday: DayData | null;
  /** Last 7 calendar days (including today), each with data */
  last7Days: { dateKey: string; data: DayData }[];
  /** Newest first, include today — used for consecutive training streak */
  last30Days: { dateKey: string; data: DayData }[];
  /** Coach UI: Low energy toggle forces light session */
  preferLowEnergyToggle: boolean;
}

export type DecisionResult =
  | {
      outcome: "no_workout";
      headline: string;
      subline?: string;
    }
  | {
      outcome: "bootcamp_suggestion";
      headline: string;
      subline?: string;
      durationMinutes: 30 | 45;
    }
  | {
      outcome: "strength";
      headline: string;
      subline?: string;
      preferShort: boolean;
      preferLowEnergy: boolean;
    }
  | {
      outcome: "consecutive_training_warning";
      streak: number;
      headline: string;
      subline?: string;
      preferShort: true;
      preferLowEnergy: true;
      recoveryMode: true;
    };

/** User completed a Peloton strength-style class or logged a completed coach strength session. */
export function strengthDoneToday(d: DayData): boolean {
  if (hasStrengthPelotonToday(d)) return true;
  if (d.workoutCoach?.postLog != null) return true;
  return false;
}

/** Bootcamp from Peloton or manual confirmation. */
export function bootcampDoneToday(d: DayData): boolean {
  if (todayHasBootcampLike(d)) return true;
  if (d.workoutCoach?.manualBootcampToday) return true;
  return false;
}

export function trainedOnDay(d: DayData): boolean {
  if (hasPelotonWorkoutToday(d)) return true;
  if (d.workoutMinutes != null && d.workoutMinutes > 0) return true;
  if (d.walkDone) return true;
  if (d.workoutCoach?.postLog != null) return true;
  if (d.workoutCoach?.golfToday) return true;
  if (hasSwimToday(d)) return true;
  return false;
}

/** Classify a day for rotation / “what was yesterday”. Order: golf → strength → bootcamp → swim → ride. */
export function classifyDay(d: DayData): WorkoutActivityType {
  if (d.workoutCoach?.golfToday) return "golf";
  if (hasStrengthPelotonToday(d) || d.workoutCoach?.postLog != null) return "strength";
  if (todayHasBootcampLike(d) || d.workoutCoach?.manualBootcampToday) return "bootcamp";
  if (hasSwimToday(d)) return "swim";
  if (hasPelotonWorkoutToday(d)) return "ride";
  return "rest";
}

function countBootcampsLast7Days(rows: { data: DayData }[]): number {
  let n = 0;
  for (const { data } of rows) {
    const hasBc = (data.workoutSessions ?? []).some((s) => {
      const t = (s.title ?? "").toLowerCase();
      const disc = (s.discipline ?? "").toLowerCase();
      return (
        t.includes("bootcamp") ||
        disc.includes("bootcamp") ||
        (disc.includes("tread") && t.includes("bootcamp"))
      );
    });
    if (hasBc || data.workoutCoach?.manualBootcampToday) n += 1;
  }
  return n;
}

/** Count individual Peloton ride sessions (cycling) for weekly cardio balance. */
function countPelotonRideSessionsLast7Days(rows: { data: DayData }[]): number {
  let n = 0;
  for (const { data } of rows) {
    for (const s of data.workoutSessions ?? []) {
      if (isPelotonRideSession(s)) n += 1;
    }
  }
  return n;
}

/** Optional: map step count to walking load when user hasn’t set step level. */
export function deriveStepLevelFromSteps(steps: number | null): "low" | "medium" | "high" | undefined {
  if (steps == null) return undefined;
  if (steps < 5000) return "low";
  if (steps < 12000) return "medium";
  return "high";
}

export function computeFlags(input: DecisionEngineInput): DailyWorkoutFlags {
  const { today, yesterday, last7Days, last30Days } = input;

  const sleepQuality = today.workoutCoach?.sleepQuality;
  const stepLevel =
    today.workoutCoach?.stepLevel ?? deriveStepLevelFromSteps(today.stepsCount ?? null);

  const pelotonRidesThisWeek = countPelotonRideSessionsLast7Days(last7Days);
  const consecutiveTrainingDays = computeConsecutiveTrainingDays(last30Days);

  return {
    bootcampDoneToday: bootcampDoneToday(today),
    strengthDoneToday: strengthDoneToday(today),
    golfToday: today.workoutCoach?.golfToday === true,
    swimToday: hasSwimToday(today),
    bootcampsThisWeek: countBootcampsLast7Days(last7Days),
    pelotonRidesThisWeek,
    weeklyCardioRidesTargetMet: pelotonRidesThisWeek >= SUGGESTED_WEEKLY_CARDIO_RIDES,
    consecutiveTrainingDays,
    trainedYesterday: yesterday ? trainedOnDay(yesterday) : false,
    lastWorkoutTypeYesterday: yesterday ? classifyDay(yesterday) : "rest",
    sleepQuality,
    stepLevel,
  };
}

/**
 * Main decision. Call after flags; uses same input for convenience.
 */
export function decideWorkout(input: DecisionEngineInput): DecisionResult {
  const flags = computeFlags(input);
  const { preferLowEnergyToggle } = input;

  // —— Hard rules ——————————————————————————————————————————————

  if (flags.golfToday) {
    return {
      outcome: "no_workout",
      headline: "Golf day ✅",
    };
  }

  if (flags.bootcampDoneToday) {
    return {
      outcome: "no_workout",
      headline: "Done for today ✅",
    };
  }

  if (flags.strengthDoneToday) {
    return {
      outcome: "no_workout",
      headline: "Done for today ✅",
    };
  }

  // —— Bootcamp weekly cap (swim does not count toward this cap) ————————————————

  if (flags.bootcampsThisWeek >= 2) {
    return {
      outcome: "strength",
      headline: "Suggested: Strength",
      preferShort: false,
      preferLowEnergy: false,
    };
  }

  // —— Swim influence ————————————————————————————————————————————————————————

  if (flags.swimToday) {
    if (flags.sleepQuality === "poor") {
      return {
        outcome: "strength",
        headline: "Suggested: Light strength",
        preferShort: true,
        preferLowEnergy: true,
      };
    }
    return {
      outcome: "strength",
      headline: "Suggested: Light strength",
      preferShort: true,
      preferLowEnergy: true,
    };
  }

  // —— Consecutive training fatigue —————————————————————————————————————————————

  if (flags.consecutiveTrainingDays >= 4) {
    return {
      outcome: "consecutive_training_warning",
      streak: flags.consecutiveTrainingDays,
      headline: "Rest day recommended ⚠️",
      preferShort: true,
      preferLowEnergy: true,
      recoveryMode: true,
    };
  }

  // Low energy override
  if (preferLowEnergyToggle) {
    return {
      outcome: "strength",
      headline: "Suggested: Light strength",
      preferShort: true,
      preferLowEnergy: true,
    };
  }

  let scoreBootcamp = 0;
  let scoreStrength = 1;
  let scoreLight = 0;

  // —— Step 1 — recovery ————————————————————————————————————————

  if (flags.sleepQuality === "poor") {
    scoreLight += 3;
    scoreBootcamp -= 5;
  }

  if (flags.stepLevel === "high") {
    scoreStrength += 2;
    scoreBootcamp -= 1;
  }

  // —— Step 2 — yesterday ———————————————————————————————————————

  switch (flags.lastWorkoutTypeYesterday) {
    case "strength":
      scoreBootcamp += 2;
      break;
    case "bootcamp":
      scoreStrength += 2;
      break;
    case "golf":
      scoreStrength += 2;
      scoreLight += 1;
      break;
    case "swim":
      scoreStrength += 1;
      scoreLight += 1;
      break;
    case "ride":
      scoreStrength += 1;
      break;
    case "rest":
      scoreStrength += 1;
      break;
    default:
      break;
  }

  if (flags.trainedYesterday && flags.sleepQuality === "poor") {
    scoreLight += 2;
  }

  // —— Step 3 — weekly bootcamp balance (≥2 bootcamps already handled above) ——

  if (flags.bootcampsThisWeek === 0) scoreBootcamp += 2;
  if (flags.bootcampsThisWeek === 1) scoreBootcamp += 0;

  // —— Step 3b — weekly Peloton cardio (rides) —————————————————————
  // ~2 rides/week suggested for cardio balance; rides don’t cap bootcamps, but reduce
  // “push another bootcamp for cardio” when the ride quota is already met.
  if (flags.weeklyCardioRidesTargetMet) {
    scoreBootcamp -= 2;
  } else if (flags.pelotonRidesThisWeek === 0) {
    scoreBootcamp += 1;
  }

  // —— Resolve: bootcamp suggestion vs strength —————————————————

  if (scoreBootcamp >= 2 && scoreBootcamp > scoreStrength) {
    return {
      outcome: "bootcamp_suggestion",
      headline: "Suggested: Bootcamp",
      durationMinutes: 45,
    };
  }

  if (flags.sleepQuality === "poor" && (flags.trainedYesterday || scoreLight >= 3)) {
    return {
      outcome: "strength",
      headline: "Suggested: Light strength",
      preferShort: true,
      preferLowEnergy: true,
    };
  }

  if (scoreLight >= 3) {
    return {
      outcome: "strength",
      headline: "Suggested: Light strength",
      preferShort: true,
      preferLowEnergy: true,
    };
  }

  return {
    outcome: "strength",
    headline: "Suggested: Strength",
    preferShort: false,
    preferLowEnergy: false,
  };
}
