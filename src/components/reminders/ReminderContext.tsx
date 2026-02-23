"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";

export type ReminderType =
  | "dex-0"
  | "dex-1"
  | "dex-2"
  | "bupropion"
  | "lunch"
  | "water"
  | "supply"
  | "custom";

export interface ActiveReminder {
  id: string;
  type: ReminderType;
  title: string;
  snoozedUntil?: number;
}

interface ReminderContextValue {
  reminders: ActiveReminder[];
  addReminder: (r: ActiveReminder) => void;
  removeReminder: (id: string) => void;
  snoozeReminder: (id: string, minutes: number) => void;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [reminders, setReminders] = useState<ActiveReminder[]>([]);

  const addReminder = useCallback((r: ActiveReminder) => {
    setReminders((prev) => {
      if (prev.some((x) => x.id === r.id)) return prev;
      return [...prev, r];
    });
  }, []);

  const removeReminder = useCallback((id: string) => {
    setReminders((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const snoozeReminder = useCallback((id: string, minutes: number) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, snoozedUntil: Date.now() + minutes * 60 * 1000 }
          : r
      )
    );
  }, []);

  return (
    <ReminderContext.Provider
      value={{
        reminders,
        addReminder,
        removeReminder,
        snoozeReminder,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminders must be used within ReminderProvider");
  return ctx;
}
