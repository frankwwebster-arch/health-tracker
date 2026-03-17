"use client";

import { useEffect, useState } from "react";
import { getDayData } from "@/db";
import { getDateKey } from "@/types";

function getPastDateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getDateKey(d);
}

async function calculateStreak(): Promise<number> {
  let streak = 0;
  for (let i = 1; i <= 365; i++) {
    const key = getPastDateKey(i);
    const day = await getDayData(key);
    if (!day) break;
    const dexDoses = day.medication?.dex?.doses ?? [];
    const allDexTaken = dexDoses.length > 0 && dexDoses.every((d) => d.taken);
    const bupTaken = day.medication?.bupropion?.taken ?? false;
    if (!allDexTaken || !bupTaken) break;
    streak++;
  }
  return streak;
}

export function StreakBanner() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    calculateStreak().then(setStreak);
  }, []);

  if (streak === null) return null;
  if (streak === 0) return null;

  const emoji = streak >= 14 ? "🔥🔥" : streak >= 7 ? "🔥" : "⭐";

  return (
    <div className="max-w-lg mx-auto px-4 pt-2">
      <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
        {emoji} <strong>{streak} day streak</strong> — all medication taken. Keep it up!
      </div>
    </div>
  );
}