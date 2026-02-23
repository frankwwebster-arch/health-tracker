"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useTodayData(dateKey?: string) {
  const [data, setData] = useState<DayData | null>(null);
  const key = dateKey ?? getDateKey();

  const load = useCallback(async () => {
    const d = await getDayData(key);
    setData(d);
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (updater: (prev: DayData) => DayData) => {
      if (!data) return;
      const next = updater(data);
      setData(next);
      await setDayData(key, next);
    },
    [data, key]
  );

  return { data, update, refresh: load, dateKey: key };
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettingsState);
  }, []);

  const setSettings = useCallback(async (s: Settings) => {
    setSettingsState(s);
    await saveSettings(s);
  }, []);

  return { settings, setSettings };
}

export function useLastNotified(dateKey: string) {
  const [lastNotified, setLastNotifiedState] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const ln = await getLastNotified(dateKey);
    setLastNotifiedState(ln);
  }, [dateKey]);

  useEffect(() => {
    load();
  }, [load]);

  const setLastNotified = useCallback(
    async (reminderId: string, ts: number) => {
      await saveLastNotified(dateKey, reminderId, ts);
      setLastNotifiedState((prev) => ({ ...prev, [reminderId]: ts }));
    },
    [dateKey]
  );

  return { lastNotified, setLastNotified, refresh: load };
}
