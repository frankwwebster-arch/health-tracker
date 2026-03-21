"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { syncNow, syncDay, getLastSync } from "@/lib/sync";
import type { SyncResult } from "@/lib/sync";
import { useStorageScope } from "@/components/AuthProvider";

interface SyncContextValue {
  markModified: (dateKey: string) => void;
  sync: () => Promise<SyncResult>;
  /** Single-day sync with session dirty-set (for navigation) */
  syncDayNow: (dateKey: string) => Promise<SyncResult>;
  lastSync: number | null;
  refreshLastSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { scope } = useStorageScope();
  const [modifiedThisSession, setModified] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    getLastSync(scope).then(setLastSync);
  }, [scope]);

  const markModified = useCallback((dateKey: string) => {
    setModified((prev) => new Set(prev).add(dateKey));
  }, []);

  const sync = useCallback(async (): Promise<SyncResult> => {
    const result = await syncNow(scope, modifiedThisSession);
    if (result.success) {
      setLastSync(Date.now());
      setModified(new Set());
    }
    return result;
  }, [modifiedThisSession, scope]);

  const syncDayNow = useCallback(
    async (dateKey: string): Promise<SyncResult> => {
      return syncDay(scope, dateKey, modifiedThisSession);
    },
    [scope, modifiedThisSession]
  );

  const refreshLastSync = useCallback(async () => {
    const ts = await getLastSync(scope);
    setLastSync(ts);
  }, [scope]);

  return (
    <SyncContext.Provider
      value={{ markModified, sync, syncDayNow, lastSync, refreshLastSync }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  return ctx;
}
