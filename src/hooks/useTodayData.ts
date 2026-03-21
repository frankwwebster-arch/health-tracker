"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DayData, Settings } from "@/types";
import {
  getDayData,
  setDayData,
  getSettings,
  setSettings as saveSettings,
  getLastNotified,
  setLastNotified as saveLastNotified,
} from "@/db";
import { getDateKey } from "@/types";
import { useSync } from "@/components/SyncContext";
import { useStorageScope } from "@/components/AuthProvider";

export function useTodayData(dateKey?: string) {
  const [data, setData] = useState<DayData | null>(null);
  const dataRef = useRef<DayData | null>(null);
  const key = dateKey ?? getDateKey();
  const sync = useSync();
  const { scope } = useStorageScope();

  const load = useCallback(async () => {
    const d = await getDayData(scope, key);
    dataRef.current = d;
    setData(d);
  }, [key, scope]);

  useEffect(() => {
    dataRef.current = null;
    setData(null);
    load();
  }, [load]);

  const update = useCallback(
    async (updater: (prev: DayData) => DayData) => {
      const current = dataRef.current;
      if (!current) return;
      const next = updater(current);
      if (Object.is(next, current)) return;
      dataRef.current = next;
      setData(next);
      await setDayData(scope, key, next);
      sync?.markModified(key);
    },
    [key, scope, sync]
  );

  return { data, update, refresh: load, dateKey: key };
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const { scope } = useStorageScope();

  useEffect(() => {
    getSettings(scope).then(setSettingsState);
  }, [scope]);

  const setSettings = useCallback(
    async (s: Settings) => {
      setSettingsState(s);
      await saveSettings(scope, s);
    },
    [scope]
  );

  return { settings, setSettings };
}

export function useLastNotified(dateKey: string) {
  const [lastNotified, setLastNotifiedState] = useState<Record<string, number>>({});
  const { scope } = useStorageScope();

  const load = useCallback(async () => {
    const ln = await getLastNotified(scope, dateKey);
    setLastNotifiedState(ln);
  }, [dateKey, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const setLastNotified = useCallback(
    async (reminderId: string, ts: number) => {
      await saveLastNotified(scope, dateKey, reminderId, ts);
      setLastNotifiedState((prev) => ({ ...prev, [reminderId]: ts }));
    },
    [dateKey, scope]
  );

  return { lastNotified, setLastNotified, refresh: load };
}
