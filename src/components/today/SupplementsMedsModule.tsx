"use client";

import { useMemo, useState } from "react";
import type { DayData, Settings, UserMedicationDefinition } from "@/types";

type UpdateFn = (prev: DayData) => DayData;

type Props = {
  data: DayData;
  dateKey: string;
  settings: Settings | null;
  setSettings: (s: Settings) => Promise<void>;
  update: (fn: UpdateFn) => void;
};

type ConfirmState = {
  itemId: string;
  slotId: string | null;
  timeValue: string;
};

type EditState = {
  id: string | null;
  name: string;
  dose: string;
  frequency: string;
  timingImportant: boolean;
  stockRemaining: string;
  slotsText: string;
};

function formatHmFromMs(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toMsForDateKeyTime(dateKey: string, hhmm: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.getTime();
}

function toTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseSlots(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => /^\d{2}:\d{2}$/.test(x));
  return Array.from(new Set(parts)).sort();
}

function normalizeSuppMedsItems(settings: Settings | null): UserMedicationDefinition[] {
  const list = settings?.userMedications ?? [];
  return list.map((item) => {
    const slots = item.scheduleSlots ?? item.scheduleTimes ?? [];
    const normalizedSlots = slots.filter((x) => /^\d{2}:\d{2}$/.test(x));
    const timingImportant =
      item.timingImportant ?? normalizedSlots.length > 1;
    return {
      ...item,
      dose: item.dose ?? item.dosageNotes ?? "",
      stockRemaining: item.stockRemaining ?? item.supplyCount ?? null,
      scheduleSlots: normalizedSlots,
      scheduleTimes: normalizedSlots,
      dosesPerDay: Math.max(1, normalizedSlots.length || item.dosesPerDay || 1),
      timingImportant,
      active: item.active ?? true,
    };
  });
}

export function SupplementsMedsModule({
  data,
  dateKey,
  settings,
  setSettings,
  update,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const items = useMemo(() => normalizeSuppMedsItems(settings), [settings]);
  const activeItems = useMemo(() => items.filter((x) => x.active), [items]);
  const logs = data.supplementsMedsLogEntries ?? [];

  const findLatestLog = (itemId: string, slotId: string | null) => {
    const filtered = logs
      .filter((x) => x.itemId === itemId && x.slotId === slotId)
      .sort((a, b) => b.takenAt - a.takenAt);
    return filtered[0] ?? null;
  };

  const openConfirm = (itemId: string, slotId: string | null, existingTakenAt?: number | null) => {
    setConfirmState({
      itemId,
      slotId,
      timeValue: existingTakenAt ? toTimeInput(existingTakenAt) : toTimeInput(Date.now()),
    });
  };

  const saveConfirm = () => {
    if (!confirmState) return;
    const takenAt = toMsForDateKeyTime(dateKey, confirmState.timeValue);
    update((prev) => {
      const next = [
        ...(prev.supplementsMedsLogEntries ?? []),
      ].filter(
        (x) => !(x.itemId === confirmState.itemId && x.slotId === confirmState.slotId)
      );
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        itemId: confirmState.itemId,
        slotId: confirmState.slotId,
        takenAt,
      });
      return { ...prev, supplementsMedsLogEntries: next };
    });
    setConfirmState(null);
  };

  const openEdit = (item?: UserMedicationDefinition) => {
    if (!item) {
      setEditState({
        id: null,
        name: "",
        dose: "",
        frequency: "daily",
        timingImportant: false,
        stockRemaining: "",
        slotsText: "09:00",
      });
      return;
    }
    const slots = (item.scheduleSlots ?? item.scheduleTimes ?? []).join(", ");
    setEditState({
      id: item.id,
      name: item.name,
      dose: item.dose ?? item.dosageNotes ?? "",
      frequency: item.frequency ?? "daily",
      timingImportant: item.timingImportant ?? false,
      stockRemaining:
        item.stockRemaining != null
          ? String(item.stockRemaining)
          : item.supplyCount != null
            ? String(item.supplyCount)
            : "",
      slotsText: slots || "09:00",
    });
  };

  const saveItem = async () => {
    if (!editState || !settings) return;
    const trimmedName = editState.name.trim();
    if (!trimmedName) return;
    const scheduleSlots = parseSlots(editState.slotsText);
    const normalizedSlots = editState.timingImportant
      ? scheduleSlots.length > 0
        ? scheduleSlots
        : ["09:00"]
      : [];
    const stockVal =
      editState.stockRemaining.trim() === ""
        ? null
        : Math.max(0, parseInt(editState.stockRemaining, 10) || 0);

    const nextItem: UserMedicationDefinition = {
      id: editState.id ?? crypto.randomUUID(),
      name: trimmedName,
      dose: editState.dose.trim() || undefined,
      dosageNotes: editState.dose.trim() || undefined,
      frequency: editState.frequency.trim() || "daily",
      timingImportant: editState.timingImportant,
      stockRemaining: stockVal,
      supplyCount: stockVal ?? undefined,
      scheduleSlots: normalizedSlots,
      scheduleTimes: normalizedSlots,
      dosesPerDay: Math.max(1, normalizedSlots.length || 1),
      active: true,
    };

    const current = settings.userMedications ?? [];
    const nextList = editState.id
      ? current.map((x) => (x.id === editState.id ? nextItem : x))
      : [...current, nextItem];

    await setSettings({ ...settings, userMedications: nextList });
    setEditState(null);
  };

  const removeItem = async (id: string) => {
    if (!settings) return;
    const next = (settings.userMedications ?? []).filter((x) => x.id !== id);
    await setSettings({ ...settings, userMedications: next });
  };

  return (
    <section className="mb-10">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-medium text-gray-800">Supplements &amp; Meds</p>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Manage
          </button>
        </div>

        {activeItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-3">
            <p className="text-sm text-muted">No items yet.</p>
            <button
              type="button"
              onClick={() => {
                setManageOpen(true);
                openEdit();
              }}
              className="mt-2 text-sm font-medium text-accent hover:underline"
            >
              + Add first item
            </button>
          </div>
        )}

        {activeItems.length > 0 && (
          <ul className="space-y-3">
            {activeItems.map((item) => {
              const slots = item.timingImportant
                ? item.scheduleSlots && item.scheduleSlots.length > 0
                  ? item.scheduleSlots
                  : ["09:00"]
                : [];
              const simpleLog = !item.timingImportant
                ? findLatestLog(item.id, null)
                : null;
              return (
                <li key={item.id} className="rounded-xl border border-border/80 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-muted">
                        {[item.dose, item.frequency].filter(Boolean).join(" · ") || "No dose details"}
                      </p>
                    </div>
                    {!item.timingImportant && (
                      <button
                        type="button"
                        onClick={() => openConfirm(item.id, null, simpleLog?.takenAt ?? null)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {simpleLog ? "Edit log" : "Log"}
                      </button>
                    )}
                  </div>

                  {!item.timingImportant && (
                    <p className="mt-2 text-sm text-muted">
                      {simpleLog ? `Taken at ${formatHmFromMs(simpleLog.takenAt)}` : "Not taken"}
                    </p>
                  )}

                  {item.timingImportant && (
                    <ul className="mt-2 space-y-1.5">
                      {slots.map((slot) => {
                        const slotId = `${item.id}:${slot}`;
                        const log = findLatestLog(item.id, slotId);
                        return (
                          <li key={slotId} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-gray-700">
                              <span className="font-medium">{slot}</span>
                              {" — "}
                              {log ? `taken at ${formatHmFromMs(log.takenAt)}` : "not logged"}
                            </span>
                            <button
                              type="button"
                              onClick={() => openConfirm(item.id, slotId, log?.takenAt ?? null)}
                              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {log ? "Edit" : "Log"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl">
            <p className="font-semibold text-gray-900">Confirm intake</p>
            <p className="mt-1 text-sm text-muted">
              {items.find((x) => x.id === confirmState.itemId)?.name ?? "Item"}
              {confirmState.slotId ? ` · ${confirmState.slotId.split(":").slice(1).join(":")}` : ""}
            </p>
            <label className="mt-3 block">
              <span className="text-sm text-gray-700">Taken at</span>
              <input
                type="time"
                value={confirmState.timeValue}
                onChange={(e) =>
                  setConfirmState((prev) => (prev ? { ...prev, timeValue: e.target.value } : prev))
                }
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="min-h-[44px] rounded-xl border border-border text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConfirm}
                className="min-h-[44px] rounded-xl bg-accent text-sm font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-gray-900">Supplements &amp; Meds setup</p>
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="text-sm text-muted hover:text-gray-800"
              >
                Done
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-muted">
                        {[
                          item.dose,
                          item.frequency,
                          item.timingImportant ? "timing important" : "simple logging",
                          item.stockRemaining != null ? `stock ${item.stockRemaining}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeItem(item.id)}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => openEdit()}
              className="mt-3 w-full min-h-[44px] rounded-xl border border-accent/40 bg-accent-soft/50 text-sm font-semibold text-accent"
            >
              + Add item
            </button>
          </div>
        </div>
      )}

      {editState && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/45">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-4 shadow-xl">
            <p className="font-semibold text-gray-900 mb-3">
              {editState.id ? "Edit item" : "Add item"}
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-700">Name</span>
                <input
                  type="text"
                  value={editState.name}
                  onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                  className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-700">Dose</span>
                <input
                  type="text"
                  value={editState.dose}
                  onChange={(e) => setEditState({ ...editState, dose: e.target.value })}
                  placeholder="e.g. 200mg"
                  className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-700">Frequency</span>
                <input
                  type="text"
                  value={editState.frequency}
                  onChange={(e) => setEditState({ ...editState, frequency: e.target.value })}
                  placeholder="e.g. daily"
                  className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-700">Stock remaining (optional)</span>
                <input
                  type="number"
                  min={0}
                  value={editState.stockRemaining}
                  onChange={(e) => setEditState({ ...editState, stockRemaining: e.target.value })}
                  className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <span className="text-sm text-gray-800">Timing matters for this item</span>
                <input
                  type="checkbox"
                  checked={editState.timingImportant}
                  onChange={(e) => setEditState({ ...editState, timingImportant: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-accent"
                />
              </label>
              {editState.timingImportant && (
                <label className="block">
                  <span className="text-sm text-gray-700">Dose slots (HH:mm, comma-separated)</span>
                  <input
                    type="text"
                    value={editState.slotsText}
                    onChange={(e) => setEditState({ ...editState, slotsText: e.target.value })}
                    placeholder="08:00, 12:00, 16:00"
                    className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
                  />
                </label>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditState(null)}
                className="min-h-[44px] rounded-xl border border-border text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveItem()}
                className="min-h-[44px] rounded-xl bg-accent text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
