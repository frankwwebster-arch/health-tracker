"use client";

import { ReactNode } from "react";
import { ReminderProvider } from "@/components/reminders/ReminderContext";
import { AuthProvider } from "@/components/AuthProvider";
import { SyncProvider } from "@/components/SyncContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SyncProvider>
        <ReminderProvider>{children}</ReminderProvider>
      </SyncProvider>
    </AuthProvider>
  );
}
