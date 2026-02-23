"use client";

import {
  getDateKey,
  getAdjacentDateKey,
  formatDateLabel,
} from "@/types";

interface Props {
  dateKey: string;
  onDateChange: (dateKey: string) => void;
}

export function DateSelector({ dateKey, onDateChange }: Props) {
  const today = getDateKey();

  return (
    <div className="flex items-center justify-between gap-2 py-3 px-1">
      <button
        type="button"
        onClick={() => onDateChange(getAdjacentDateKey(dateKey, -1))}
        className="p-2 rounded-xl text-muted hover:bg-accent-soft hover:text-gray-800 transition-colors"
        aria-label="Previous day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <label className="flex-1 relative flex justify-center items-center min-h-[44px] rounded-xl hover:bg-accent-soft/50 transition-colors cursor-pointer">
        <span className="font-medium text-gray-800 pointer-events-none">
          {formatDateLabel(dateKey)}
        </span>
        <input
          type="date"
          value={dateKey}
          max={today}
          onChange={(e) => onDateChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={() => onDateChange(getAdjacentDateKey(dateKey, 1))}
        disabled={getAdjacentDateKey(dateKey, 1) > today}
        className="p-2 rounded-xl text-muted hover:bg-accent-soft hover:text-gray-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Next day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
