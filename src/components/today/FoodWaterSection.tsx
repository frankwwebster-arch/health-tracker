"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllDayKeys, getDayData } from "@/db";
import type { DayData, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

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
const BASE_LUNCH_COUNT_ITEMS = ["eggs"] as const;

const MIN_REPEATED_SMOOTHIE_FOOD_COUNT = 2;
const MAX_SMOOTHIE_FOOD_CHECKBOXES = 12;
const MIN_REPEATED_LUNCH_ITEM_COUNT = 2;
const MAX_LUNCH_COUNT_ITEM_CHECKBOXES = 12;
const MAX_WEIGHT_GRAMS = 5000;
const MAX_ITEM_COUNT = 99;

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

function normalizeWeightGrams(rawValue: string): number | null {
  if (!rawValue.trim()) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(MAX_WEIGHT_GRAMS, Math.round(parsed * 10) / 10);
}

function normalizeCountValue(rawValue: string): number | null {
  if (!rawValue.trim()) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(MAX_ITEM_COUNT, Math.round(parsed));
}

function sanitizeWeightMap(raw: Record<string, number> | undefined): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [food, grams] of Object.entries(raw ?? {})) {
    const key = normalizeIngredientLabel(food);
    if (!key) continue;
    if (!Number.isFinite(grams) || grams <= 0) continue;
    normalized[key] = Math.min(MAX_WEIGHT_GRAMS, Math.round(grams * 10) / 10);
  }
  return normalized;
}

function sanitizeCountMap(raw: Record<string, number> | undefined): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [item, count] of Object.entries(raw ?? {})) {
    const key = normalizeIngredientLabel(item);
    if (!key) continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    normalized[key] = Math.min(MAX_ITEM_COUNT, Math.round(count));
  }
  return normalized;
}

function collectSmoothieFoodsForDay(
  day: Pick<DayData, "smoothieNote" | "smoothieFoods">
): string[] {
  const fromNote = extractIngredientsFromSmoothieText(day.smoothieNote ?? "");
  const fromCheckboxes = (day.smoothieFoods ?? [])
    .map((food) => normalizeIngredientLabel(food))
    .filter((food): food is string => Boolean(food));
  return Array.from(new Set([...fromNote, ...fromCheckboxes]));
}

function collectLunchCountItemsForDay(
  day: Pick<DayData, "lunchNote" | "lunchItemCounts">
): string[] {
  const fromNote = extractIngredientsFromSmoothieText(day.lunchNote ?? "");
  const fromCounts = Object.keys(day.lunchItemCounts ?? {})
    .map((item) => normalizeIngredientLabel(item))
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set([...fromNote, ...fromCounts]));
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
  const [foodHistoryByDate, setFoodHistoryByDate] = useState<
    Record<
      string,
      Pick<DayData, "smoothieNote" | "smoothieFoods" | "lunchNote" | "lunchItemCounts">
    >
  >({});
  const [newLunchItemName, setNewLunchItemName] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadFoodHistory = async () => {
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
                lunchNote: day.lunchNote ?? "",
                lunchItemCounts: sanitizeCountMap(day.lunchItemCounts),
              },
            ] as const;
          })
        );
        if (!cancelled) {
          setFoodHistoryByDate(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          setFoodHistoryByDate({});
        }
      }
    };

    void loadFoodHistory();

    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const lunchItemCounts = useMemo(
    () => sanitizeCountMap(data.lunchItemCounts),
    [data.lunchItemCounts]
  );

  const smoothieFoodWeights = useMemo(
    () => sanitizeWeightMap(data.smoothieFoodWeights),
    [data.smoothieFoodWeights]
  );

  const suggestedSmoothieFoods = useMemo(() => {
    const counts = new Map<string, number>();
    const allDays: Record<
      string,
      Pick<DayData, "smoothieNote" | "smoothieFoods" | "lunchNote" | "lunchItemCounts">
    > = {
      ...foodHistoryByDate,
      [dateKey]: {
        smoothieNote: data.smoothieNote ?? "",
        smoothieFoods: data.smoothieFoods ?? [],
        lunchNote: data.lunchNote ?? "",
        lunchItemCounts,
      },
    };

    for (const day of Object.values(allDays)) {
      const foodsForDay = collectSmoothieFoodsForDay(day);
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
  }, [data.lunchNote, data.smoothieFoods, data.smoothieNote, dateKey, foodHistoryByDate, lunchItemCounts]);

  const suggestedLunchCountItems = useMemo(() => {
    const counts = new Map<string, number>();
    const allDays: Record<
      string,
      Pick<DayData, "smoothieNote" | "smoothieFoods" | "lunchNote" | "lunchItemCounts">
    > = {
      ...foodHistoryByDate,
      [dateKey]: {
        smoothieNote: data.smoothieNote ?? "",
        smoothieFoods: data.smoothieFoods ?? [],
        lunchNote: data.lunchNote ?? "",
        lunchItemCounts,
      },
    };

    for (const day of Object.values(allDays)) {
      const itemsForDay = collectLunchCountItemsForDay(day);
      for (const item of itemsForDay) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }

    const repeatedItems = Array.from(counts.entries())
      .filter(([, count]) => count >= MIN_REPEATED_LUNCH_ITEM_COUNT)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([item]) => item);

    return Array.from(new Set([...BASE_LUNCH_COUNT_ITEMS, ...repeatedItems])).slice(
      0,
      MAX_LUNCH_COUNT_ITEM_CHECKBOXES
    );
  }, [data.lunchNote, data.smoothieFoods, data.smoothieNote, dateKey, foodHistoryByDate, lunchItemCounts]);

  const displayedLunchCountItems = useMemo(
    () => Array.from(new Set([...suggestedLunchCountItems, ...Object.keys(lunchItemCounts)])),
    [suggestedLunchCountItems, lunchItemCounts]
  );

  const selectedSmoothieFoods = useMemo(
    () =>
      new Set(
        (data.smoothieFoods ?? [])
          .map((food) => normalizeIngredientLabel(food))
          .filter((food): food is string => Boolean(food))
      ),
    [data.smoothieFoods]
  );

  const selectedLunchCountItems = useMemo(
    () => new Set(Object.keys(lunchItemCounts)),
    [lunchItemCounts]
  );

  const canAddLunchItem = normalizeIngredientLabel(newLunchItemName) != null;

  const toggleSmoothieFood = (food: string) => {
    update((prev) => {
      const normalized = normalizeIngredientLabel(food);
      if (!normalized) return prev;

      const nextFoods = new Set(
        (prev.smoothieFoods ?? [])
          .map((item) => normalizeIngredientLabel(item))
          .filter((item): item is string => Boolean(item))
      );
      const nextWeights = sanitizeWeightMap(prev.smoothieFoodWeights);

      if (nextFoods.has(normalized)) {
        nextFoods.delete(normalized);
        delete nextWeights[normalized];
      } else {
        nextFoods.add(normalized);
      }

      return {
        ...prev,
        smoothieFoods: Array.from(nextFoods).sort(),
        smoothieFoodWeights: nextWeights,
      };
    });
  };

  const setSmoothieFoodWeight = (food: string, rawValue: string) => {
    update((prev) => {
      const normalized = normalizeIngredientLabel(food);
      if (!normalized) return prev;

      const grams = normalizeWeightGrams(rawValue);
      const nextFoods = new Set(
        (prev.smoothieFoods ?? [])
          .map((item) => normalizeIngredientLabel(item))
          .filter((item): item is string => Boolean(item))
      );
      const nextWeights = sanitizeWeightMap(prev.smoothieFoodWeights);

      if (grams == null) {
        delete nextWeights[normalized];
      } else {
        nextFoods.add(normalized);
        nextWeights[normalized] = grams;
      }

      return {
        ...prev,
        smoothieFoods: Array.from(nextFoods).sort(),
        smoothieFoodWeights: nextWeights,
      };
    });
  };

  const toggleLunchCountItem = (item: string) => {
    update((prev) => {
      const normalized = normalizeIngredientLabel(item);
      if (!normalized) return prev;
      const nextCounts = sanitizeCountMap(prev.lunchItemCounts);

      if (nextCounts[normalized]) {
        delete nextCounts[normalized];
      } else {
        nextCounts[normalized] = 1;
      }

      return {
        ...prev,
        lunchItemCounts: nextCounts,
      };
    });
  };

  const setLunchItemCount = (item: string, rawValue: string) => {
    update((prev) => {
      const normalized = normalizeIngredientLabel(item);
      if (!normalized) return prev;
      const count = normalizeCountValue(rawValue);
      const nextCounts = sanitizeCountMap(prev.lunchItemCounts);

      if (count == null) {
        delete nextCounts[normalized];
      } else {
        nextCounts[normalized] = count;
      }

      return {
        ...prev,
        lunchItemCounts: nextCounts,
      };
    });
  };

  const addCustomLunchCountItem = () => {
    const normalized = normalizeIngredientLabel(newLunchItemName);
    if (!normalized) return;

    update((prev) => {
      const nextCounts = sanitizeCountMap(prev.lunchItemCounts);
      if (!nextCounts[normalized]) {
        nextCounts[normalized] = 1;
      }
      return {
        ...prev,
        lunchItemCounts: nextCounts,
      };
    });
    setNewLunchItemName("");
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
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    smoothieEaten: false,
                    smoothieAt: null,
                    smoothieNote: "",
                    smoothieFoods: [],
                    smoothieFoodWeights: {},
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
              {selectedSmoothieFoods.size > 0 && (
                <div className="mt-3 rounded-xl border border-border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Weights
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Add grams for any checked ingredient (for example peanut butter).
                  </p>
                  <div className="mt-2 space-y-2">
                    {Array.from(selectedSmoothieFoods)
                      .sort((a, b) => a.localeCompare(b))
                      .map((food) => (
                        <label
                          key={food}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-gray-50/50 px-3 py-2"
                        >
                          <span className="text-sm text-gray-800">{formatIngredientLabel(food)}</span>
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.5"
                              value={smoothieFoodWeights[food] ?? ""}
                              onChange={(e) => setSmoothieFoodWeight(food, e.target.value)}
                              className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                              placeholder="grams"
                            />
                            <span className="text-xs text-muted">g</span>
                          </span>
                        </label>
                      ))}
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
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    lunchEaten: false,
                    lunchAt: null,
                    lunchNote: "",
                    lunchItemCounts: {},
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
            <>
              <input
                type="text"
                placeholder="What did you have?"
                value={data.lunchNote ?? ""}
                onChange={(e) =>
                  update((prev) => ({ ...prev, lunchNote: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
              <div className="mt-3 rounded-xl border border-border bg-gray-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Counted items
                </p>
                <p className="mt-1 text-xs text-muted">
                  Tick an item (for example eggs), then set the quantity.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={newLunchItemName}
                    onChange={(e) => setNewLunchItemName(e.target.value)}
                    placeholder="Add custom item"
                    className="flex-1 rounded-lg border border-border px-2.5 py-2 text-sm text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomLunchCountItem}
                    disabled={!canAddLunchItem}
                    className="min-h-[36px] rounded-lg border border-border bg-white px-3 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {displayedLunchCountItems.map((item) => {
                    const checked = selectedLunchCountItems.has(item);
                    return (
                      <div
                        key={item}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                          checked ? "border-accent/40 bg-accent-soft/40" : "border-border bg-white"
                        }`}
                      >
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLunchCountItem(item)}
                            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                          />
                          <span>{formatIngredientLabel(item)}</span>
                        </label>
                        {checked && (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              value={lunchItemCounts[item] ?? ""}
                              onChange={(e) => setLunchItemCount(item, e.target.value)}
                              className="w-20 rounded-lg border border-border px-2 py-1.5 text-sm text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                            />
                            <span className="text-xs text-muted">count</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
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
              <button
                type="button"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    snackEaten: false,
                    snackNote: "",
                  }))
                }
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 shadow-sm"
              >
                Undo
              </button>
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
