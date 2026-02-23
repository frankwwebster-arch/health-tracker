import { NextResponse } from "next/server";

const PELOTON_BASE_URL = "https://api.onepeloton.com";
const MAX_WORKOUT_PAGES = 6;
const PAGE_SIZE = 50;
const SESSION_TTL_MS = 15 * 60 * 1000;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface PelotonLoginResponse {
  user_id?: string;
  session_id?: string;
}

interface PelotonWorkout {
  start_time?: number;
  end_time?: number;
  total_workout_duration?: number;
  status?: string;
  ride?: {
    duration?: number;
  };
}

interface PelotonWorkoutsResponse {
  data?: PelotonWorkout[];
}

interface PelotonSession {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

let cachedSession: PelotonSession | null = null;

export const dynamic = "force-dynamic";

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getDateKeyInTimeZone(unixSeconds: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(unixSeconds * 1000));

  let year = "";
  let month = "";
  let day = "";

  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }

  return `${year}-${month}-${day}`;
}

function isCompletedWorkout(status: unknown): boolean {
  if (typeof status !== "string") return true;
  const normalized = status.toLowerCase();
  return normalized === "complete" || normalized === "completed";
}

function getWorkoutDurationSeconds(workout: PelotonWorkout): number {
  const start = parseFiniteNumber(workout.start_time);
  const end = parseFiniteNumber(workout.end_time);
  if (start != null && end != null && end > start) {
    return end - start;
  }

  const totalDuration = parseFiniteNumber(workout.total_workout_duration);
  if (totalDuration != null && totalDuration > 0) return totalDuration;

  const rideDuration = parseFiniteNumber(workout.ride?.duration);
  if (rideDuration != null && rideDuration > 0) return rideDuration;

  return 0;
}

async function loginToPeloton(): Promise<PelotonSession> {
  const username = process.env.PELOTON_USERNAME;
  const password = process.env.PELOTON_PASSWORD;
  if (!username || !password) {
    throw new Error("Peloton credentials are not configured");
  }

  const response = await fetch(`${PELOTON_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username_or_email: username,
      password,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Peloton login failed (${response.status})`);
  }

  const payload = (await response.json()) as PelotonLoginResponse;
  if (!payload.session_id || !payload.user_id) {
    throw new Error("Peloton login response missing user/session data");
  }

  const session: PelotonSession = {
    userId: payload.user_id,
    sessionId: payload.session_id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  cachedSession = session;
  return session;
}

async function getPelotonSession(): Promise<PelotonSession> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  return loginToPeloton();
}

async function requestWorkoutsPage(session: PelotonSession, page: number): Promise<Response> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    joins: "ride",
  });

  return fetch(`${PELOTON_BASE_URL}/api/user/${session.userId}/workouts?${query.toString()}`, {
    headers: {
      Cookie: `peloton_session_id=${session.sessionId}`,
    },
    cache: "no-store",
  });
}

async function parseWorkouts(response: Response): Promise<PelotonWorkout[]> {
  const payload = (await response.json()) as PelotonWorkoutsResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchWorkoutsPage(page: number): Promise<PelotonWorkout[]> {
  const session = await getPelotonSession();
  const firstAttempt = await requestWorkoutsPage(session, page);

  if (firstAttempt.status === 401 || firstAttempt.status === 403) {
    cachedSession = null;
    const refreshedSession = await getPelotonSession();
    const retryAttempt = await requestWorkoutsPage(refreshedSession, page);
    if (!retryAttempt.ok) {
      throw new Error(`Peloton workouts request failed (${retryAttempt.status})`);
    }
    return parseWorkouts(retryAttempt);
  }

  if (!firstAttempt.ok) {
    throw new Error(`Peloton workouts request failed (${firstAttempt.status})`);
  }

  return parseWorkouts(firstAttempt);
}

async function getWorkoutMinutesForDate(dateKey: string, timeZone: string): Promise<number> {
  let totalSeconds = 0;

  for (let page = 0; page < MAX_WORKOUT_PAGES; page++) {
    const workouts = await fetchWorkoutsPage(page);
    if (workouts.length === 0) break;

    let oldestWorkoutDateKey: string | null = null;
    for (const workout of workouts) {
      const startTime = parseFiniteNumber(workout.start_time);
      if (startTime == null) continue;

      const workoutDateKey = getDateKeyInTimeZone(startTime, timeZone);
      if (!oldestWorkoutDateKey || workoutDateKey < oldestWorkoutDateKey) {
        oldestWorkoutDateKey = workoutDateKey;
      }

      if (workoutDateKey !== dateKey) continue;
      if (!isCompletedWorkout(workout.status)) continue;

      totalSeconds += getWorkoutDurationSeconds(workout);
    }

    // Workouts are returned newest first; once a page is older than the target day
    // there is no need to keep paging.
    if (oldestWorkoutDateKey && oldestWorkoutDateKey < dateKey) {
      break;
    }
  }

  return Math.round(totalSeconds / 60);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateKey = searchParams.get("date");
  if (!dateKey || !DATE_KEY_REGEX.test(dateKey)) {
    return NextResponse.json(
      { error: "Expected `date` query param in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const rawTimeZone = searchParams.get("timeZone") ?? "UTC";
  const timeZone = isValidTimeZone(rawTimeZone) ? rawTimeZone : "UTC";

  if (!process.env.PELOTON_USERNAME || !process.env.PELOTON_PASSWORD) {
    return NextResponse.json({ workoutMinutes: null, configured: false });
  }

  try {
    const workoutMinutes = await getWorkoutMinutesForDate(dateKey, timeZone);
    return NextResponse.json({
      workoutMinutes: workoutMinutes > 0 ? workoutMinutes : null,
      configured: true,
    });
  } catch {
    return NextResponse.json(
      {
        workoutMinutes: null,
        configured: true,
        error: "Failed to fetch workouts from Peloton",
      },
      { status: 502 }
    );
  }
}
