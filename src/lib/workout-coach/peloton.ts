import type { DayData, PelotonWorkoutSession } from "@/types";

/** True if any Peloton session today (synced workouts). */
export function hasPelotonWorkoutToday(data: DayData): boolean {
  return (data.workoutSessions ?? []).length > 0;
}

/** Heuristic: bootcamp / full-body cardio-strength — skip extra strength. */
export function isBootcampLikeSession(s: PelotonWorkoutSession): boolean {
  const disc = (s.discipline ?? "").toLowerCase();
  const title = (s.title ?? "").toLowerCase();
  return (
    title.includes("bootcamp") ||
    disc.includes("bootcamp") ||
    (disc.includes("tread") && title.includes("bootcamp"))
  );
}

export function todayHasBootcampLike(data: DayData): boolean {
  return (data.workoutSessions ?? []).some(isBootcampLikeSession);
}

/** Last session label for UI (strength / cycling / etc.). */
export function lastWorkoutTypeLabel(data: DayData): string | null {
  const sessions = data.workoutSessions ?? [];
  if (sessions.length === 0) return null;
  const last = sessions[sessions.length - 1];
  if (last.discipline) return last.discipline;
  if (last.title) return last.title.slice(0, 40);
  return "Workout";
}

/** Rough check: user logged strength-style Peloton (strength / upper / lower). */
export function hasStrengthPelotonToday(data: DayData): boolean {
  return (data.workoutSessions ?? []).some((s) => {
    const d = (s.discipline ?? "").toLowerCase();
    return d.includes("strength") || d.includes("toning") || d.includes("upper") || d.includes("lower");
  });
}
