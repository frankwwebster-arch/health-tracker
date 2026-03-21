"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkoutCoachBlock } from "@/types";
import { fixedRoundsBlockHeader, isFixedRoundsBlock } from "@/lib/workout-coach/block-labels";

function previewTitle(block: WorkoutCoachBlock, index: number): string {
  if (isFixedRoundsBlock(block)) {
    return fixedRoundsBlockHeader(block, index);
  }
  return block.title;
}

function PreviewMeta({ block }: { block: WorkoutCoachBlock }) {
  if (isFixedRoundsBlock(block)) {
    return null;
  }
  return (
    <p className="text-sm text-slate-600 mb-3 tabular-nums break-words">{block.minutes} min</p>
  );
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
    <div className="w-full min-w-0 max-w-full space-y-4">
      <div className="flex items-center justify-between gap-2 px-0.5 min-w-0">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
          Preview
        </p>
        <span className="text-sm font-black text-slate-800 tabular-nums shrink-0">
          ~{totalMinutes} min total
        </span>
      </div>
      <p className="text-xs text-slate-600 leading-snug break-words">
        Swipe left / right to see every block before you start.
      </p>

      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <div
          ref={scrollerRef}
          className="flex w-full max-w-full min-w-0 overflow-x-auto snap-x snap-mandatory gap-0 scroll-smooth pb-2 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {blocks.map((block, idx) => (
            <div
              key={block.id}
              className="w-full min-w-0 max-w-full shrink-0 grow-0 basis-full snap-center box-border px-1"
            >
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm min-h-[200px] max-w-full min-w-0 overflow-hidden">
                <p className="text-[11px] font-bold text-blue-600 uppercase mb-2 break-words">
                  {block.kind === "warmup"
                    ? `Warm-up · ${idx + 1}/${blocks.length}`
                    : `Block ${idx + 1} of ${blocks.length}`}
                </p>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2 break-words hyphens-auto [overflow-wrap:anywhere]">
                  {previewTitle(block, idx)}
                </h3>
                <PreviewMeta block={block} />
                <ul className="space-y-2 min-w-0">
                  {block.exercises.slice(0, 8).map((ex, i) => (
                    <li key={i} className="text-sm leading-snug min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-900">{ex.name}</span>
                      <span className="text-slate-600"> — {ex.detail}</span>
                    </li>
                  ))}
                  {block.exercises.length > 8 && (
                    <li className="text-xs text-slate-500 break-words">+ more…</li>
                  )}
                </ul>
              </div>
            </div>
          ))}
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
