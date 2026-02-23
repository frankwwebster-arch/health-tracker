"use client";

import { useState } from "react";
import type { DayData, Settings, MedicationKey } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const LABELS: Record<MedicationKey, string> = {
  dex1: "Dex #1",
  dex2: "Dex #2",
  dex3: "Dex #3",
  bupropion: "Bupropion",
};

const ORDER: MedicationKey[] = ["dex1", "bupropion", "dex2", "dex3"];

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function timestampToTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function timeInputToTimestamp(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  settings: Settings | null;
  update: (fn: UpdateFn) => void;
}

export function MedicationSection({ data, settings, update }: Props) {
  const times = settings?.medicationTimes ?? DEFAULT_SETTINGS.medicationTimes;
  const [editingKey, setEditingKey] = useState<MedicationKey | null>(null);

  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
        Medication
      </h2>
      <ul className="space-y-3">
        {ORDER.map((key) => {
          const entry = data.medication[key];
          const scheduledTime = times[key];
          const isEditing = editingKey === key;
          const status = entry.taken
            ? `Taken at ${entry.takenAt ? formatTime(entry.takenAt) : "—"}`
            : "Not yet";

          return (
            <li
              key={key}
              className={`flex flex-wrap items-center gap-2 rounded-2xl border p-4 shadow-card transition-shadow hover:shadow-card-hover ${
                entry.taken ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">
                  {LABELS[key]} ({scheduledTime})
                </p>
                {entry.taken && isEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="time"
                      defaultValue={
                        entry.takenAt
                          ? timestampToTimeInput(entry.takenAt)
                          : timestampToTimeInput(Date.now())
                      }
                      onChange={(e) => {
                        const ts = timeInputToTimestamp(e.target.value);
                        update((prev) => ({
                          ...prev,
                          medication: {
                            ...prev.medication,
                            [key]: { taken: true, takenAt: ts },
                          },
                        }));
                      }}
                      onBlur={() => setEditingKey(null)}
                      className="rounded-xl border border-border px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="text-sm text-muted hover:text-gray-800"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {status}
                    {entry.taken && (
                      <button
                        type="button"
                        onClick={() => setEditingKey(key)}
                        className="ml-2 text-accent hover:underline"
                      >
                        Edit time
                      </button>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {entry.taken ? (
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        medication: {
                          ...prev.medication,
                          [key]: { taken: false, takenAt: null },
                        },
                      }))
                    }
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        medication: {
                          ...prev.medication,
                          [key]: { taken: true, takenAt: Date.now() },
                        },
                      }))
                    }
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
                  >
                    Mark as taken
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
