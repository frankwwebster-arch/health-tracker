import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/peloton/credentials";
import { authenticate, fetchWorkoutsForDate } from "@/lib/peloton/api";

function getCredentialsForRequest(): Promise<{ username: string; password: string } | null> {
  const envUser = process.env.PELOTON_USERNAME;
  const envPass = process.env.PELOTON_PASSWORD;
  if (envUser && envPass) {
    return Promise.resolve({ username: envUser, password: envPass });
  }
  return Promise.resolve(null);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateKey = searchParams.get("date");
  const timeZone = searchParams.get("timeZone") ?? "UTC";

  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: "Valid date (YYYY-MM-DD) required" }, { status: 400 });
  }

  let username: string;
  let password: string;
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const creds = await getCredentials(user.id);
      if (creds) {
        username = creds.username;
        password = creds.password;
      } else {
        const envCreds = await getCredentialsForRequest();
        if (!envCreds) {
          return NextResponse.json(
            {
              workoutMinutes: null,
              workoutSessions: [],
              configured: false,
              error: "Peloton not configured. Add credentials in Settings → Peloton or set PELOTON_USERNAME/PELOTON_PASSWORD.",
            },
            { status: 200 }
          );
        }
        username = envCreds.username;
        password = envCreds.password;
      }
    } else {
      const envCreds = await getCredentialsForRequest();
      if (!envCreds) {
        return NextResponse.json(
          {
            workoutMinutes: null,
            workoutSessions: [],
            configured: false,
            error: "Peloton not configured. Sign in and add credentials in Settings → Peloton, or set PELOTON_USERNAME/PELOTON_PASSWORD.",
          },
          { status: 200 }
        );
      }
      username = envCreds.username;
      password = envCreds.password;
    }
  } else {
    const envCreds = await getCredentialsForRequest();
    if (!envCreds) {
      return NextResponse.json(
        {
          workoutMinutes: null,
          workoutSessions: [],
          configured: false,
          error: "Peloton not configured.",
        },
        { status: 200 }
      );
    }
    username = envCreds.username;
    password = envCreds.password;
  }

  try {
    const auth = await authenticate(username, password);
    if (!auth.ok) {
      return NextResponse.json(
        {
          workoutMinutes: null,
          workoutSessions: [],
          configured: true,
          error: auth.error || "Peloton login failed. Check your credentials.",
        },
        { status: 200 }
      );
    }

    const sessions = await fetchWorkoutsForDate(auth.sessionId, auth.userId, dateKey, timeZone);
    const workoutMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0) || null;

    return NextResponse.json({
      workoutMinutes,
      workoutSessions: sessions,
      configured: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Peloton sync failed";
    return NextResponse.json(
      {
        workoutMinutes: null,
        workoutSessions: [],
        configured: true,
        error: msg,
      },
      { status: 200 }
    );
  }
}
