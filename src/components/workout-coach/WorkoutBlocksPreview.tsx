"use client";

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
        Scroll through blocks · then use <span className="font-semibold">Begin workout</span> below
      </p>

      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const structured = isFixedRoundsBlock(block);
          const isEdgeTimed =
            block.blockType === "warmup_timed" ||
            block.blockType === "cooldown_timed" ||
            block.kind === "warmup" ||
            block.kind === "cooldown";
          const useBlue = isEdgeTimed;
          return (
            <div
              key={block.id}
              className={`rounded-2xl border-2 p-1 shadow-sm min-h-[180px] max-w-full min-w-0 overflow-hidden ${
                useBlue
                  ? "border-sky-200 bg-sky-50/50"
                  : "border-emerald-200 bg-emerald-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    useBlue ? "text-sky-800" : "text-emerald-900"
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
                  useBlue ? "bg-white border border-sky-100" : "bg-white border border-emerald-100"
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
          );
        })}
      </div>
    </div>
  );
}
