import type { AppModuleId } from "@/types";

export type ModuleDefinition = {
  id: AppModuleId;
  label: string;
  shortDescription: string;
  /** Primary route when module is enabled */
  href?: string;
};

/** Lightweight registry — extend with feature flags / entitlements in later phases. */
export const MODULE_REGISTRY: Record<AppModuleId, ModuleDefinition> = {
  health_tracker: {
    id: "health_tracker",
    label: "Health tracker",
    shortDescription: "Daily ticks, food, water, movement, mood",
    href: "/today",
  },
  workout_coach: {
    id: "workout_coach",
    label: "Workout Coach",
    shortDescription: "Guided sessions and live timers",
    href: "/coach",
  },
  medication: {
    id: "medication",
    label: "Medication",
    shortDescription: "Reminders and logging (configured in Settings)",
    href: "/today",
  },
};

export function defaultEnabledModules(): AppModuleId[] {
  return ["health_tracker", "workout_coach", "medication"];
}
