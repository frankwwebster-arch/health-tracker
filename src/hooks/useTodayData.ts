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

export function useTodayData() {
  const [data, setData] = useState<DayData | null>(null);
  const dateKey = getDateKey();

  const load = useCallback(async () => {
    const d = await getDayData(dateKey);
    setData(d);
  }, [dateKey]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (updater: (prev: DayData) => DayData) => {
      if (!data) return;
      const next = updater(data);
      setData(next);
      await setDayData(dateKey, next);
    },
    [data, dateKey]
  );

  return { data, update, refresh: load };
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
