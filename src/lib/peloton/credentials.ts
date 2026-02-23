import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "./crypto";

export interface PelotonConnection {
  usernameHint: string;
  lastTestedAt: string | null;
  lastTestStatus: "success" | "failure" | null;
  lastTestError: string | null;
}

export async function getConnection(userId: string): Promise<PelotonConnection | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return null;

  const { data, error } = await supabase
    .from("peloton_connections")
    .select("username_hint, last_tested_at, last_test_status, last_test_error")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    usernameHint: (data.username_hint as string) ?? "",
    lastTestedAt: (data.last_tested_at as string) ?? null,
    lastTestStatus: (data.last_test_status as "success" | "failure" | null) ?? null,
    lastTestError: (data.last_test_error as string) ?? null,
  };
}

export async function getCredentials(userId: string): Promise<{ username: string; password: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return null;

  const { data, error } = await supabase
    .from("peloton_connections")
    .select("username_encrypted, password_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.username_encrypted || !data?.password_encrypted) return null;

  try {
    return {
      username: decrypt(data.username_encrypted as string),
      password: decrypt(data.password_encrypted as string),
    };
  } catch {
    return null;
  }
}

export async function saveCredentials(
  userId: string,
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { ok: false, error: "Not authenticated" };

  try {
    const usernameEncrypted = encrypt(username);
    const passwordEncrypted = encrypt(password);
    const usernameHint = username.length > 2 ? `${username.slice(0, 2)}***` : "***";

    const { error } = await supabase.from("peloton_connections").upsert(
      {
        user_id: userId,
        username_encrypted: usernameEncrypted,
        password_encrypted: passwordEncrypted,
        username_hint: usernameHint,
        last_tested_at: null,
        last_test_status: null,
        last_test_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Encryption failed" };
  }
}

export async function updateTestResult(
  userId: string,
  status: "success" | "failure",
  errorMessage?: string
): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  await supabase
    .from("peloton_connections")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: status,
      last_test_error: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function deleteConnection(userId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("peloton_connections")
    .delete()
    .eq("user_id", userId);

  return !error;
}
