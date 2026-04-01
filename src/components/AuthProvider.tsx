"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  const migratedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let bootstrapResolved = false;

    const applyUser = async (nextUser: User | null) => {
      if (cancelled) return;
      if (nextUser?.id && migratedUserIdRef.current !== nextUser.id) {
        migratedUserIdRef.current = nextUser.id;
        await migrateLocalScopeToUserIfNeeded(nextUser.id);
      }
      if (cancelled) return;
      if (!nextUser?.id) {
        migratedUserIdRef.current = null;
      }
      setUser(nextUser);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Covers magic-link return, refresh events, and later token/session changes.
      bootstrapResolved = true;
      await applyUser(session?.user ?? null);
    });

    const bootstrap = async () => {
      await migrateLegacyFlatKeysOnce();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || bootstrapResolved) return;
      await applyUser(session?.user ?? null);
    };

    void bootstrap();

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
