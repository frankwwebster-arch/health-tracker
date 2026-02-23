"use client";

import { useState } from "react";
import type { DayData } from "@/types";
import type { WeightUnit } from "@/types";
import {
  kgToLbs,
  kgToStone,
  lbsToKg,
  stoneToKg,
  parseStoneInput,
} from "@/types";

type UpdateFn = (prev: DayData) => DayData;

interface Props {
  data: DayData;
  update: (fn: UpdateFn) => void;
}

export function WeightSection({ data, update }: Props) {
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [inputValue, setInputValue] = useState("");
  const weightKg = data.weightKg ?? null;

  const parseAndStore = () => {
    const val = parseFloat(inputValue.replace(",", "."));
    if (isNaN(val)) return;
    let kg: number;
    if (unit === "kg") kg = val;
    else if (unit === "lbs") kg = lbsToKg(val);
    else {
      const { stone, lbs } = parseStoneInput(val);
      kg = stoneToKg(stone, lbs);
    }
    if (kg <= 0 || kg > 500) return;
    update((prev) => ({
      ...prev,
      weightKg: Math.round(kg * 10) / 10,
      weightLoggedAt: Date.now(),
    }));
    setInputValue("");
  };

  const clearWeight = () => {
    update((prev) => ({
      ...prev,
      weightKg: null,
      weightLoggedAt: null,
    }));
  };

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
        Weight
      </h2>
      <div className="rounded-2xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow">
        {weightKg != null ? (
          <div>
            <p className="font-medium text-gray-800 mb-1">
              {weightKg.toFixed(1)} kg
            </p>
            <p className="text-sm text-muted">
              {kgToLbs(weightKg).toFixed(1)} lbs · {kgToStone(weightKg).stone} st{" "}
              {kgToStone(weightKg).lbs.toFixed(1)} lb
            </p>
            <button
              type="button"
              onClick={clearWeight}
              className="mt-2 px-3 py-1.5 rounded-xl text-sm font-medium bg-white/80 text-gray-600 hover:bg-white border border-border"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[100px]">
              <input
                type="number"
                step={unit === "stone" ? 0.1 : 0.1}
                min={20}
                max={500}
                placeholder={unit === "stone" ? "e.g. 11.5 (11st 5lb)" : unit === "lbs" ? "e.g. 154" : "e.g. 70"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && parseAndStore()}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-gray-800 placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              />
            </div>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as WeightUnit)}
              className="rounded-xl border border-border px-3 py-2.5 text-gray-800 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
              <option value="stone">st</option>
            </select>
            <button
              type="button"
              onClick={parseAndStore}
              disabled={!inputValue.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              Log
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
