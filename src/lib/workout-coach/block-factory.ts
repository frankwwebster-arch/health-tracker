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
 * Warm-up: movement + mobility + activation, single explicit duration (4–6 min).
 * Titles and durationSeconds must stay in sync for timers and rest flow.
 */
export function createDefaultWarmupBlock(
  minutes: 4 | 5 | 6 = MIN_WARMUP_COOLDOWN_MINUTES,
  options?: { includeOptionalPelotonBurst?: boolean }
): WorkoutCoachBlock {
  const m = clampWarmupCooldownMinutes(minutes);
  const sec = m * 60;
  const movementPool: WorkoutCoachBlock["exercises"] = [
    { name: "Bodyweight squats", detail: "10 reps" },
    { name: "Shoulder circles", detail: "10 each way" },
    { name: "Hip hinges", detail: "10 reps" },
    { name: "Thoracic rotation", detail: "5 reps each side" },
    { name: "Dead bug", detail: "6 reps each side" },
    { name: "Cat-cow", detail: "6 reps" },
    { name: "Down dog to up dog", detail: "6 reps" },
    { name: "World's greatest stretch", detail: "4 reps each side" },
    { name: "Glute bridge", detail: "10 reps" },
    { name: "Push-ups", detail: "8 reps — knees if preferred" },
  ];
  const shuffled = [...movementPool].sort(() => Math.random() - 0.5);
  const includePeloton = options?.includeOptionalPelotonBurst === true;
  // Keep warm-up focused and compact while varying choices each generation.
  const warmupExercises: WorkoutCoachBlock["exercises"] = includePeloton
    ? [
        { name: "Light spin", detail: "2 min" },
        ...shuffled.slice(0, 3),
      ]
    : shuffled.slice(0, 5 + (Math.random() < 0.5 ? 0 : 1));
  return {
    id: newWorkoutBlockId(),
    kind: "warmup",
    blockType: "warmup_timed",
    title: `Warm-up — ${m} min`,
    minutes: m,
    durationSeconds: sec,
    exercises: warmupExercises,
  };
}

/** Stable id per workout so normalization doesn’t churn block ids. */
export function createCooldownBlock(
  workoutId: string,
  minutes: 4 | 5 | 6 = MIN_WARMUP_COOLDOWN_MINUTES
): WorkoutCoachBlock {
  const m = clampWarmupCooldownMinutes(minutes);
  const sec = m * 60;
  const cooldownPool: WorkoutCoachBlock["exercises"] = [
    { name: "Hamstring stretch", detail: "30s each leg" },
    { name: "Hip flexor stretch", detail: "30s each side" },
    { name: "Chest opener", detail: "30s" },
    { name: "Spinal rotation", detail: "30s each side" },
    { name: "Child's pose", detail: "45s — slow breaths" },
    { name: "Calf stretch", detail: "30s each side" },
    { name: "90/90 hip stretch", detail: "30s each side" },
  ];
  const cooldownExercises = [...cooldownPool]
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
  return {
    id: `cooldown-${workoutId}`,
    kind: "cooldown",
    blockType: "cooldown_timed",
    title: `Cool-down — ${m} min`,
    minutes: m,
    durationSeconds: sec,
    exercises: cooldownExercises,
  };
}
