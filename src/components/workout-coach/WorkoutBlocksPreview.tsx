"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkoutCoachBlock } from "@/types";

function blockLabel(block: WorkoutCoachBlock, index: number, total: number): string {
  const n = index + 1;
  if (block.kind === "warmup") return `Warm-up · ${n}/${total}`;
  if (block.kind === "amrap" || block.kind === "kb_ladder") return `Block ${n}/${total}`;
  return `Block ${n}/${total}`;
}

export function WorkoutBlocksPreview({
  blocks,
  totalMinutes,
  onBegin,
}: {
  blocks: WorkoutCoachBlock[];
  totalMinutes: number;
  onBegin: () => void;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Preview</p>
        <span className="text-sm font-black text-slate-800 tabular-nums">~{totalMinutes} min total</span>
      </div>
      <p className="text-xs text-slate-600 leading-snug">
        Swipe left / right to see every block before you start.
      </p>

      <div
        ref={scrollerRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-0 scroll-smooth pb-2 -mx-1 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="min-w-full shrink-0 snap-center px-1 box-border"
          >
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm min-h-[200px]">
              <p className="text-[11px] font-bold text-blue-600 uppercase mb-2">
                {blockLabel(block, idx, blocks.length)}
              </p>
              <h3 className="text-lg font-extrabold text-slate-900 mb-3">{block.title}</h3>
              <p className="text-sm text-slate-600 mb-3 tabular-nums">{block.minutes} min</p>
              <ul className="space-y-2">
                {block.exercises.slice(0, 8).map((ex, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <span className="font-semibold text-slate-900">{ex.name}</span>
                    <span className="text-slate-600"> — {ex.detail}</span>
                  </li>
                ))}
                {block.exercises.length > 8 && (
                  <li className="text-xs text-slate-500">+ more…</li>
                )}
              </ul>
            </div>
          </div>
        ))}
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

      <button
        type="button"
        onClick={onBegin}
        className="w-full min-h-[56px] rounded-2xl bg-blue-600 text-white text-lg font-extrabold shadow-lg active:scale-[0.99]"
      >
        Begin workout
      </button>
    </div>
  );
}
