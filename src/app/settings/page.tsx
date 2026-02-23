"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/hooks/useTodayData";
import { LayoutHeader } from "@/components/LayoutHeader";
import type { Settings } from "@/types";
import {
  resetToday,
  getAllDayKeys,
  getDayData,
  getSettings as getSettingsFromDb,
  setDayData,
  setSettings as saveSettingsToDb,
} from "@/db";
import { useAuth } from "@/components/AuthProvider";
import { useSync } from "@/components/SyncContext";

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const { user } = useAuth();
  const syncCtx = useSync();
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pelotonUsername, setPelotonUsername] = useState("");
  const [pelotonPassword, setPelotonPassword] = useState("");
  const [pelotonConn, setPelotonConn] = useState<{
    configured: boolean;
    connected: boolean;
    usernameHint: string | null;
    lastTestedAt: string | null;
    lastTestStatus: string | null;
    lastTestError: string | null;
  } | null>(null);
  const [pelotonSaving, setPelotonSaving] = useState(false);
  const [pelotonTesting, setPelotonTesting] = useState(false);
  const [pelotonMessage, setPelotonMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const loadPelotonConnection = useCallback(async () => {
    if (!user) {
      setPelotonConn({ configured: false, connected: false, usernameHint: null, lastTestedAt: null, lastTestStatus: null, lastTestError: null });
      return;
    }
    try {
      const res = await fetch("/api/peloton/connection");
      const json = await res.json();
      setPelotonConn({
        configured: json.configured ?? false,
        connected: json.connected ?? false,
        usernameHint: json.usernameHint ?? null,
        lastTestedAt: json.lastTestedAt ?? null,
        lastTestStatus: json.lastTestStatus ?? null,
        lastTestError: json.lastTestError ?? null,
      });
    } catch {
      setPelotonConn({ configured: false, connected: false, usernameHint: null, lastTestedAt: null, lastTestStatus: null, lastTestError: null });
    }
  }, [user]);

  useEffect(() => {
    loadPelotonConnection();
  }, [loadPelotonConnection]);

  const handlePelotonSave = async () => {
    if (!pelotonUsername.trim() || !pelotonPassword) {
      setPelotonMessage("Enter username and password");
      return;
    }
    setPelotonSaving(true);
    try {
      const res = await fetch("/api/peloton/connection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: pelotonUsername.trim(), password: pelotonPassword }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPelotonPassword("");
        await loadPelotonConnection();
        setPelotonMessage(json.status === "success" ? "Connected" : json.error ?? "Saved");
      } else {
        setPelotonMessage(json.error ?? "Failed");
      }
    } catch {
      setPelotonMessage("Failed");
    } finally {
      setPelotonSaving(false);
    }
  };

  const handlePelotonTest = async () => {
    setPelotonTesting(true);
    setPelotonMessage(null);
    try {
      const res = await fetch("/api/peloton/connection", { method: "POST" });
      const json = await res.json();
      if (json.success || json.status === "success") {
        setPelotonMessage("Connection successful");
        await loadPelotonConnection();
      } else {
        setPelotonMessage(json.error ?? "Connection failed");
      }
    } catch {
      setPelotonMessage("Connection failed");
    } finally {
      setPelotonTesting(false);
    }
  };

  const handlePelotonDisconnect = async () => {
    if (!confirm("Remove saved Peloton credentials?")) return;
    try {
      const res = await fetch("/api/peloton/connection", { method: "DELETE" });
      if (res.ok) {
        setPelotonUsername("");
        setPelotonPassword("");
        await loadPelotonConnection();
      }
    } catch {}
  };

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

  const handleSyncNow = async () => {
    if (!syncCtx) return;
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncCtx.sync();
    await syncCtx.refreshLastSync();
    setSyncing(false);
    if (result.success) {
      setSyncMessage(`Synced: ${result.pushed} pushed, ${result.pulled} pulled`);
    } else {
      setSyncMessage(result.error ?? "Sync failed");
    }
    setTimeout(() => setSyncMessage(null), 4000);
  };

  const handleExport = async () => {
    const keys = await getAllDayKeys();
    const days: Record<string, unknown> = {};
    for (const k of keys) {
      days[k] = await getDayData(k);
    }
    const s = await getSettingsFromDb();
    const blob = new Blob(
      [JSON.stringify({ days, settings: s, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!confirm("Import will merge/replace data. Continue?")) return;
      try {
        const text = await file.text();
        const { days, settings: importedSettings } = JSON.parse(text) as {
          days?: Record<string, unknown>;
          settings?: Settings;
        };
        if (days) {
          for (const [k, v] of Object.entries(days)) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === "object") {
              await setDayData(k, v as Parameters<typeof setDayData>[1]);
            }
          }
        }
        if (importedSettings) {
          await saveSettingsToDb(importedSettings);
          setSettings(importedSettings);
        }
        setSaved(true);
      } catch (err) {
        alert("Import failed: " + (err instanceof Error ? err.message : "Invalid file"));
      }
    };
    input.click();
  };

  const lastSyncStr =
    syncCtx?.lastSync != null
      ? new Date(syncCtx.lastSync).toLocaleString()
      : "Never";

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
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800 mb-2">Dexamphetamine (3 doses)</p>
                <div className="flex gap-2">
                  {(Array.isArray(settings.medicationTimes.dex) ? settings.medicationTimes.dex : ["07:00", "12:30", "15:30"]).map((t, i) => (
                    <label key={i} className="flex-1">
                      <span className="sr-only">Dose {i + 1}</span>
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => {
                          const next = [...(Array.isArray(settings.medicationTimes.dex) ? settings.medicationTimes.dex : ["07:00", "12:30", "15:30"])];
                          next[i] = e.target.value;
                          update({
                            medicationTimes: {
                              ...settings.medicationTimes,
                              dex: next,
                            },
                          });
                        }}
                        className="block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="font-medium text-gray-800">Bupropion</span>
                <input
                  type="time"
                  value={settings.medicationTimes.bupropion}
                  onChange={(e) =>
                    update({
                      medicationTimes: {
                        ...settings.medicationTimes,
                        bupropion: e.target.value,
                      },
                    })
                  }
                  className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                />
              </label>
            </div>
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
                ["dex", "Dexamphetamine (3x daily)", 3],
                ["bupropion", "Bupropion", 1],
              ] as const
            ).map(([key, label, defaultPerDay]) => (
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
                            ...(settings.medicationSupply ?? { dex: 0, bupropion: 0 }),
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
                      value={settings.medicationPillsPerDay?.[key] ?? defaultPerDay}
                      onChange={(e) =>
                        update({
                          medicationPillsPerDay: {
                            ...(settings.medicationPillsPerDay ?? { dex: 3, bupropion: 1 }),
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

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Additional medication & supplements
          </h2>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <p className="text-sm text-muted mb-3">
              Add custom medications or supplements with your own dosing.
            </p>
            {(settings.customMeds ?? []).map((med) => (
              <div
                key={med.id}
                className="mb-4 p-3 rounded-xl border border-border bg-surface/50"
              >
                <div className="flex justify-between items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={med.name}
                    onChange={(e) =>
                      update({
                        customMeds: (settings.customMeds ?? []).map((m) =>
                          m.id === med.id ? { ...m, name: e.target.value } : m
                        ),
                      })
                    }
                    placeholder="Name"
                    className="flex-1 font-medium text-gray-800 bg-transparent border-0 border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-0 py-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        customMeds: (settings.customMeds ?? []).filter((m) => m.id !== med.id),
                      })
                    }
                    className="text-sm text-muted hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex-1 min-w-[80px]">
                    <span className="sr-only">Time</span>
                    <input
                      type="time"
                      value={med.time}
                      onChange={(e) =>
                        update({
                          customMeds: (settings.customMeds ?? []).map((m) =>
                            m.id === med.id ? { ...m, time: e.target.value } : m
                          ),
                        })
                      }
                      className="block w-full rounded-xl border border-border px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="w-20">
                    <span className="sr-only">Per day</span>
                    <select
                      value={med.pillsPerDay}
                      onChange={(e) =>
                        update({
                          customMeds: (settings.customMeds ?? []).map((m) =>
                            m.id === med.id ? { ...m, pillsPerDay: parseInt(e.target.value, 10) } : m
                          ),
                        })
                      }
                      className="block w-full rounded-xl border border-border px-2 py-1.5 text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}/day
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-20">
                    <span className="sr-only">Supply</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      placeholder="Held"
                      value={med.supply}
                      onChange={(e) =>
                        update({
                          customMeds: (settings.customMeds ?? []).map((m) =>
                            m.id === med.id ? { ...m, supply: Math.max(0, parseInt(e.target.value, 10) || 0) } : m
                          ),
                        })
                      }
                      className="block w-full rounded-xl border border-border px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const id = crypto.randomUUID();
                update({
                  customMeds: [
                    ...(settings.customMeds ?? []),
                    { id, name: "New medication", time: "08:00", pillsPerDay: 1, supply: 0 },
                  ],
                });
              }}
              className="mt-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent-soft text-accent hover:bg-accent-soft/80 border border-accent/30"
            >
              + Add medication or supplement
            </button>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Peloton
          </h2>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <p className="text-sm text-muted mb-3">
              Connect your Peloton account to auto-populate workout minutes on the Today page. Workouts sync when the day is empty, or use &quot;Sync from Peloton&quot; in Movement.
            </p>
            {!user ? (
              <p className="text-sm text-muted">Sign in to connect Peloton.</p>
            ) : (
              <>
                {pelotonConn?.configured && pelotonConn.connected && (
                  <p className="text-sm text-accent mb-3">
                    Connected as {pelotonConn.usernameHint}
                    {pelotonConn.lastTestStatus === "success" && pelotonConn.lastTestedAt && (
                      <span className="text-muted"> · Tested {new Date(pelotonConn.lastTestedAt).toLocaleString()}</span>
                    )}
                  </p>
                )}
                {pelotonConn?.lastTestStatus === "failure" && pelotonConn.lastTestError && (
                  <p className="text-sm text-amber-600 mb-2">{pelotonConn.lastTestError}</p>
                )}
                <div className="space-y-3">
                  <label className="block">
                    <span className="font-medium text-gray-800">Email or username</span>
                    <input
                      type="text"
                      value={pelotonUsername}
                      onChange={(e) => setPelotonUsername(e.target.value)}
                      placeholder={pelotonConn?.usernameHint ?? "your@email.com"}
                      className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-gray-800">Password</span>
                    <input
                      type="password"
                      value={pelotonPassword}
                      onChange={(e) => setPelotonPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handlePelotonSave}
                    disabled={pelotonSaving || !pelotonUsername.trim() || !pelotonPassword}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    {pelotonSaving ? "Saving…" : "Save & connect"}
                  </button>
                  {pelotonConn?.configured && (
                    <>
                      <button
                        type="button"
                        onClick={handlePelotonTest}
                        disabled={pelotonTesting}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border disabled:opacity-50"
                      >
                        {pelotonTesting ? "Testing…" : "Test connection"}
                      </button>
                      <button
                        type="button"
                        onClick={handlePelotonDisconnect}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
                {pelotonMessage && (
                  <p className={`mt-2 text-sm ${pelotonMessage.includes("success") || pelotonMessage === "Connected" ? "text-accent" : "text-amber-600"}`}>
                    {pelotonMessage}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Sync
          </h2>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <p className="text-sm text-muted mb-3">
              {user
                ? "Sync your data across devices when signed in."
                : "Sign in to sync across devices."}
            </p>
            {user && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  <span className="text-sm text-muted">
                    Last sync: {lastSyncStr}
                  </span>
                </div>
                {syncMessage && (
                  <p className={`text-sm ${syncMessage.startsWith("Synced") ? "text-accent" : "text-amber-600"}`}>
                    {syncMessage}
                  </p>
                )}
              </>
            )}
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
              >
                Import JSON
              </button>
            </div>
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
