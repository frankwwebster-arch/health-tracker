"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkoutCoachBlock } from "@/types";
import {
  fixedRoundsBlockHeader,
  formatExerciseLineConcise,
  isFixedRoundsBlock,
  timedBlockDisplayTitle,
} from "@/lib/workout-coach/block-labels";

function previewTitle(block: WorkoutCoachBlock, index: number): string {
  if (isFixedRoundsBlock(block)) {
    return fixedRoundsBlockHeader(block, index);
  }
  return timedBlockDisplayTitle(block, index);
}

export function WorkoutBlocksPreview({
  blocks,
  totalMinutes,
}: {
  blocks: WorkoutCoachBlock[];
  totalMinutes: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const i = Math.round(el.scrollLeft / Math.max(w, 1));
    setActive(Math.min(Math.max(0, i), blocks.length - 1));
  }, [blocks.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <div className="flex items-center justify-between gap-2 px-0.5 min-w-0">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
          Preview
        </p>
        <span className="text-sm font-black text-slate-800 tabular-nums shrink-0">
          {totalMinutes} min total
        </span>
      </div>
      <p className="text-xs text-slate-600 text-center">
        Swipe blocks · then use <span className="font-semibold">Begin workout</span> in the bar below
      </p>

      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <div
          ref={scrollerRef}
          className="flex w-full max-w-full min-w-0 overflow-x-auto snap-x snap-mandatory gap-0 scroll-smooth pb-2 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {blocks.map((block, idx) => {
            const structured = isFixedRoundsBlock(block);
            return (
              <div
                key={block.id}
                className="w-full min-w-0 max-w-full shrink-0 grow-0 basis-full snap-center box-border px-1"
              >
                <div
                  className={`rounded-2xl border-2 p-1 shadow-sm min-h-[180px] max-w-full min-w-0 overflow-hidden ${
                    structured
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-sky-200 bg-sky-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        structured ? "text-emerald-900" : "text-sky-800"
                      }`}
                    >
                      {structured ? "Rounds" : "Time"}
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {idx + 1}/{blocks.length}
                    </span>
                  </div>
                  <div
                    className={`rounded-xl p-3 min-h-0 ${
                      structured ? "bg-white border border-emerald-100" : "bg-white border border-sky-100"
                    }`}
                  >
                    <h3 className="text-base font-extrabold text-slate-900 mb-2 break-words hyphens-auto [overflow-wrap:anywhere] leading-snug">
                      {previewTitle(block, idx)}
                    </h3>
                    <ul className="space-y-1.5 min-w-0">
                      {block.exercises.slice(0, 8).map((ex, i) => (
                        <li
                          key={i}
                          className="text-sm leading-snug min-w-0 break-words [overflow-wrap:anywhere] text-slate-800"
                        >
                          {formatExerciseLineConcise(ex)}
                        </li>
                      ))}
                      {block.exercises.length > 8 && (
                        <li className="text-xs text-slate-500 break-words">+ more…</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-1.5 py-1">
        {blocks.map((b, i) => (
          <span
            key={b.id}
            className={`h-2 rounded-full transition-all ${
              i === active ? "w-6 bg-blue-600" : "w-2 bg-slate-300"
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
