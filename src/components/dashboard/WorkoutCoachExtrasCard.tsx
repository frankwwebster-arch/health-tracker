"use client";

import { useCallback, useState } from "react";
import { useSettings } from "@/hooks/useTodayData";
import type { WorkoutCoachExerciseCategory, WorkoutCoachSavedExercise } from "@/types";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const CATEGORIES: { value: WorkoutCoachExerciseCategory; label: string }[] = [
  { value: "amrap", label: "AMRAP (lower + pull)" },
  { value: "push", label: "Structured push" },
  { value: "core", label: "Core circuit" },
];

export function WorkoutCoachExtrasCard() {
  const { settings, setSettings } = useSettings();
  const [category, setCategory] = useState<WorkoutCoachExerciseCategory>("amrap");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");

  const list = settings?.workoutCoachSavedExercises ?? [];

  const saveList = useCallback(
    (next: WorkoutCoachSavedExercise[]) => {
      if (!settings) return;
      setSettings({ ...settings, workoutCoachSavedExercises: next });
    },
    [settings, setSettings]
  );

  const addExercise = () => {
    const n = name.trim();
    const d = detail.trim();
    if (!n || !d || !settings) return;
    saveList([
      ...list,
      { id: newId(), category, name: n, detail: d },
    ]);
    setName("");
    setDetail("");
  };

  const remove = (id: string) => {
    saveList(list.filter((x) => x.id !== id));
  };

  if (!settings) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4 shadow-card mb-6">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-card mb-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Workout Coach — extra exercises</h2>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        The main generator uses the built-in exercise library + rotation (see <code className="text-xs bg-gray-100 px-1 rounded">src/lib/workout-coach/library.ts</code>
        ). Save custom lines here for your own reference; full merge into generated blocks is planned. Use placeholders in{" "}
        <strong className="text-gray-700">Detail</strong> if you hand-copy into workouts:{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">{`{kb} {squat} {dbBench} {dbPress} {pullover}`}</code>.
      </p>

      <div className="rounded-xl bg-accent-soft/50 border border-accent/20 px-3 py-2 mb-4 text-xs text-gray-700 leading-snug">
        <strong className="text-gray-900">How weights work:</strong> Loads come from <code className="text-xs">equipment.ts</code>{" "}
        (normal vs low intensity). Coach page <strong>Low energy</strong> uses the lighter column. Rotation memory lives in
        settings so sessions vary without chaos.
      </div>

      <div className="space-y-3 mb-4">
        <label className="block">
          <span className="text-xs font-medium text-muted uppercase">Block</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WorkoutCoachExerciseCategory)}
            className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted uppercase">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ring row"
            className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted uppercase">Detail</span>
          <input
            type="text"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="e.g. {kb} · 3×8–10 · body straight"
            className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5 text-gray-800"
          />
        </label>
        <button
          type="button"
          onClick={addExercise}
          disabled={!name.trim() || !detail.trim()}
          className="w-full min-h-[44px] rounded-xl bg-accent text-white font-semibold text-sm disabled:opacity-50"
        >
          Add exercise
        </button>
      </div>

      {list.length > 0 ? (
        <ul className="space-y-2 border-t border-border pt-3">
          {list.map((ex) => (
            <li
              key={ex.id}
              className="flex gap-2 items-start justify-between text-sm rounded-lg bg-gray-50/80 px-3 py-2 border border-border/60"
            >
              <div className="min-w-0">
                <span className="text-xs font-medium text-accent uppercase">{ex.category}</span>
                <p className="font-medium text-gray-900">{ex.name}</p>
                <p className="text-muted text-xs mt-0.5 break-words">{ex.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(ex.id)}
                className="shrink-0 text-xs text-red-600 hover:underline font-medium"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted border-t border-border pt-3">No extras yet — add above or use the built-in catalog in code.</p>
      )}
    </section>
  );
}
