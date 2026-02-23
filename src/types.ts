export type MedicationKey = "dex1" | "dex2" | "dex3" | "bupropion";

export interface MedicationEntry {
  taken: boolean;
  takenAt: number | null;
}

export interface WaterLogEntry {
  amount: number;
  timestamp: number;
}

export interface DayData {
  medication: {
    dex1: MedicationEntry;
    dex2: MedicationEntry;
    dex3: MedicationEntry;
    bupropion: MedicationEntry;
  };
  lunchEaten: boolean;
  lunchAt: number | null;
  lunchNote: string;
  smoothieEaten: boolean;
  smoothieAt: number | null;
  smoothieNote: string;
  snackEaten: boolean;
  snackNote: string;
  waterMl: number;
  waterLog: WaterLogEntry[];
  workoutDone: boolean;
  walkDone: boolean;
  stepsCount: number | null;
}

export interface ReminderLastNotified {
  [key: string]: number;
}

export interface Settings {
  remindersEnabled: boolean;
  weekdayOnly: boolean;
  waterGoalMl: number;
  waterIntervalMinutes: number;
  waterStartTime: string; // "HH:mm"
  waterEndTime: string;
  lunchReminderTime: string;
  medicationRemindersEnabled: boolean;
  medicationTimes: {
    dex1: string;
    dex2: string;
    dex3: string;
    bupropion: string;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  remindersEnabled: true,
  weekdayOnly: true,
  waterGoalMl: 2000,
  waterIntervalMinutes: 120,
  waterStartTime: "09:30",
  waterEndTime: "18:30",
  lunchReminderTime: "12:30",
  medicationRemindersEnabled: true,
  medicationTimes: {
    dex1: "07:00",
    dex2: "12:30",
    dex3: "15:30",
    bupropion: "07:30",
  },
};

export function createEmptyDayData(): DayData {
  return {
    medication: {
      dex1: { taken: false, takenAt: null },
      dex2: { taken: false, takenAt: null },
      dex3: { taken: false, takenAt: null },
      bupropion: { taken: false, takenAt: null },
    },
    lunchEaten: false,
    lunchAt: null,
    lunchNote: "",
    smoothieEaten: false,
    smoothieAt: null,
    smoothieNote: "",
    snackEaten: false,
    snackNote: "",
    waterMl: 0,
    waterLog: [],
    workoutDone: false,
    walkDone: false,
    stepsCount: null,
  };
}

export function getDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateKeyToDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getAdjacentDateKey(dateKey: string, delta: number): string {
  const d = dateKeyToDate(dateKey);
  d.setDate(d.getDate() + delta);
  return getDateKey(d);
}

export function formatDateLabel(dateKey: string): string {
  const d = dateKeyToDate(dateKey);
  const today = getDateKey();
  if (dateKey === today) return "Today";
  const yesterday = getAdjacentDateKey(today, -1);
  if (dateKey === yesterday) return "Yesterday";
  const tomorrow = getAdjacentDateKey(today, 1);
  if (dateKey === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
