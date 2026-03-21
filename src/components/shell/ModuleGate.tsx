"use client";

import type { ReactNode } from "react";
import type { AppModuleId } from "@/types";
import { useSettings } from "@/hooks/useTodayData";
import { defaultEnabledModules } from "@/lib/modules/registry";

/** Renders children only when the given module is enabled for the current user. */
export function ModuleGate({
  moduleId,
  children,
}: {
  moduleId: AppModuleId;
  children: ReactNode;
}) {
  const { settings } = useSettings();
  const enabled = settings?.enabledModules ?? defaultEnabledModules();
  if (!enabled.includes(moduleId)) return null;
  return <>{children}</>;
}
