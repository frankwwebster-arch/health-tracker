import type { WorkoutCoachBlock } from "@/types";

export function newWorkoutBlockId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Included in total workout length for every strength session. */
export const STRENGTH_WARMUP_MINUTES = 4;
export const STRENGTH_WARMUP_SECONDS = STRENGTH_WARMUP_MINUTES * 60;

export const COOLDOWN_DEFAULT_MINUTES = 4;
export const COOLDOWN_DEFAULT_SECONDS = COOLDOWN_DEFAULT_MINUTES * 60;

export function createDefaultWarmupBlock(): WorkoutCoachBlock {
  return {
    id: newWorkoutBlockId(),
    kind: "warmup",
    blockType: "warmup_timed",
    title: "Warm-up (3–4 min)",
    minutes: STRENGTH_WARMUP_MINUTES,
    durationSeconds: STRENGTH_WARMUP_SECONDS,
    exercises: [
      { name: "Bodyweight squats", detail: "10 reps" },
      { name: "Push-ups", detail: "10 reps" },
      { name: "Plank", detail: "20s" },
      { name: "Arm circles", detail: "10 each way" },
    ],
  };
}

/** Stable id per workout so normalization doesn’t churn block ids. */
export function createCooldownBlock(workoutId: string): WorkoutCoachBlock {
  return {
    id: `cooldown-${workoutId}`,
    kind: "cooldown",
    blockType: "cooldown_timed",
    title: "Cooldown (3–4 min)",
    minutes: COOLDOWN_DEFAULT_MINUTES,
    durationSeconds: COOLDOWN_DEFAULT_SECONDS,
    exercises: [
      { name: "Easy movement", detail: "walk or gentle flow" },
      { name: "Stretch", detail: "focus on trained areas" },
      { name: "Breathing", detail: "slow exhales" },
    ],
  };
}
