"use client";

import { useReminders } from "./ReminderContext";
import type { ReminderType } from "./ReminderContext";
import { useState, useEffect } from "react";

const MAX_VISIBLE = 2;

interface ReminderBannersProps {
  onMarkAsTaken: (type: ReminderType, id: string) => void;
  onAddWater?: () => void;
}

export function ReminderBanners({ onMarkAsTaken, onAddWater }: ReminderBannersProps) {
  const { reminders, removeReminder, snoozeReminder } = useReminders();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const visible = reminders.filter((r) => !r.snoozedUntil || r.snoozedUntil <= now);
  const toShow = visible.slice(0, MAX_VISIBLE);
  const moreCount = visible.length - MAX_VISIBLE;

  if (toShow.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-2 space-y-2">
      {toShow.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-card"
        >
          <p className="font-medium text-amber-900">{r.title}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {(r.type === "dex1" || r.type === "dex2" || r.type === "dex3" || r.type === "bupropion" || r.type === "lunch") && (
              <button
                type="button"
                onClick={() => {
                  onMarkAsTaken(r.type, r.id);
                  removeReminder(r.id);
                }}
                className="px-3 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
              >
                Mark as taken
              </button>
            )}
            {r.type === "water" && (
              <>
                {onAddWater && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddWater();
                      removeReminder(r.id);
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
                  >
                    +250 ml
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeReminder(r.id)}
                  className="px-3 py-2 rounded-xl text-sm font-medium bg-white/80 text-gray-700 hover:bg-white border border-amber-200 min-h-[44px]"
                >
                  Dismiss
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => snoozeReminder(r.id, 30)}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white/80 text-gray-700 hover:bg-white border border-amber-200 min-h-[44px]"
            >
              Snooze 30 min
            </button>
            <button
              type="button"
              onClick={() => snoozeReminder(r.id, 60)}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white/80 text-gray-700 hover:bg-white border border-amber-200 min-h-[44px]"
            >
              Snooze 60 min
            </button>
          </div>
        </div>
      ))}
      {moreCount > 0 && (
        <p className="text-sm text-muted py-2">More reminders ({moreCount})</p>
      )}
    </div>
  );
}
