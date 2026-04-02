"use client";

import { useState, useEffect, useRef } from "react";
import { useTodayData, useSettings } from "@/hooks/useTodayData";
import { LayoutHeader } from "@/components/LayoutHeader";
import { DateSelector } from "@/components/today/DateSelector";
import { MorningSection } from "@/components/today/MorningSection";
import { MovementSection } from "@/components/today/MovementSection";
import { WeightSection } from "@/components/today/WeightSection";
import { EveningSection } from "@/components/today/EveningSection";
import { SupplementsMedsModule } from "@/components/today/SupplementsMedsModule";
import { DailySummary } from "@/components/today/DailySummary";
import { ReminderBanners } from "@/components/reminders/ReminderBanners";
import { ReminderScheduler } from "@/components/reminders/ReminderScheduler";
import { SupplyBanner } from "@/components/reminders/SupplyBanner";
import { MigrationBanner } from "@/components/MigrationBanner";
import { StreakBanner } from "@/components/today/StreakBanner";
import type { ReminderType } from "@/components/reminders/ReminderContext";
import { getDateKey } from "@/types";
import type { DayData } from "@/types";
import { useSync } from "@/components/SyncContext";

type TodayModuleId = "weight" | "sleep" | "movement" | "supplements_meds" | "food";

const TODAY_MODULES_STORAGE_KEY = "today.modules.v1";
const DEFAULT_TODAY_MODULES: TodayModuleId[] = ["weight", "sleep"];
const ALL_TODAY_MODULES: { id: TodayModuleId; label: string }[] = [
  { id: "weight", label: "Weight" },
  { id: "sleep", label: "Sleep" },
  { id: "movement", label: "Movement" },
  { id: "supplements_meds", label: "Supplements & Meds" },
  { id: "food", label: "Food" },
];

function parseStoredTodayModules(raw: string | null): TodayModuleId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((v): v is TodayModuleId =>
      ALL_TODAY_MODULES.some((m) => m.id === v)
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export default function TodayPage() {
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const [isSyncing, setIsSyncing] = useState(false);
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [selectedModules, setSelectedModules] = useState<TodayModuleId[]>(DEFAULT_TODAY_MODULES);
  const { data, update, refresh } = useTodayData(selectedDateKey);
  const { settings, setSettings } = useSettings();
  const isToday = selectedDateKey === getDateKey();
  const pelotonAutoSyncDone = useRef<Set<string>>(new Set());
  const sync = useSync();
  const syncRef = useRef(sync);
  const fullSyncDone = useRef(false);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseStoredTodayModules(window.localStorage.getItem(TODAY_MODULES_STORAGE_KEY));
    setSelectedModules(parsed ?? DEFAULT_TODAY_MODULES);
    setModulesLoaded(true);
  }, []);

  useEffect(() => {
    if (!modulesLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(TODAY_MODULES_STORAGE_KEY, JSON.stringify(selectedModules));
  }, [modulesLoaded, selectedModules]);

  // Full sync once on first load
  useEffect(() => {
    if (!sync || fullSyncDone.current) return;
    fullSyncDone.current = true;
    sync.sync().then(() => refresh());
  }, [sync]);

  // Fast single-day sync on date navigation
  useEffect(() => {
    const s = syncRef.current;
    if (!s) return;
    setIsSyncing(true);
    s
      .syncDayNow(selectedDateKey)
      .then(() => refresh())
      .finally(() => setIsSyncing(false));
  }, [selectedDateKey, refresh]);

  useEffect(() => {
    if (!data) return;
    if (data.workoutMinutes != null) return;
    if ((data.workoutSessions ?? []).length > 0) return;
    if (pelotonAutoSyncDone.current.has(selectedDateKey)) return;
    pelotonAutoSyncDone.current.add(selectedDateKey);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/peloton/workout?date=${selectedDateKey}&timeZone=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.configured) return;
        if (json.workoutMinutes != null || (json.workoutSessions ?? []).length > 0) {
          update((prev) => ({
            ...prev,
            workoutMinutes: json.workoutMinutes ?? prev.workoutMinutes,
            workoutSessions: json.workoutSessions ?? prev.workoutSessions,
          }));
        }
      })
      .catch(() => {});
  }, [data, selectedDateKey, update]);

  const handleMarkAsTaken = (type: ReminderType, id: string) => {
    if (type === "lunch") {
      update((prev) => ({ ...prev, lunchEaten: true, lunchAt: Date.now() }));
      return;
    }
    if (type === "bupropion") {
      update((prev) => ({
        ...prev,
        medication: {
          ...prev.medication,
          bupropion: { taken: true, takenAt: Date.now() },
        },
      }));
      return;
    }
    const dexMatch = (type as string).match(/^dex-(\d+)$/);
    if (dexMatch) {
      const doseIndex = parseInt(dexMatch[1], 10);
      update((prev) => {
        const doses = [...(prev.medication.dex?.doses ?? [{ taken: false, takenAt: null }, { taken: false, takenAt: null }, { taken: false, takenAt: null }])];
        doses[doseIndex] = { taken: true, takenAt: Date.now() };
        return {
          ...prev,
          medication: {
            ...prev.medication,
            dex: { doses },
          },
        };
      });
      return;
    }
    if (type === "custom") {
      const medId = id.startsWith("custom-") ? id.slice(7) : id;
      update((prev) => ({
        ...prev,
        customMedsTaken: {
          ...(prev.customMedsTaken ?? {}),
          [medId]: { taken: true, takenAt: Date.now() },
        },
      }));
    }
  };

  const handleAddWater = () => {
    update((prev) => ({
      ...prev,
      waterMl: prev.waterMl + 250,
      waterLog: [...prev.waterLog, { amount: 250, timestamp: Date.now() }],
    }));
  };

  const addModule = (id: TodayModuleId) => {
    setSelectedModules((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeModule = (id: TodayModuleId) => {
    setSelectedModules((prev) => prev.filter((m) => m !== id));
  };

  const renderModule = (id: TodayModuleId, currentData: DayData) => {
    switch (id) {
      case "weight":
        return <WeightSection data={currentData} update={update} />;
      case "sleep":
        return (
          <>
            <MorningSection data={currentData} update={update} />
            <EveningSection data={currentData} update={update} />
          </>
        );
      case "movement":
        return <MovementSection data={currentData} update={update} dateKey={selectedDateKey} />;
      case "supplements_meds":
        return (
          <SupplementsMedsModule
            data={currentData}
            dateKey={selectedDateKey}
            settings={settings}
            setSettings={setSettings}
            update={update}
          />
        );
      case "food":
        return (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Food
            </h2>
            <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
              <p className="text-sm text-muted">Food module coming soon.</p>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  if (!data || isSyncing || !modulesLoaded) {
    return (
      <>
        <LayoutHeader title="Today" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-muted">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p>Syncing…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {isToday && <ReminderScheduler />}
      <LayoutHeader title="Today" />
      {isToday && (
        <ReminderBanners onMarkAsTaken={handleMarkAsTaken} onAddWater={handleAddWater} />
      )}
      <SupplyBanner settings={settings} />
      <MigrationBanner />
      <StreakBanner />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <DateSelector dateKey={selectedDateKey} onDateChange={setSelectedDateKey} />
        {selectedModules.map((moduleId) => {
          const moduleMeta = ALL_TODAY_MODULES.find((m) => m.id === moduleId);
          return (
            <div key={moduleId}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {moduleMeta?.label ?? "Module"}
                </p>
                <button
                  type="button"
                  onClick={() => removeModule(moduleId)}
                  className="text-xs font-medium text-muted hover:text-gray-800"
                >
                  Remove
                </button>
              </div>
              {renderModule(moduleId, data)}
            </div>
          );
        })}
        {selectedModules.length === 0 && (
          <section className="mb-10 rounded-2xl border border-dashed border-border bg-white p-4">
            <p className="text-sm text-muted">No modules selected yet.</p>
          </section>
        )}
        <section className="mb-10">
          <button
            type="button"
            onClick={() => setModulePickerOpen(true)}
            className="w-full min-h-[48px] rounded-2xl border border-border bg-white text-sm font-semibold text-gray-700 shadow-card hover:shadow-card-hover"
          >
            + Add module
          </button>
        </section>
        <DailySummary
          data={data}
          waterGoal={settings?.waterGoalMl ?? 2000}
          customMedIds={(settings?.customMeds ?? []).map((m) => m.id)}
        />
      </main>
      {modulePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-module-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl">
            <p id="add-module-title" className="font-semibold text-gray-900 mb-3">
              Add module
            </p>
            <div className="space-y-2">
              {ALL_TODAY_MODULES.map((moduleOption) => {
                const alreadyAdded = selectedModules.includes(moduleOption.id);
                return (
                  <button
                    key={moduleOption.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addModule(moduleOption.id)}
                    className={`w-full min-h-[44px] rounded-xl border px-3 text-sm font-medium text-left ${
                      alreadyAdded
                        ? "border-accent/30 bg-accent-soft/50 text-muted"
                        : "border-border bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {moduleOption.label}
                    {alreadyAdded ? " (Added)" : ""}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setModulePickerOpen(false)}
              className="mt-3 w-full min-h-[44px] rounded-xl text-sm font-medium border border-border text-gray-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}