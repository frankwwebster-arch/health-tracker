"use client";

import { useState } from "react";
import type { DayData, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

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
  const dexTimes = Array.isArray(times.dex) ? times.dex : ["07:00", "12:30", "15:30"];
  const customMeds = settings?.customMeds ?? [];
  const [editingDose, setEditingDose] = useState<number | string | null>(null);

  const dexDoses = data.medication.dex?.doses ?? [
    { taken: false, takenAt: null },
    { taken: false, takenAt: null },
    { taken: false, takenAt: null },
  ];

  const allDexTaken = dexDoses.every((d) => d.taken);

  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
        Medication
      </h2>
      <ul className="space-y-3">
        <li
          className={`rounded-2xl border p-4 shadow-card transition-shadow hover:shadow-card-hover ${
            allDexTaken ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
          }`}
        >
          <p className="font-medium text-gray-800 mb-3">Dex (3x daily)</p>
          <div className="space-y-2">
            {dexDoses.map((entry, i) => {
              const scheduledTime = dexTimes[i] ?? "—";
              const isEditing = editingDose === i;
              const status = entry.taken
                ? `Taken at ${entry.takenAt ? formatTime(entry.takenAt) : "—"}`
                : "Not yet";

              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border last:border-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted">
                      Dose {i + 1} ({scheduledTime})
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
                            update((prev) => {
                              const doses = [...(prev.medication.dex?.doses ?? dexDoses)];
                              doses[i] = { taken: true, takenAt: ts };
                              return {
                                ...prev,
                                medication: {
                                  ...prev.medication,
                                  dex: { doses },
                                },
                              };
                            });
                          }}
                          onBlur={() => setEditingDose(null)}
                          className="rounded-xl border border-border px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingDose(null)}
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
                            onClick={() => setEditingDose(i)}
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
                          update((prev) => {
                            const doses = [...(prev.medication.dex?.doses ?? dexDoses)];
                            doses[i] = { taken: false, takenAt: null };
                            return {
                              ...prev,
                              medication: {
                                ...prev.medication,
                                dex: { doses },
                              },
                            };
                          })
                        }
                        className="px-3 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 shadow-sm"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          update((prev) => {
                            const doses = [...(prev.medication.dex?.doses ?? dexDoses)];
                            doses[i] = { taken: true, takenAt: Date.now() };
                            return {
                              ...prev,
                              medication: {
                                ...prev.medication,
                                dex: { doses },
                              },
                            };
                          })
                        }
                        className="px-3 py-2 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
                      >
                        Mark taken
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </li>

        <li
          className={`flex flex-wrap items-center gap-2 rounded-2xl border p-4 shadow-card transition-shadow hover:shadow-card-hover ${
            data.medication.bupropion.taken ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800">
              Bupropion ({times.bupropion})
            </p>
            <p className="text-sm text-muted">
              {data.medication.bupropion.taken
                ? `Taken at ${data.medication.bupropion.takenAt ? formatTime(data.medication.bupropion.takenAt) : "—"}`
                : "Not yet"}
            </p>
          </div>
          {data.medication.bupropion.taken ? (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({
                  ...prev,
                  medication: {
                    ...prev.medication,
                    bupropion: { taken: false, takenAt: null },
                  },
                }))
              }
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
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
                    bupropion: { taken: true, takenAt: Date.now() },
                  },
                }))
              }
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
            >
              Mark as taken
            </button>
          )}
        </li>

        {customMeds.map((med) => {
          const entry = data.customMedsTaken?.[med.id] ?? { taken: false, takenAt: null };
          const isEditing = editingDose === med.id;
          const status = entry.taken
            ? `Taken at ${entry.takenAt ? formatTime(entry.takenAt) : "—"}`
            : "Not yet";

          return (
            <li
              key={med.id}
              className={`flex flex-wrap items-center gap-2 rounded-2xl border p-4 shadow-card transition-shadow hover:shadow-card-hover ${
                entry.taken ? "border-accent/20 bg-accent-soft/50" : "border-border bg-white"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">
                  {med.name} ({med.time})
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
                          customMedsTaken: {
                            ...(prev.customMedsTaken ?? {}),
                            [med.id]: { taken: true, takenAt: ts },
                          },
                        }));
                      }}
                      onBlur={() => setEditingDose(null)}
                      className="rounded-xl border border-border px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingDose(null)}
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
                        onClick={() => setEditingDose(med.id)}
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
                        customMedsTaken: {
                          ...(prev.customMedsTaken ?? {}),
                          [med.id]: { taken: false, takenAt: null },
                        },
                      }))
                    }
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 min-h-[44px] shadow-sm"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        customMedsTaken: {
                          ...(prev.customMedsTaken ?? {}),
                          [med.id]: { taken: true, takenAt: Date.now() },
                        },
                      }))
                    }
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
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
