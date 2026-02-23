import { NextResponse } from "next/server";
import { PelotonApiError, createPelotonSession } from "@/lib/peloton/api";
import {
  deletePelotonConnectionForUser,
  getCurrentUserContext,
  getPelotonConnectionRow,
  getUserStoredPelotonCredentials,
  upsertPelotonCredentialsForUser,
  updatePelotonConnectionTestResult,
} from "@/lib/peloton/credentials";
import { hasPelotonEncryptionKey } from "@/lib/peloton/crypto";

export const dynamic = "force-dynamic";

type PelotonConnectionRequestBody = {
  username?: string;
  password?: string;
};

function mapPelotonError(error: unknown): string {
  if (error instanceof PelotonApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Peloton rejected these credentials.";
    }
    return "Peloton is unavailable right now. Please try again.";
  }

  if (error instanceof Error) return error.message;
  return "Connection failed";
}

function unauthorized() {
  return NextResponse.json({ error: "Sign in required" }, { status: 401 });
}

function serviceUnavailable() {
  return NextResponse.json(
    { error: "Sync backend is not configured" },
    { status: 503 }
  );
}

async function parseConnectionBody(
  request: Request
): Promise<PelotonConnectionRequestBody | null> {
  try {
    return (await request.json()) as PelotonConnectionRequestBody;
  } catch {
    return null;
  }
}

export async function GET() {
  const { supabase, userId } = await getCurrentUserContext();
  if (!supabase) return serviceUnavailable();
  if (!userId) return unauthorized();

  const row = await getPelotonConnectionRow(supabase, userId);
  return NextResponse.json({
    connected: Boolean(row),
    usernameHint: row?.username_hint ?? null,
    lastTestedAt: row?.last_tested_at ?? null,
    lastTestStatus: row?.last_test_status ?? null,
    lastTestError: row?.last_test_error ?? null,
    encryptionReady: hasPelotonEncryptionKey(),
  });
}

export async function PUT(request: Request) {
  const { supabase, userId } = await getCurrentUserContext();
  if (!supabase) return serviceUnavailable();
  if (!userId) return unauthorized();

  if (!hasPelotonEncryptionKey()) {
    return NextResponse.json(
      {
        error:
          "PELOTON_CREDENTIALS_ENCRYPTION_KEY is not set on the server.",
      },
      { status: 500 }
    );
  }

  const body = await parseConnectionBody(request);
  const username =
    typeof body?.username === "string" ? body.username.trim() : "";
  const password =
    typeof body?.password === "string" ? body.password.trim() : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  try {
    await createPelotonSession({ username, password });
    await upsertPelotonCredentialsForUser(supabase, userId, username, password);
    const row = await getPelotonConnectionRow(supabase, userId);

    return NextResponse.json({
      connected: true,
      usernameHint: row?.username_hint ?? null,
      lastTestedAt: row?.last_tested_at ?? new Date().toISOString(),
      lastTestStatus: "success" as const,
      lastTestError: null,
      encryptionReady: true,
      message: "Peloton account connected successfully.",
    });
  } catch (error) {
    return NextResponse.json({ error: mapPelotonError(error) }, { status: 400 });
  }
}

export async function POST() {
  const { supabase, userId } = await getCurrentUserContext();
  if (!supabase) return serviceUnavailable();
  if (!userId) return unauthorized();

  try {
    const credentials = await getUserStoredPelotonCredentials(supabase, userId);
    if (!credentials) {
      return NextResponse.json(
        { error: "No saved Peloton credentials. Add them first." },
        { status: 404 }
      );
    }

    await createPelotonSession(credentials);
    await updatePelotonConnectionTestResult(supabase, userId, "success", null);
    const row = await getPelotonConnectionRow(supabase, userId);

    return NextResponse.json({
      connected: true,
      usernameHint: row?.username_hint ?? null,
      lastTestedAt: row?.last_tested_at ?? new Date().toISOString(),
      lastTestStatus: "success" as const,
      lastTestError: null,
      message: "Peloton connection confirmed.",
    });
  } catch (error) {
    const errorMessage = mapPelotonError(error);
    try {
      await updatePelotonConnectionTestResult(
        supabase,
        userId,
        "failure",
        errorMessage
      );
    } catch {
      // Keep response useful even if status update fails.
    }
    const row = await getPelotonConnectionRow(supabase, userId);

    return NextResponse.json(
      {
        connected: Boolean(row),
        usernameHint: row?.username_hint ?? null,
        lastTestedAt: row?.last_tested_at ?? new Date().toISOString(),
        lastTestStatus: "failure" as const,
        lastTestError: errorMessage,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const { supabase, userId } = await getCurrentUserContext();
  if (!supabase) return serviceUnavailable();
  if (!userId) return unauthorized();

  await deletePelotonConnectionForUser(supabase, userId);
  return NextResponse.json({
    connected: false,
    message: "Peloton connection removed.",
  });
}

