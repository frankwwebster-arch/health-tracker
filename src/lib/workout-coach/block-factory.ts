import type { WorkoutCoachBlock } from "@/types";

export function newWorkoutBlockId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Minimum timed length for warm-up and cool-down (minutes). Never below this. */
export const MIN_WARMUP_COOLDOWN_MINUTES = 4;
/** Coach may use 4, 5, or 6 min — never below {@link MIN_WARMUP_COOLDOWN_MINUTES}. */
export const MAX_COACH_WARMUP_COOLDOWN_MINUTES = 6;

/** @deprecated use {@link MIN_WARMUP_COOLDOWN_MINUTES} */
export const STRENGTH_WARMUP_MINUTES = MIN_WARMUP_COOLDOWN_MINUTES;
/** @deprecated derive from clamped minutes × 60 */
export const STRENGTH_WARMUP_SECONDS = MIN_WARMUP_COOLDOWN_MINUTES * 60;

export const COOLDOWN_DEFAULT_MINUTES = MIN_WARMUP_COOLDOWN_MINUTES;

export function clampWarmupCooldownMinutes(raw: number): 4 | 5 | 6 {
  const n = Math.round(raw);
  return Math.min(
    MAX_COACH_WARMUP_COOLDOWN_MINUTES,
    Math.max(MIN_WARMUP_COOLDOWN_MINUTES, n)
  ) as 4 | 5 | 6;
}

/**
 * Warm-up: 3–5 simple activation movements, single explicit duration (4–6 min).
 * Titles and durationSeconds must stay in sync for timers and rest flow.
 */
export function createDefaultWarmupBlock(minutes: 4 | 5 | 6 = MIN_WARMUP_COOLDOWN_MINUTES): WorkoutCoachBlock {
  const m = clampWarmupCooldownMinutes(minutes);
  const sec = m * 60;
  return {
    id: newWorkoutBlockId(),
    kind: "warmup",
    blockType: "warmup_timed",
    title: `Warm-up — ${m} min`,
    minutes: m,
    durationSeconds: sec,
    exercises: [
      { name: "Bodyweight squats", detail: "10 reps" },
      { name: "Push-ups", detail: "10 reps" },
      { name: "Plank", detail: "20s hold" },
      { name: "Arm circles", detail: "shoulder mobility — 10 each way" },
      { name: "Hip hinges", detail: "10 reps" },
    ],
  };
}

/** Stable id per workout so normalization doesn’t churn block ids. */
export function createCooldownBlock(
  workoutId: string,
  minutes: 4 | 5 | 6 = MIN_WARMUP_COOLDOWN_MINUTES
): WorkoutCoachBlock {
  const m = clampWarmupCooldownMinutes(minutes);
  const sec = m * 60;
  return {
    id: `cooldown-${workoutId}`,
    kind: "cooldown",
    blockType: "cooldown_timed",
    title: `Cool-down — ${m} min`,
    minutes: m,
    durationSeconds: sec,
    exercises: [
      { name: "Hamstring stretch", detail: "30s each leg" },
      { name: "Hip flexor stretch", detail: "30s each side" },
      { name: "Chest opener", detail: "30s" },
      { name: "Spinal rotation", detail: "30s each side" },
      { name: "Child's pose", detail: "45s — slow breaths" },
    ],
  };
}
