"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { SyncStatus } from "@/components/SyncStatus";

export function AccountWidget() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
      >
        Sign in
      </Link>
    );
  }

  const signOut = async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
  };

  return (
    <div className="flex items-center gap-2">
      <SyncStatus />
      <button
        type="button"
        onClick={signOut}
        className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
      >
        Log out
      </button>
    </div>
  );
}
