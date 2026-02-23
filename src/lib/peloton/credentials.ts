import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  decryptPelotonSecret,
  encryptPelotonSecret,
  hasPelotonEncryptionKey,
} from "@/lib/peloton/crypto";

export type PelotonTestStatus = "success" | "failure";

export interface PelotonConnectionRow {
  user_id: string;
  username_encrypted: string;
  password_encrypted: string;
  username_hint: string;
  last_tested_at: string | null;
  last_test_status: PelotonTestStatus | null;
  last_test_error: string | null;
  updated_at: string;
}

export interface EffectivePelotonCredentials {
  username: string;
  password: string;
  source: "user" | "env";
}

export interface CurrentUserContext {
  supabase: ServerSupabaseClient | null;
  userId: string | null;
}

type ServerSupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

function normalizeTestStatus(value: unknown): PelotonTestStatus | null {
  if (value === "success" || value === "failure") return value;
  return null;
}

export function maskPelotonUsername(username: string): string {
  const trimmed = username.trim();
  if (trimmed.length === 0) return "";

  const atIndex = trimmed.indexOf("@");
  if (atIndex > 0) {
    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);
    const localMasked =
      local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
    return domain ? `${localMasked}@${domain}` : localMasked;
  }

  if (trimmed.length <= 3) return `${trimmed[0] ?? "*"}**`;
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
}

export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    userId: user?.id ?? null,
  };
}

export async function getPelotonConnectionRow(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<PelotonConnectionRow | null> {
  const { data, error } = await supabase
    .from("peloton_connections")
    .select(
      "user_id, username_encrypted, password_encrypted, username_hint, last_tested_at, last_test_status, last_test_error, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    user_id: String(data.user_id),
    username_encrypted: String(data.username_encrypted),
    password_encrypted: String(data.password_encrypted),
    username_hint: String(data.username_hint ?? ""),
    last_tested_at:
      typeof data.last_tested_at === "string" ? data.last_tested_at : null,
    last_test_status: normalizeTestStatus(data.last_test_status),
    last_test_error:
      typeof data.last_test_error === "string" ? data.last_test_error : null,
    updated_at:
      typeof data.updated_at === "string"
        ? data.updated_at
        : new Date(0).toISOString(),
  };
}

export async function upsertPelotonCredentialsForUser(
  supabase: ServerSupabaseClient,
  userId: string,
  username: string,
  password: string
): Promise<void> {
  if (!hasPelotonEncryptionKey()) {
    throw new Error("PELOTON_CREDENTIALS_ENCRYPTION_KEY is not configured");
  }

  const usernameEncrypted = encryptPelotonSecret(username);
  const passwordEncrypted = encryptPelotonSecret(password);
  const nowIso = new Date().toISOString();
  const usernameHint = maskPelotonUsername(username);

  const { error } = await supabase.from("peloton_connections").upsert(
    {
      user_id: userId,
      username_encrypted: usernameEncrypted,
      password_encrypted: passwordEncrypted,
      username_hint: usernameHint,
      last_tested_at: nowIso,
      last_test_status: "success",
      last_test_error: null,
      updated_at: nowIso,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePelotonConnectionTestResult(
  supabase: ServerSupabaseClient,
  userId: string,
  status: PelotonTestStatus,
  errorMessage: string | null
): Promise<void> {
  const nowIso = new Date().toISOString();
  const normalizedError =
    status === "failure" && errorMessage
      ? errorMessage.slice(0, 240)
      : null;

  const { error } = await supabase
    .from("peloton_connections")
    .update({
      last_tested_at: nowIso,
      last_test_status: status,
      last_test_error: normalizedError,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePelotonConnectionForUser(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("peloton_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getUserStoredPelotonCredentials(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<{ username: string; password: string } | null> {
  const row = await getPelotonConnectionRow(supabase, userId);
  if (!row) return null;

  return {
    username: decryptPelotonSecret(row.username_encrypted),
    password: decryptPelotonSecret(row.password_encrypted),
  };
}

export async function getEffectivePelotonCredentialsForCurrentUser(): Promise<{
  credentials: EffectivePelotonCredentials | null;
  source: "user" | "env" | "none";
  userId: string | null;
  supabase: ServerSupabaseClient | null;
}> {
  const { supabase, userId } = await getCurrentUserContext();
  if (supabase && userId) {
    const userCredentials = await getUserStoredPelotonCredentials(
      supabase,
      userId
    );
    if (userCredentials) {
      return {
        credentials: { ...userCredentials, source: "user" },
        source: "user",
        userId,
        supabase,
      };
    }
  }

  const envUsername = process.env.PELOTON_USERNAME;
  const envPassword = process.env.PELOTON_PASSWORD;
  if (envUsername && envPassword) {
    return {
      credentials: {
        username: envUsername,
        password: envPassword,
        source: "env",
      },
      source: "env",
      userId,
      supabase,
    };
  }

  return {
    credentials: null,
    source: "none",
    userId,
    supabase,
  };
}

