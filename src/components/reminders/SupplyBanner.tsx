"use client";

import Link from "next/link";
import type { Settings } from "@/types";

const LABELS: Record<string, string> = {
  dex1: "Dex #1",
  dex2: "Dex #2",
  dex3: "Dex #3",
  bupropion: "Bupropion",
};

const DAYS_WARNING = 7;

export function SupplyBanner({ settings }: { settings: Settings | null }) {
  if (!settings?.medicationSupply) return null;

  const pillsPerDay = settings.medicationPillsPerDay ?? { dex1: 1, dex2: 1, dex3: 1, bupropion: 1 };
  const low: { key: string; days: number }[] = [];
  for (const [key, held] of Object.entries(settings.medicationSupply)) {
    const perDay = pillsPerDay[key as keyof typeof pillsPerDay] || 1;
    const daysLeft = perDay > 0 ? Math.floor(held / perDay) : 0;
    if (held > 0 && daysLeft <= DAYS_WARNING) {
      low.push({ key, days: daysLeft });
    }
  }

  if (low.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-2">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-card">
        <p className="font-medium text-amber-900">Low medication supply</p>
        <p className="text-sm text-amber-800 mt-1">
          {low.map(({ key, days }) => `${LABELS[key]} (${days} day${days === 1 ? "" : "s"} left)`).join(" · ")}
        </p>
        <Link
          href="/settings"
          className="inline-block mt-2 text-sm font-medium text-accent hover:underline"
        >
          Update supply in Settings →
        </Link>
      </div>
    </div>
  );
}
