import { NextResponse } from "next/server";
import { PELOTON_BASE_URL, createPelotonSession } from "@/lib/peloton/api";
import {
  type EffectivePelotonCredentials,
  getEffectivePelotonCredentialsForCurrentUser,
} from "@/lib/peloton/credentials";

const MAX_WORKOUT_PAGES = 6;
const PAGE_SIZE = 50;
const SESSION_TTL_MS = 15 * 60 * 1000;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface PelotonWorkout {
  id?: string;
  start_time?: number;
  end_time?: number;
  total_workout_duration?: number;
  status?: string;
  fitness_discipline?: string;
  title?: string;
  name?: string;
  ride?: {
    title?: string;
    name?: string;
    duration?: number;
  };
}

interface PelotonWorkoutsResponse {
  data?: PelotonWorkout[];
}

interface PelotonWorkoutSummary {
  id: string;
  label: string;
  durationMinutes: number;
  discipline: string | null;
  startTime: number | null;
}

interface PelotonSession {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

const cachedSessions = new Map<string, PelotonSession>();

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

function toTitleCase(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getDiscipline(workout: PelotonWorkout): string | null {
  const raw = workout.fitness_discipline;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return toTitleCase(raw);
}

function getWorkoutLabel(workout: PelotonWorkout): string {
  const rawCandidates = [
    workout.ride?.title,
    workout.ride?.name,
    workout.title,
    workout.name,
  ];
  for (const candidate of rawCandidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }

  return getDiscipline(workout) ?? "Workout";
}

function toWorkoutSummary(workout: PelotonWorkout, durationSeconds: number, index: number): PelotonWorkoutSummary {
  const startTime = parseFiniteNumber(workout.start_time);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const fallbackId = `peloton-${startTime ?? "unknown"}-${durationMinutes}-${index}`;

  return {
    id: typeof workout.id === "string" && workout.id.trim() !== "" ? workout.id : fallbackId,
    label: getWorkoutLabel(workout),
    durationMinutes,
    discipline: getDiscipline(workout),
    startTime,
  };
}

function getCredentialCacheKey(credentials: EffectivePelotonCredentials): string {
  return `${credentials.source}:${credentials.username.trim().toLowerCase()}`;
}

async function loginToPeloton(
  credentials: EffectivePelotonCredentials,
  cacheKey: string
): Promise<PelotonSession> {
  const baseSession = await createPelotonSession(credentials);
  const session: PelotonSession = {
    userId: baseSession.userId,
    sessionId: baseSession.sessionId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  cachedSessions.set(cacheKey, session);
  return session;
}

async function getPelotonSession(
  credentials: EffectivePelotonCredentials
): Promise<{ session: PelotonSession; cacheKey: string }> {
  const cacheKey = getCredentialCacheKey(credentials);
  const cachedSession = cachedSessions.get(cacheKey);
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return { session: cachedSession, cacheKey };
  }

  const session = await loginToPeloton(credentials, cacheKey);
  return { session, cacheKey };
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

async function fetchWorkoutsPage(
  page: number,
  credentials: EffectivePelotonCredentials
): Promise<PelotonWorkout[]> {
  const firstSessionState = await getPelotonSession(credentials);
  const firstAttempt = await requestWorkoutsPage(firstSessionState.session, page);

  if (firstAttempt.status === 401 || firstAttempt.status === 403) {
    cachedSessions.delete(firstSessionState.cacheKey);
    const refreshedSessionState = await getPelotonSession(credentials);
    const retryAttempt = await requestWorkoutsPage(
      refreshedSessionState.session,
      page
    );
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

async function getWorkoutDataForDate(
  dateKey: string,
  timeZone: string,
  credentials: EffectivePelotonCredentials
): Promise<{ workoutMinutes: number | null; workouts: PelotonWorkoutSummary[] }> {
  let totalSeconds = 0;
  const matchedWorkouts: PelotonWorkoutSummary[] = [];

  for (let page = 0; page < MAX_WORKOUT_PAGES; page++) {
    const workouts = await fetchWorkoutsPage(page, credentials);
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

      const durationSeconds = getWorkoutDurationSeconds(workout);
      if (durationSeconds <= 0) continue;

      totalSeconds += durationSeconds;
      matchedWorkouts.push(toWorkoutSummary(workout, durationSeconds, matchedWorkouts.length));
    }

    // Workouts are returned newest first; once a page is older than the target day
    // there is no need to keep paging.
    if (oldestWorkoutDateKey && oldestWorkoutDateKey < dateKey) {
      break;
    }
  }

  matchedWorkouts.sort((a, b) => {
    if (a.startTime == null && b.startTime == null) return 0;
    if (a.startTime == null) return 1;
    if (b.startTime == null) return -1;
    return a.startTime - b.startTime;
  });

  const workoutMinutes = Math.round(totalSeconds / 60);
  return {
    workoutMinutes: workoutMinutes > 0 ? workoutMinutes : null,
    workouts: matchedWorkouts,
  };
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

  const { credentials } = await getEffectivePelotonCredentialsForCurrentUser();
  if (!credentials) {
    return NextResponse.json({
      workoutMinutes: null,
      workouts: [],
      configured: false,
    });
  }

  try {
    const workoutData = await getWorkoutDataForDate(
      dateKey,
      timeZone,
      credentials
    );
    return NextResponse.json({
      workoutMinutes: workoutData.workoutMinutes,
      workouts: workoutData.workouts,
      configured: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        workoutMinutes: null,
        workouts: [],
        configured: true,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch workouts from Peloton",
      },
      { status: 502 }
    );
  }
}
