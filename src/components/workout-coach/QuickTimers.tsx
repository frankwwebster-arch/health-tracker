"use client";

import { useEffect, useRef, useState } from "react";
import { signalTimerEnd } from "@/lib/workout-coach/timer-sfx";

const PRESETS = [15, 20, 30, 45, 60] as const;

export function QuickTimers() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const totalRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = (sec: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    totalRef.current = sec;
    setSecondsLeft(sec);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev == null || prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          signalTimerEnd();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto px-3 py-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 text-center">
          Quick timer
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => start(s)}
              className="min-h-[48px] min-w-[56px] px-3 rounded-xl text-base font-semibold bg-accent text-white shadow-sm active:scale-[0.98] transition-transform"
            >
              {s}s
            </button>
          ))}
        </div>
        {secondsLeft != null && (
          <p className="text-center mt-3 text-2xl font-bold tabular-nums text-gray-900">
            {secondsLeft}
          </p>
        )}
      </div>
    </div>
  );
}
