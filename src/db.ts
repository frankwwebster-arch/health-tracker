import { get, set, del, createStore, keys } from "idb-keyval";
import type { DayData, Settings } from "@/types";
import {
  createEmptyDayData,
  getDateKey,
  DEFAULT_SETTINGS,
} from "@/types";

const DAYS_STORE = "health-days";
const SETTINGS_KEY = "health-settings";
const LAST_NOTIFIED_KEY = "health-last-notified";

const daysStore = createStore("health-tracker-db", DAYS_STORE);

export async function getDayData(dateKey: string): Promise<DayData> {
  const data = await get<DayData>(dateKey, daysStore);
  if (!data) return createEmptyDayData();
  return { ...createEmptyDayData(), ...data } as DayData;
}

export async function setDayData(dateKey: string, data: DayData): Promise<void> {
  await set(dateKey, data, daysStore);
}

export async function getSettings(): Promise<Settings> {
  const s = await get<Settings>(SETTINGS_KEY);
  return s ?? { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Settings): Promise<void> {
  await set(SETTINGS_KEY, settings);
}

export async function getLastNotified(dateKey: string): Promise<Record<string, number>> {
  const key = `${LAST_NOTIFIED_KEY}-${dateKey}`;
  const data = await get<Record<string, number>>(key);
  return data ?? {};
}

export async function setLastNotified(
  dateKey: string,
  reminderId: string,
  timestamp: number
): Promise<void> {
  const key = `${LAST_NOTIFIED_KEY}-${dateKey}`;
  const current = await getLastNotified(dateKey);
  await set(key, { ...current, [reminderId]: timestamp });
}

export async function getAllDayKeys(): Promise<string[]> {
  const allKeys = await keys(daysStore);
  return allKeys.filter((k): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k));
}

export async function resetToday(): Promise<void> {
  const todayKey = getDateKey();
  await setDayData(todayKey, createEmptyDayData());
  await del(`${LAST_NOTIFIED_KEY}-${todayKey}`);
}
