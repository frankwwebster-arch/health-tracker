"use client";

import { useEffect, useRef, useState } from "react";
import { signalTimerEnd } from "@/lib/workout-coach/timer-sfx";

import { QUICK_TIMER_PRESET_SECONDS } from "@/lib/workout-coach/block-labels";

const PRESETS = [...QUICK_TIMER_PRESET_SECONDS];

export type QuickTimersBarProps = {
  /** Extra classes for the outer wrapper (e.g. padding) */
  className?: string;
  /** When false, hide entirely (e.g. AMRAP active — timer is in the block). */
  visible?: boolean;
  /** If set, only these preset buttons (subset of 15–60s). If undefined, show all presets. */
  presets?: number[];
};

/**
 * Timer presets + countdown — no fixed positioning.
 * Parent should place this in the thumb zone (fixed bottom dock).
 */
export function QuickTimersBar({
  className = "",
  visible = true,
  presets: presetsFilter,
}: QuickTimersBarProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = (sec: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActivePreset(sec);
    setSecondsLeft(sec);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev == null || prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          signalTimerEnd();
          setActivePreset(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!visible) return null;

  const presetButtons =
    presetsFilter == null
      ? PRESETS
      : PRESETS.filter((s) => presetsFilter.includes(s));

  if (presetButtons.length === 0) return null;

  return (
    <div className={`touch-manipulation ${className}`}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
        Timer
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {presetButtons.map((s) => {
          const isActive = activePreset === s && secondsLeft != null && secondsLeft > 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => start(s)}
              className={`snap-start shrink-0 min-h-[52px] min-w-[64px] px-4 rounded-2xl text-lg font-bold transition-colors active:opacity-80 touch-manipulation ${
                isActive
                  ? "bg-sky-600 text-white shadow-lg ring-2 ring-sky-400 scale-[1.02]"
                  : "bg-sky-100 text-sky-950 border-2 border-sky-200 hover:bg-sky-200"
              }`}
            >
              {s}s
            </button>
          );
        })}
      </div>
      {secondsLeft != null && (
        <p className="text-center mt-2 text-5xl font-black tabular-nums text-sky-900 leading-none">
          {secondsLeft}
        </p>
      )}
    </div>
  );
}
