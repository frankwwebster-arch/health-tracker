"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useTodayData";
import { LayoutHeader } from "@/components/LayoutHeader";
import type { Settings } from "@/types";
import { resetToday } from "@/db";

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  if (!settings) {
    return (
      <>
        <LayoutHeader title="Settings" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <p className="text-muted">Loading…</p>
        </main>
      </>
    );
  }

  const update = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    setSaved(true);
  };

  const testNotification = async () => {
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "denied") {
        alert("Notifications are blocked. Enable them in your browser settings.");
        return;
      }
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      }
      new Notification("Health Tracker", { body: "This is a test notification." });
    } else {
      alert("Notifications are not supported in this browser.");
    }
  };

  const handleResetToday = async () => {
    if (confirm("Clear all of today’s ticks? This cannot be undone.")) {
      await resetToday();
      setSaved(true);
    }
  };

  return (
    <>
      <LayoutHeader title="Settings" />
      <main className="max-w-lg mx-auto px-4 pb-24">
        {saved && (
          <p className="text-sm text-accent py-2">Settings saved.</p>
        )}

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Reminders
          </h2>
          <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-card">
            <label className="flex items-center justify-between gap-4 min-h-[44px]">
              <span className="font-medium text-gray-800">Enable reminders</span>
              <input
                type="checkbox"
                checked={settings.remindersEnabled}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  update({ remindersEnabled: enabled });
                  if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
                    await Notification.requestPermission();
                  }
                }}
                className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent/30"
              />
            </label>
            <label className="flex items-center justify-between gap-4 min-h-[44px]">
              <span className="font-medium text-gray-800">Weekdays only</span>
              <input
                type="checkbox"
                checked={settings.weekdayOnly}
                onChange={(e) => update({ weekdayOnly: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent/30"
              />
            </label>
            <div className="pt-2">
              <button
                type="button"
                onClick={testNotification}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
              >
                Test notification
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
            Water
          </h2>
          <div className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
            <label className="block">
              <span className="font-medium text-gray-800">Daily goal (ml)</span>
              <input
                type="number"
                min={500}
                max={5000}
                step={250}
                value={settings.waterGoalMl}
                onChange={(e) =>
                  update({ waterGoalMl: parseInt(e.target.value, 10) || 2000 })
                }
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
            <label className="block">
              <span className="font-medium text-gray-800">Reminder interval (minutes)</span>
              <select
                value={settings.waterIntervalMinutes}
                onChange={(e) =>
                  update({
                    waterIntervalMinutes: parseInt(e.target.value, 10),
                  })
                }
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              >
                <option value={90}>90</option>
                <option value={120}>120</option>
                <option value={150}>150</option>
              </select>
            </label>
            <label className="block">
              <span className="font-medium text-gray-800">Start time</span>
              <input
                type="time"
                value={settings.waterStartTime}
                onChange={(e) => update({ waterStartTime: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
            <label className="block">
              <span className="font-medium text-gray-800">End time</span>
              <input
                type="time"
                value={settings.waterEndTime}
                onChange={(e) => update({ waterEndTime: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
            Lunch reminder
          </h2>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <label className="block">
              <span className="font-medium text-gray-800">Time</span>
              <input
                type="time"
                value={settings.lunchReminderTime}
                onChange={(e) => update({ lunchReminderTime: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </label>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Medication reminders
          </h2>
          <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-card">
            <label className="flex items-center justify-between gap-4 min-h-[44px]">
              <span className="font-medium text-gray-800">Enable medication reminders</span>
              <input
                type="checkbox"
                checked={settings.medicationRemindersEnabled}
                onChange={(e) =>
                  update({ medicationRemindersEnabled: e.target.checked })
                }
                className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent/30"
              />
            </label>
            {(
              [
                ["dex1", "Dex #1"],
                ["dex2", "Dex #2"],
                ["dex3", "Dex #3"],
                ["bupropion", "Bupropion"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="font-medium text-gray-800">{label}</span>
                <input
                  type="time"
                  value={settings.medicationTimes[key]}
                  onChange={(e) =>
                    update({
                      medicationTimes: {
                        ...settings.medicationTimes,
                        [key]: e.target.value,
                      },
                    })
                  }
                  className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Medication supply
          </h2>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <p className="text-sm text-muted mb-3">
              Pills held and doses per day. You’ll get a reminder when supply is 7 days or less.
            </p>
            {(
              [
                ["dex1", "Dex #1"],
                ["dex2", "Dex #2"],
                ["dex3", "Dex #3"],
                ["bupropion", "Bupropion"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="mb-4 last:mb-0">
                <span className="font-medium text-gray-800 block mb-1">{label}</span>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="sr-only">Pills held</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      placeholder="Held"
                      value={settings.medicationSupply?.[key] ?? 0}
                      onChange={(e) =>
                        update({
                          medicationSupply: {
                            ...(settings.medicationSupply ?? {
                              dex1: 0,
                              dex2: 0,
                              dex3: 0,
                              bupropion: 0,
                            }),
                            [key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                          },
                        })
                      }
                      className="block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                    />
                  </label>
                  <label className="w-28">
                    <span className="sr-only">Per day</span>
                    <select
                      value={settings.medicationPillsPerDay?.[key] ?? 1}
                      onChange={(e) =>
                        update({
                          medicationPillsPerDay: {
                            ...(settings.medicationPillsPerDay ?? {
                              dex1: 1,
                              dex2: 1,
                              dex3: 1,
                              bupropion: 1,
                            }),
                            [key]: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      className="block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} per day
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
            Data
          </h2>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={handleResetToday}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 min-h-[44px]"
            >
              Reset today
            </button>
            <p className="text-sm text-muted mt-2">
              Clears today’s ticks only. Settings are kept.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
