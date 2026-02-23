"use client";

import { ReactNode } from "react";
import { ReminderProvider } from "@/components/reminders/ReminderContext";

export function Providers({ children }: { children: ReactNode }) {
  return <ReminderProvider>{children}</ReminderProvider>;
}
