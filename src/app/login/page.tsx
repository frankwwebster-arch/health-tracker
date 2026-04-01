"use client";

import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAttemptAt, setLastAttemptAt] = useState(0);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/today");
    }
  }, [authLoading, user, router]);

  const getFriendlyAuthError = (message?: string) => {
    const m = (message ?? "").toLowerCase();
    if (
      m.includes("rate") ||
      m.includes("too many") ||
      m.includes("email rate exceeded")
    ) {
      return "Too many login attempts. Please wait a minute and try again.";
    }
    return "We couldn't send your magic link right now. Please try again in a moment.";
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const now = Date.now();
    if (now - lastAttemptAt < 5000) {
      setError("Please wait a few seconds before trying again.");
      return;
    }
    setLastAttemptAt(now);
    setError(null);
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError("Sync not configured.");
      setLoading(false);
      return;
    }
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
    setLoading(false);
    if (err) {
      setError(getFriendlyAuthError(err.message));
      return;
    }
    setSent(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-surface">
        <p className="text-sm text-muted">Restoring your session…</p>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-surface">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Health Tracker</h1>
        <p className="text-muted text-sm mb-4 leading-relaxed">
          Sign in with email—no password. We&apos;ll remember this device so you don&apos;t have to
          sign in again unless you log out.
        </p>
        <p className="text-xs text-muted/90 mb-6 leading-relaxed rounded-xl bg-white/60 border border-border/80 px-3 py-2">
          Your health data stays on this device by default for privacy. Sign-in is for identity only,
          not for storing your wellness details in the cloud.
        </p>

        {sent ? (
          <div className="rounded-2xl border border-accent/20 bg-accent-soft/50 p-4">
            <p className="font-medium text-gray-800">Check your email</p>
            <p className="text-sm text-muted mt-1">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-800">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1 block w-full rounded-xl border border-border px-4 py-3 text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/today" className="text-accent hover:underline">
            Continue without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
