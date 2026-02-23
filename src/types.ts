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
  weightKg: number | null;
  weightLoggedAt: number | null;
  bedtime: string | null; // "HH:mm"
  wakeTime: string | null; // "HH:mm"
  sentimentMorning: number | null; // 1-5
  sentimentMidday: number | null;
  sentimentEvening: number | null;
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
  medicationSupply: {
    dex1: number;
    dex2: number;
    dex3: number;
    bupropion: number;
  };
  medicationPillsPerDay: {
    dex1: number;
    dex2: number;
    dex3: number;
    bupropion: number;
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
  medicationSupply: {
    dex1: 0,
    dex2: 0,
    dex3: 0,
    bupropion: 0,
  },
  medicationPillsPerDay: {
    dex1: 1,
    dex2: 1,
    dex3: 1,
    bupropion: 1,
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
    weightKg: null,
    weightLoggedAt: null,
    bedtime: null,
    wakeTime: null,
    sentimentMorning: null,
    sentimentMidday: null,
    sentimentEvening: null,
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

export type WeightUnit = "kg" | "lbs" | "stone";

const LBS_PER_KG = 2.20462;
const KG_PER_STONE = 6.35029;

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function kgToStone(kg: number): { stone: number; lbs: number } {
  const totalLbs = kg * LBS_PER_KG;
  const stone = Math.floor(totalLbs / 14);
  const lbs = totalLbs % 14;
  return { stone, lbs };
}

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

export function stoneToKg(stone: number, lbs: number = 0): number {
  return (stone * 14 + lbs) / LBS_PER_KG;
}

/** Parse "11.5" as 11st 5lb, "11.12" as 11st 12lb */
export function parseStoneInput(val: number): { stone: number; lbs: number } {
  const s = Math.floor(val);
  const dec = val - s;
  const lbs = Math.min(13, Math.round(dec * 100));
  return { stone: s, lbs };
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === "kg") return `${kg.toFixed(1)} kg`;
  if (unit === "lbs") return `${kgToLbs(kg).toFixed(1)} lbs`;
  const { stone, lbs } = kgToStone(kg);
  return `${stone} st ${lbs.toFixed(1)} lb`;
}
