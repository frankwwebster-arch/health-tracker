import type { PelotonWorkoutSession } from "@/types";

const PELOTON_BASE = "https://api.onepeloton.com";

interface PelotonAuthResponse {
  session_id?: string;
  user_id?: string;
}

interface PelotonRide {
  duration?: number;
  title?: string;
  fitness_discipline?: string;
  instructor?: { name?: string };
}

interface PelotonWorkoutItem {
  id: string;
  created_at?: number;
  end_time?: number;
  status?: string;
  ride?: PelotonRide;
  duration?: number;
  fitness_discipline?: string;
  [k: string]: unknown;
}

interface PelotonWorkoutsResponse {
  data?: PelotonWorkoutItem[];
  page_count?: number;
  total?: number;
}

export type AuthResult =
  | { ok: true; sessionId: string; userId: string }
  | { ok: false; error: string };

export async function authenticate(
  username: string,
  password: string
): Promise<AuthResult> {
  const res = await fetch(`${PELOTON_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Peloton-Platform": "web",
      "User-Agent": "Peloton/1.0 (Web)",
    },
    body: JSON.stringify({
      username_or_email: username,
      password,
    }),
  });

  const data = (await res.json()) as PelotonAuthResponse & { message?: string; error?: string };

  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  let sessionId: string | null = res.headers.get("peloton-session-id") ?? res.headers.get("Peloton-Session-Id");
  if (!sessionId) {
    const setCookie = res.headers.get("set-cookie");
    const match = setCookie?.match(/peloton_session_id=([^;]+)/);
    sessionId = match?.[1] ?? null;
  }
  sessionId = sessionId ?? data.session_id ?? null;
  const userId = data.user_id;

  if (!sessionId || !userId) {
    return { ok: false, error: "Peloton did not return a session" };
  }
  return { ok: true, sessionId, userId: String(userId) };
}

/** Check if a UTC timestamp falls on dateKey in the given timezone */
function isOnDate(utcSeconds: number, dateKey: string, timeZone: string): boolean {
  const d = new Date(utcSeconds * 1000);
  const localDateStr = d.toLocaleDateString("en-CA", { timeZone }); // YYYY-MM-DD
  return localDateStr === dateKey;
}

export async function fetchWorkoutsForDate(
  sessionId: string,
  userId: string,
  dateKey: string,
  timeZone: string
): Promise<PelotonWorkoutSession[]> {
  const sessions: PelotonWorkoutSession[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${PELOTON_BASE}/api/user/${userId}/workouts?limit=20&page=${page}&joins=ride,ride.instructor`;
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Peloton-Platform": "web",
        "User-Agent": "Peloton/1.0 (Web)",
        Cookie: `peloton_session_id=${sessionId}`,
        "peloton-session-id": sessionId,
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Peloton session expired. Try Sync again, or re-save credentials in Settings → Peloton.");
    }

    if (!res.ok) {
      throw new Error(`Peloton API error: ${res.status}`);
    }

    const body = (await res.json()) as PelotonWorkoutsResponse;
    const workouts = body.data ?? [];
    const pageCount = body.page_count ?? 1;

    for (const w of workouts) {
      const endTime = w.end_time ?? w.created_at;
      if (!endTime) continue;
      if (!isOnDate(endTime, dateKey, timeZone)) {
        const workoutDateStr = new Date(endTime * 1000).toLocaleDateString("en-CA", { timeZone });
        if (workoutDateStr < dateKey) {
          hasMore = false;
          break;
        }
        continue;
      }

      const durationSec = w.ride?.duration ?? w.duration ?? 0;
      const durationMinutes = Math.round(durationSec / 60) || 1;
      const ride = w.ride;
      const discipline = w.fitness_discipline ?? ride?.fitness_discipline;
      const title = ride?.title;
      const instructor = ride?.instructor?.name;

      sessions.push({
        id: w.id ?? crypto.randomUUID(),
        durationMinutes,
        discipline: discipline ? String(discipline) : undefined,
        title: title ? String(title) : undefined,
        instructor: instructor ? String(instructor) : undefined,
      });
    }

    page++;
    hasMore = hasMore && page < pageCount && workouts.length > 0;
  }

  return sessions;
}
