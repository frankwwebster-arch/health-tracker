"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { syncNow, getLastSync } from "@/lib/sync";
import type { SyncResult } from "@/lib/sync";

interface SyncContextValue {
  markModified: (dateKey: string) => void;
  sync: () => Promise<SyncResult>;
  lastSync: number | null;
  refreshLastSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [modifiedThisSession, setModified] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    getLastSync().then(setLastSync);
  }, []);

  const markModified = useCallback((dateKey: string) => {
    setModified((prev) => new Set(prev).add(dateKey));
  }, []);

  const sync = useCallback(async (): Promise<SyncResult> => {
    const result = await syncNow(modifiedThisSession);
    if (result.success) {
      setLastSync(Date.now());
      setModified(new Set());
    }
    return result;
  }, [modifiedThisSession]);

  const refreshLastSync = useCallback(async () => {
    const ts = await getLastSync();
    setLastSync(ts);
  }, []);

  return (
    <SyncContext.Provider
      value={{ markModified, sync, lastSync, refreshLastSync }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  return ctx;
}
