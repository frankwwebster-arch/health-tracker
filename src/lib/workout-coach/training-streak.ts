/**
 * Consecutive “training” days — strength, bootcamp, golf, or swim.
 * Peloton rides alone do not count (cardio-only days aren’t in this streak).
 */

import type { DayData } from "@/types";
import { hasStrengthPelotonToday, hasSwimToday, todayHasBootcampLike } from "./peloton";

export function isTrainingDayStreak(d: DayData): boolean {
  if (d.workoutCoach?.golfToday) return true;
  if (hasSwimToday(d)) return true;
  if (d.workoutCoach?.manualBootcampToday) return true;
  if (todayHasBootcampLike(d)) return true;
  if (hasStrengthPelotonToday(d) || d.workoutCoach?.postLog != null) return true;
  return false;
}

/**
 * `daysNewestFirst[0]` = today. Counts backward until a rest day (no training flags above).
 */
export function computeConsecutiveTrainingDays(daysNewestFirst: { data: DayData }[]): number {
  if (daysNewestFirst.length === 0) return 0;
  const today = daysNewestFirst[0].data;
  const older = daysNewestFirst.slice(1).map((x) => x.data);
  const sequence = isTrainingDayStreak(today) ? [today, ...older] : older;
  let streak = 0;
  for (const d of sequence) {
    if (isTrainingDayStreak(d)) streak++;
    else break;
  }
  return streak;
}
