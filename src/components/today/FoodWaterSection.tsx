"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllDayKeys, getDayData } from "@/db";
import type { DayData, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { DoneWithUndoAction } from "./DoneWithUndoAction";

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const SENTIMENT_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const BASE_SMOOTHIE_FOODS = [
  "banana",
  "protein powder",
  "berries",
  "spinach",
  "peanut butter",
] as const;

const MIN_REPEATED_SMOOTHIE_FOOD_COUNT = 2;
const MAX_SMOOTHIE_FOOD_CHECKBOXES = 12;

const IGNORED_FOOD_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "with",
  "without",
  "in",
  "on",
  "for",
  "my",
  "of",
  "to",
  "or",
  "plus",
  "had",
  "have",
  "having",
  "used",
  "added",
  "add",
  "made",
  "make",
  "blended",
  "blend",
  "smoothie",
  "today",
  "yesterday",
  "this",
  "that",
  "it",
]);

function normalizeIngredientLabel(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const words = cleaned
    .split(" ")
    .filter((word) => word.length > 1 && !IGNORED_FOOD_WORDS.has(word));

  if (words.length === 0 || words.length > 3) return null;
  return words.join(" ");
}

function extractIngredientsFromSmoothieText(note: string): string[] {
  if (!note.trim()) return [];
  const chunks = note.split(/,|;|\/|\+|&|\band\b|\bwith\b/gi);
  const ingredients = new Set<string>();

  for (const chunk of chunks) {
    const normalized = normalizeIngredientLabel(chunk);
    if (normalized) ingredients.add(normalized);
  }

  return Array.from(ingredients);
}

function collectFoodsForDay(day: Pick<DayData, "smoothieNote" | "smoothieFoods">): string[] {
  const fromNote = extractIngredientsFromSmoothieText(day.smoothieNote ?? "");
  const fromCheckboxes = (day.smoothieFoods ?? [])
    .map((food) => normalizeIngredientLabel(food))
    .filter((food): food is string => Boolean(food));
  return Array.from(new Set([...fromNote, ...fromCheckboxes]));
}

function formatIngredientLabel(food: string): string {
  return food
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type UpdateFn = (prev: DayData) => DayData;

function MoodButtons({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
            value === n
              ? "bg-accent text-white"
              : "bg-gray-100 text-gray-600 hover:bg-accent-soft"
          }`}
          title={SENTIMENT_LABELS[n]}
        >
          {n}
        </button>
      ))}
      {value != null && (
        <span className="ml-1 text-sm text-muted">{SENTIMENT_LABELS[value]}</span>
      )}
    </div>
  );
}

interface Props {
  data: DayData;
  dateKey: string;
  settings: Settings | null;
  update: (fn: UpdateFn) => void;
}

export function FoodWaterSection({ data, dateKey, settings, update }: Props) {
  const goal = settings?.waterGoalMl ?? DEFAULT_SETTINGS.waterGoalMl;
  const pct = goal > 0 ? Math.min(100, (data.waterMl / goal) * 100) : 0;
  const [smoothieHistoryByDate, setSmoothieHistoryByDate] = useState<
    Record<string, Pick<DayData, "smoothieNote" | "smoothieFoods">>
  >({});

  useEffect(() => {
    let cancelled = false;

    const loadSmoothieHistory = async () => {
      try {
        const keys = await getAllDayKeys();
        const entries = await Promise.all(
          keys.map(async (key) => {
            const day = await getDayData(key);
            return [
              key,
              {
                smoothieNote: day.smoothieNote ?? "",
                smoothieFoods: day.smoothieFoods ?? [],
              },
            ] as const;
          })
        );
        if (!cancelled) {
          setSmoothieHistoryByDate(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          setSmoothieHistoryByDate({});
        }
      }
    };

    void loadSmoothieHistory();

    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const suggestedSmoothieFoods = useMemo(() => {
    const counts = new Map<string, number>();
    const allDays: Record<string, Pick<DayData, "smoothieNote" | "smoothieFoods">> = {
      ...smoothieHistoryByDate,
      [dateKey]: {
        smoothieNote: data.smoothieNote ?? "",
        smoothieFoods: data.smoothieFoods ?? [],
      },
    };

    for (const day of Object.values(allDays)) {
      const foodsForDay = collectFoodsForDay(day);
      for (const food of foodsForDay) {
        counts.set(food, (counts.get(food) ?? 0) + 1);
      }
    }

    const repeatedFoods = Array.from(counts.entries())
      .filter(([, count]) => count >= MIN_REPEATED_SMOOTHIE_FOOD_COUNT)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([food]) => food);

    return Array.from(new Set([...BASE_SMOOTHIE_FOODS, ...repeatedFoods])).slice(
      0,
      MAX_SMOOTHIE_FOOD_CHECKBOXES
    );
  }, [data.smoothieFoods, data.smoothieNote, dateKey, smoothieHistoryByDate]);

  const selectedSmoothieFoods = useMemo(
    () =>
      new Set(
        (data.smoothieFoods ?? [])
          .map((food) => normalizeIngredientLabel(food))
          .filter((food): food is string => Boolean(food))
      ),
    [data.smoothieFoods]
  );

  const toggleSmoothieFood = (food: string) => {
    update((prev) => {
      const normalized = normalizeIngredientLabel(food);
      if (!normalized) return prev;

      const nextFoods = new Set(
        (prev.smoothieFoods ?? [])
          .map((item) => normalizeIngredientLabel(item))
          .filter((item): item is string => Boolean(item))
      );

      if (nextFoods.has(normalized)) {
        nextFoods.delete(normalized);
      } else {
        nextFoods.add(normalized);
      }

      return {
        ...prev,
        smoothieFoods: Array.from(nextFoods).sort(),
      };
    });
  };

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
        Food & water
      </h2>

      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Smoothie</p>
              <p className="text-sm text-muted">
                {(data.smoothieEaten ?? false) && data.smoothieAt
                  ? `Logged at ${formatTime(data.smoothieAt)}`
                  : "Not yet"}
              </p>
            </div>
            {(data.smoothieEaten ?? false) ? (
              <DoneWithUndoAction
                onUndo={() =>
                  update((prev) => ({
                    ...prev,
                    smoothieEaten: false,
                    smoothieAt: null,
                    smoothieNote: "",
                    smoothieFoods: [],
                  }))
                }
              />
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    smoothieEaten: true,
                    smoothieAt: Date.now(),
                  }))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
              >
                Mark eaten
              </button>
            )}
          </div>
          {(data.smoothieEaten ?? false) && (
            <>
              <input
                type="text"
                placeholder="What did you have?"
                value={data.smoothieNote ?? ""}
                onChange={(e) =>
                  update((prev) => ({ ...prev, smoothieNote: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
              {suggestedSmoothieFoods.length > 0 && (
                <div className="mt-3 rounded-xl border border-border bg-gray-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Smoothie ingredients
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Repeated items from your smoothie notes become quick checkboxes.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestedSmoothieFoods.map((food) => {
                      const checked = selectedSmoothieFoods.has(food);
                      return (
                        <label
                          key={food}
                          className={`inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                            checked
                              ? "border-accent bg-accent-soft text-gray-800"
                              : "border-border bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSmoothieFood(food)}
                            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                          />
                          <span>{formatIngredientLabel(food)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Lunch eaten</p>
              <p className="text-sm text-muted">
                {data.lunchEaten && data.lunchAt
                  ? `Logged at ${formatTime(data.lunchAt)}`
                  : "Not yet"}
              </p>
            </div>
            {data.lunchEaten ? (
              <DoneWithUndoAction
                onUndo={() =>
                  update((prev) => ({
                    ...prev,
                    lunchEaten: false,
                    lunchAt: null,
                    lunchNote: "",
                  }))
                }
              />
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    lunchEaten: true,
                    lunchAt: Date.now(),
                  }))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
              >
                Mark eaten
              </button>
            )}
          </div>
          {data.lunchEaten && (
            <input
              type="text"
              placeholder="What did you have?"
              value={data.lunchNote ?? ""}
              onChange={(e) =>
                update((prev) => ({ ...prev, lunchNote: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            />
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-sm text-muted block mb-2">Midday mood</span>
            <MoodButtons
              value={data.sentimentMidday ?? null}
              onChange={(n) =>
                update((prev) => ({ ...prev, sentimentMidday: n }))
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-800">Afternoon snack eaten</p>
              <p className="text-sm text-muted">Suppresses food nudges</p>
            </div>
            {(data.snackEaten ?? false) ? (
              <DoneWithUndoAction
                onUndo={() =>
                  update((prev) => ({
                    ...prev,
                    snackEaten: false,
                    snackNote: "",
                  }))
                }
              />
            ) : (
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({ ...prev, snackEaten: true }))
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
              >
                Mark eaten
              </button>
            )}
          </div>
          {(data.snackEaten ?? false) && (
            <input
              type="text"
              placeholder="What did you have?"
              value={data.snackNote ?? ""}
              onChange={(e) =>
                update((prev) => ({ ...prev, snackNote: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            />
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
        <p className="font-medium text-gray-800 mb-2">Water</p>
        <div className="h-3 rounded-full bg-gray-100/80 overflow-hidden mb-4">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-muted mb-3">
          {data.waterMl} / {goal} ml
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              update((prev) => ({
                ...prev,
                waterMl: prev.waterMl + 250,
                waterLog: [
                  ...prev.waterLog,
                  { amount: 250, timestamp: Date.now() },
                ],
              }))
            }
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
          >
            +250 ml
          </button>
          <button
            type="button"
            onClick={() =>
              update((prev) => ({
                ...prev,
                waterMl: prev.waterMl + 500,
                waterLog: [
                  ...prev.waterLog,
                  { amount: 500, timestamp: Date.now() },
                ],
              }))
            }
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border min-h-[44px]"
          >
            +500 ml
          </button>
          <button
            type="button"
            onClick={() =>
              update((prev) => {
                if (prev.waterLog.length === 0) return prev;
                const last = prev.waterLog[prev.waterLog.length - 1];
                return {
                  ...prev,
                  waterMl: prev.waterMl - last.amount,
                  waterLog: prev.waterLog.slice(0, -1),
                };
              })
            }
            disabled={data.waterLog.length === 0}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Undo last
          </button>
        </div>
      </div>
    </section>
  );
}
