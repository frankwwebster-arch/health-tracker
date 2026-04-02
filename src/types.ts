export type MedicationKey = "dex" | "bupropion";

export interface MedicationEntry {
  taken: boolean;
  takenAt: number | null;
}

export interface MultiDoseMedication {
  doses: MedicationEntry[];
}

export interface WaterLogEntry {
  amount: number;
  timestamp: number;
}

export interface SupplementsMedsLogEntry {
  id: string;
  itemId: string;
  /** For timing-important doses; null for simple once-per-day logs. */
  slotId: string | null;
  takenAt: number;
}

/** Single Peloton workout session (synced or manual) */
export interface PelotonWorkoutSession {
  id: string;
  durationMinutes: number;
  /** Optional: e.g. "Cycling", "Strength" */
  discipline?: string;
  /** Optional: class title e.g. "30 min HIIT Ride" */
  title?: string;
  /** Optional: instructor name e.g. "Kendall Toole" */
  instructor?: string;
}

export interface CoachWorkoutEntry {
  id: string;
  type: "coach";
  label: string;
  minutes: number;
  createdAt: number;
  /** Optional reference for future per-session review. */
  sessionRefId?: string;
  /** Read-only review payload for this saved workout. */
  reviewSnapshot?: {
    blocks: WorkoutCoachBlock[];
    blockStates: Record<string, WorkoutCoachBlockLiveState>;
  };
}

export interface DayData {
  medication: {
    dex: MultiDoseMedication;
    bupropion: MedicationEntry;
  };
  lunchEaten: boolean;
  lunchAt: number | null;
  lunchNote: string;
  lunchFoods: string[];
  smoothieEaten: boolean;
  smoothieAt: number | null;
  smoothieNote: string;
  smoothieFoods: string[];
  snackEaten: boolean;
  snackNote: string;
  snackFoods: string[];
  waterMl: number;
  waterLog: WaterLogEntry[];
  workoutMinutes: number | null; // total minutes (from presets or Peloton sessions)
  /** Per-session breakdown when synced from Peloton or multiple workouts */
  workoutSessions?: PelotonWorkoutSession[];
  /** Saved Workout Coach entries (multiple per day supported). */
  coachWorkoutEntries?: CoachWorkoutEntry[];
  /** Phase A — manual swim minutes (Today); separate from Peloton / Coach `workoutMinutes` */
  manualSwimMinutes?: number | null;
  /** Phase A — manual named activity + minutes (not reusable presets yet) */
  manualOtherActivity?: { name: string; minutes: number } | null;
  walkDone: boolean;
  stepsCount: number | null;
  weightKg: number | null;
  weightLoggedAt: number | null;
  bedtime: string | null; // "HH:mm"
  wakeTime: string | null; // "HH:mm"
  sentimentMorning: number | null; // 1-5
  sentimentMidday: number | null;
  sentimentEvening: number | null;
  customMedsTaken: Record<string, MedicationEntry>; // id -> { taken, takenAt }
  /** Supplements & Meds daily intake logs (local-first). */
  supplementsMedsLogEntries?: SupplementsMedsLogEntry[];
  /** Workout Coach: generated session + post-workout log (syncs with day JSON) */
  workoutCoach?: WorkoutCoachDayState;
}

/** Single exercise line in a generated block */
export interface WorkoutCoachExercise {
  name: string;
  detail: string;
}

export type WorkoutCoachBlockKind =
  | "warmup"
  | "amrap"
  | "structured_push"
  | "core_circuit"
  | "kb_ladder"
  | "cooldown";

/** Live-session behaviour (explicit; preferred over `kind` for runtime). */
export type WorkoutCoachBlockType =
  | "warmup_timed"
  | "amrap_timed"
  | "structured_rounds"
  | "cooldown_timed";

export interface WorkoutCoachBlock {
  id: string;
  kind: WorkoutCoachBlockKind;
  /** Set on generated workouts; inferred for legacy JSON. */
  blockType?: WorkoutCoachBlockType;
  title: string;
  minutes: number;
  exercises: WorkoutCoachExercise[];
  /** e.g. rest guidance */
  coaching?: string;
  /** Fixed rounds for structured_push / core_circuit (no ranges) */
  roundTarget?: number;
  /** Countdown duration for timed block types (seconds). */
  durationSeconds?: number;
  /** structured_rounds — mirrors roundTarget when present */
  targetRounds?: number;
  /** Planned rest between rounds for structured blocks (planning/display only, not auto timer). */
  plannedRoundRestSeconds?: number;
}

/** ---- Workout Coach live session (persisted; survives refresh) ---- */

export type TimedBlockLiveStatus = "not_started" | "active" | "paused" | "completed";

export interface WarmupCooldownTimedLiveState {
  blockId: string;
  blockType: "warmup_timed" | "cooldown_timed";
  status: TimedBlockLiveStatus;
  remainingSeconds: number;
  /** When status is active — wall-clock end for refresh-safe countdown */
  endAtEpochMs?: number | null;
}

export interface AmrapTimedLiveState {
  blockId: string;
  blockType: "amrap_timed";
  status: TimedBlockLiveStatus;
  remainingSeconds: number;
  endAtEpochMs?: number | null;
}

export type StructuredRoundsLiveStatus =
  | "not_started"
  | "active"
  | "rounds_complete_pending_decision"
  /** User chose "Do extra round"; show until "Extra round complete". */
  | "extra_round_in_progress"
  | "rest_started"
  | "completed";

export type StructuredExtraRoundState =
  | "unavailable"
  | "available"
  /** User is performing the optional extra round (no arming step). */
  | "in_progress"
  | "completed";

export interface StructuredRoundsLiveState {
  blockId: string;
  blockType: "structured_rounds";
  status: StructuredRoundsLiveStatus;
  completedRounds: number;
  targetRounds: number;
  extraRoundState: StructuredExtraRoundState;
}

export type WorkoutCoachBlockLiveState =
  | WarmupCooldownTimedLiveState
  | AmrapTimedLiveState
  | StructuredRoundsLiveState;

export interface WorkoutCoachRestTimer {
  active: boolean;
  sourceBlockId: string;
  remainingSeconds: number;
  durationSeconds: number;
  autoStarted: boolean;
  endAtEpochMs?: number | null;
}

export type WorkoutCoachLiveWorkoutStatus = "preview" | "in_progress" | "completed";

export interface WorkoutCoachLiveSession {
  workoutId: string;
  workoutGeneratedAt: number;
  sessionStarted: boolean;
  workoutStatus: WorkoutCoachLiveWorkoutStatus;
  activeBlockIndex: number;
  /** Keyed by block id */
  blockStates: Record<string, WorkoutCoachBlockLiveState>;
  restTimer: WorkoutCoachRestTimer | null;
  /**
   * Wall-clock start when user taps Begin workout (hidden session timer for save / health pane).
   * Persisted so refresh keeps elapsed meaningful.
   */
  sessionStartEpochMs?: number | null;
}

export type WorkoutCoachVariant = "standard" | "short" | "low_energy" | "ladder";

export interface GeneratedWorkout {
  id: string;
  generatedAt: number;
  variant: WorkoutCoachVariant;
  blocks: WorkoutCoachBlock[];
  stretchGoal?: string;
}

export interface WorkoutCoachPostLog {
  roundsAmrap?: number | null;
  topSet?: boolean | null;
  notes?: string;
  garminCalories?: number | null;
  garminAvgHr?: number | null;
  garminDurationMin?: number | null;
  mood?: "good" | "flat" | "tired" | null;
  energy?: "high" | "ok" | "low" | null;
  /** Structured blocks where the user completed an optional extra round (saved review). */
  structuredExtraRoundCompletions?: { blockId: string; blockLabel: string }[];
}

/** Per-day state for the Workout Coach panel */
export interface WorkoutCoachDayState {
  workout?: GeneratedWorkout | null;
  /** Persisted live workout runner (timers, rounds, rest). */
  liveSession?: WorkoutCoachLiveSession | null;
  postLog?: WorkoutCoachPostLog | null;
  /** Inline toggles (no settings screen) */
  preferShort?: boolean;
  preferLowEnergy?: boolean;
  /** Decision engine — manual overrides for today */
  golfToday?: boolean;
  /** User confirms bootcamp done (e.g. off-app) */
  manualBootcampToday?: boolean;
  /** Swim activity (distinct from bootcamp, rides, strength) — counts toward training streak */
  swimToday?: boolean;
  /** Optional inputs for coach decisions */
  sleepQuality?: "good" | "ok" | "poor";
  /** Derived or manual: walking load */
  stepLevel?: "low" | "medium" | "high";
}

export interface ReminderLastNotified {
  [key: string]: number;
}

/** User-added lines merged into Workout Coach pools (Dashboard). */
export type WorkoutCoachExerciseCategory = "amrap" | "push" | "core";

export interface WorkoutCoachSavedExercise {
  id: string;
  category: WorkoutCoachExerciseCategory;
  name: string;
  /** Use {kb}, {squat}, {dbBench}, {dbPress}, {pullover} for auto weights when applicable */
  detail: string;
}

/** Profile shown in app; email may mirror auth. */
export interface UserProfile {
  displayName: string | null;
  email: string | null;
}

/**
 * User-defined medication list (product is not hardcoded to specific drugs).
 * Legacy `medicationTimes.dex` / `bupropion` remain until fully migrated in UI.
 */
export interface UserMedicationDefinition {
  id: string;
  name: string;
  /** Human-friendly dose label, e.g. "200mg" or "1 tablet". */
  dose?: string;
  /** Free-text cadence, e.g. "daily" or "twice daily". */
  frequency?: string;
  /** Whether schedule/timing detail should be shown and tracked explicitly. */
  timingImportant?: boolean;
  /** Optional remaining stock count. */
  stockRemaining?: number | null;
  /** Expected dose slots for the day as HH:mm. */
  scheduleSlots?: string[];

  /** Legacy fields kept for compatibility with older settings data. */
  scheduleTimes: string[];
  dosesPerDay: number;
  dosageNotes?: string;
  supplyCount?: number;
  active: boolean;
}

/** Scaffold for reminder prefs — can absorb legacy `remindersEnabled` over time. */
export interface ReminderPreferencesScaffold {
  globalEnabled: boolean;
  weekdayOnly: boolean;
}

/** Scaffold for future app prefs (theme, density, …). */
export interface AppPreferencesScaffold {
  theme?: "system" | "light" | "dark";
}

/** Tracks recent patterns so sessions vary without chaos (persisted in Settings). */
export interface WorkoutCoachRotation {
  /** Newest first; Block 1 pair ids e.g. `goblet_row` */
  recentBlock1PairIds: string[];
  recentBlock2PatternIds: string[];
  recentBlock3PatternIds: string[];
  /** Generations since Block 1 last used thrusters (limits thruster frequency). */
  gensSinceThruster: number;
  /** Strength sessions since last swing-ladder conditioning day (triggers ladder when ≥ 3). */
  generationsSinceLadder: number;
}

export interface Settings {
  /** Bump when adding migrations in `migrateSettings` */
  settingsVersion?: number;
  profile?: UserProfile;
  /** User-configured medications (empty = rely on legacy fields + UI). */
  userMedications?: UserMedicationDefinition[];
  reminderPreferences?: ReminderPreferencesScaffold;
  appPreferences?: AppPreferencesScaffold;
  remindersEnabled: boolean;
  weekdayOnly: boolean;
  waterGoalMl: number;
  waterIntervalMinutes: number;
  waterStartTime: string; // "HH:mm"
  waterEndTime: string;
  lunchReminderTime: string;
  medicationRemindersEnabled: boolean;
  medicationTimes: {
    dex: string[]; // e.g. ["07:00", "12:30", "15:30"]
    bupropion: string;
  };
  medicationSupply: {
    dex: number;
    bupropion: number;
  };
  medicationPillsPerDay: {
    dex: number;
    bupropion: number;
  };
  customMeds: CustomMed[];
  /** Extra coach exercises (optional); merged into generated pools by category */
  workoutCoachSavedExercises: WorkoutCoachSavedExercise[];
  /** Rotation memory for Workout Coach generator */
  workoutCoachRotation: WorkoutCoachRotation;
}

export interface CustomMed {
  id: string;
  name: string;
  time: string; // "HH:mm"
  pillsPerDay: number;
  supply: number;
}

export const DEFAULT_SETTINGS: Settings = {
  settingsVersion: 2,
  profile: { displayName: null, email: null },
  userMedications: [],
  reminderPreferences: { globalEnabled: true, weekdayOnly: true },
  appPreferences: {},
  remindersEnabled: true,
  weekdayOnly: true,
  waterGoalMl: 2000,
  waterIntervalMinutes: 120,
  waterStartTime: "09:30",
  waterEndTime: "18:30",
  lunchReminderTime: "12:30",
  medicationRemindersEnabled: true,
  medicationTimes: {
    dex: ["07:00", "12:30", "15:30"],
    bupropion: "07:30",
  },
  medicationSupply: {
    dex: 0,
    bupropion: 0,
  },
  medicationPillsPerDay: {
    dex: 3,
    bupropion: 1,
  },
  customMeds: [],
  workoutCoachSavedExercises: [],
  workoutCoachRotation: {
    recentBlock1PairIds: [],
    recentBlock2PatternIds: [],
    recentBlock3PatternIds: [],
    gensSinceThruster: 10,
    generationsSinceLadder: 0,
  },
};

export function createEmptyDayData(): DayData {
  return {
    medication: {
      dex: {
        doses: [
          { taken: false, takenAt: null },
          { taken: false, takenAt: null },
          { taken: false, takenAt: null },
        ],
      },
      bupropion: { taken: false, takenAt: null },
    },
    lunchEaten: false,
    lunchAt: null,
    lunchNote: "",
    lunchFoods: [],
    smoothieEaten: false,
    smoothieAt: null,
    smoothieNote: "",
    smoothieFoods: [],
    snackEaten: false,
    snackNote: "",
    snackFoods: [],
    waterMl: 0,
    waterLog: [],
    workoutMinutes: null,
    manualSwimMinutes: null,
    manualOtherActivity: null,
    coachWorkoutEntries: [],
    walkDone: false,
    stepsCount: null,
    weightKg: null,
    weightLoggedAt: null,
    bedtime: null,
    wakeTime: null,
    sentimentMorning: null,
    sentimentMidday: null,
    sentimentEvening: null,
    customMedsTaken: {},
    supplementsMedsLogEntries: [],
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
