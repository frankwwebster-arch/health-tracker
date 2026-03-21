"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  LOCAL_STORAGE_SCOPE,
  migrateLegacyFlatKeysOnce,
  migrateLocalScopeToUserIfNeeded,
} from "@/db";

const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});

const StorageScopeContext = createContext<{
  scope: string;
  isSignedIn: boolean;
}>({
  scope: LOCAL_STORAGE_SCOPE,
  isSignedIn: false,
});

export { LOCAL_STORAGE_SCOPE };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      await migrateLegacyFlatKeysOnce();
      const {
        data: { user: initial },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (initial?.id) {
        await migrateLocalScopeToUserIfNeeded(initial.id);
      }
      if (cancelled) return;
      setUser(initial ?? null);
      setLoading(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      if (u?.id) {
        await migrateLocalScopeToUserIfNeeded(u.id);
      }
      setUser(u);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const scope = user?.id ?? LOCAL_STORAGE_SCOPE;

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <StorageScopeContext.Provider
        value={{ scope, isSignedIn: Boolean(user) }}
      >
        {children}
      </StorageScopeContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** IndexedDB + localStorage scope: signed-in user id, or `"local"` when anonymous. */
export function useStorageScope() {
  return useContext(StorageScopeContext);
}
