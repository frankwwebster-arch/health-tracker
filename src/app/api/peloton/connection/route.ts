import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getConnection,
  getCredentials,
  saveCredentials,
  updateTestResult,
  deleteConnection,
} from "@/lib/peloton/credentials";
import { authenticate } from "@/lib/peloton/api";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ configured: false, connected: false }, { status: 200 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ configured: false, connected: false }, { status: 200 });
  }

  const conn = await getConnection(user.id);
  if (!conn) {
    return NextResponse.json({
      configured: false,
      connected: false,
      usernameHint: null,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestError: null,
    });
  }

  return NextResponse.json({
    configured: true,
    connected: true,
    usernameHint: conn.usernameHint,
    lastTestedAt: conn.lastTestedAt,
    lastTestStatus: conn.lastTestStatus,
    lastTestError: conn.lastTestError,
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const hasKey = !!process.env.PELOTON_CREDENTIALS_ENCRYPTION_KEY;
  if (!hasKey) {
    return NextResponse.json(
      { error: "Peloton encryption key not configured. Set PELOTON_CREDENTIALS_ENCRYPTION_KEY." },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  const result = await saveCredentials(user.id, username, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Verify connection
  const auth = await authenticate(username, password);
  if (auth.ok) {
    await updateTestResult(user.id, "success");
    return NextResponse.json({ success: true, status: "success" });
  } else {
    await updateTestResult(user.id, "failure", auth.error);
    return NextResponse.json({
      success: true,
      status: "failure",
      error: auth.error || "Could not sign in to Peloton. Check credentials.",
    });
  }
}

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const creds = await getCredentials(user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "No Peloton credentials saved. Save & connect first." },
      { status: 400 }
    );
  }

  const auth = await authenticate(creds.username, creds.password);
  if (auth.ok) {
    await updateTestResult(user.id, "success");
    return NextResponse.json({ success: true, status: "success" });
  } else {
    await updateTestResult(user.id, "failure", auth.error);
    return NextResponse.json({
      success: false,
      status: "failure",
      error: auth.error || "Peloton login failed. Try re-entering credentials.",
    });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ok = await deleteConnection(user.id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
