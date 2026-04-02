"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type {
  StructuredRoundsLiveState,
  WorkoutCoachBlock,
  WorkoutCoachBlockLiveState,
} from "@/types";
import { getDateKey } from "@/types";
import { useTodayData } from "@/hooks/useTodayData";
import { LayoutHeader } from "@/components/LayoutHeader";
import {
  fixedRoundsBlockHeader,
  formatExerciseLineConcise,
  isFixedRoundsBlock,
  timedBlockDisplayTitle,
} from "@/lib/workout-coach/block-labels";

function blockTitle(block: WorkoutCoachBlock, index: number): string {
  if (isFixedRoundsBlock(block)) return fixedRoundsBlockHeader(block, index);
  return timedBlockDisplayTitle(block, index);
}

export default function CoachWorkoutReviewPage() {
  const params = useParams<{ entryId: string }>();
  const searchParams = useSearchParams();
  const dateKey = searchParams.get("date") ?? getDateKey();
  const { data } = useTodayData(dateKey);

  const entry = useMemo(
    () => (data?.coachWorkoutEntries ?? []).find((x) => x.id === params.entryId),
    [data?.coachWorkoutEntries, params.entryId]
  );

  if (!data) {
    return (
      <>
        <LayoutHeader title="Workout Review" />
        <main className="max-w-md mx-auto px-4 py-6">
          <p className="text-muted">Loading…</p>
        </main>
      </>
    );
  }

  if (!entry) {
    return (
      <>
        <LayoutHeader title="Workout Review" />
        <main className="max-w-md mx-auto px-4 py-6 space-y-3">
          <p className="text-sm text-slate-700">Workout not found for this day.</p>
          <Link href="/today" className="text-sm font-medium text-accent hover:underline">
            Back to Today
          </Link>
        </main>
      </>
    );
  }

  const snapshotBlocks = entry.reviewSnapshot?.blocks ?? [];
  const snapshotStates = entry.reviewSnapshot?.blockStates ?? {};

  return (
    <>
      <LayoutHeader title="Workout Review" />
      <main className="max-w-md mx-auto px-3 sm:px-4 pt-4 pb-10 space-y-4">
        <section className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Completed</p>
          <h1 className="text-lg font-extrabold text-violet-950 mt-0.5">{entry.label} workout</h1>
          <p className="text-sm text-violet-900/90 mt-1">
            {new Date(entry.createdAt).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-2 inline-flex rounded-full border border-violet-300 bg-white px-3 py-1 text-sm font-semibold text-violet-900">
            Total time {entry.minutes} min
          </p>
        </section>

        {snapshotBlocks.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-700">
              Coach workout summary only for this entry.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Detailed review is available for newly completed workouts.
            </p>
          </section>
        )}

        {snapshotBlocks.map((block, idx) => {
          const live = snapshotStates[block.id] as WorkoutCoachBlockLiveState | undefined;
          const structured = isFixedRoundsBlock(block);
          const structuredLive =
            structured && live?.blockType === "structured_rounds"
              ? (live as StructuredRoundsLiveState)
              : null;
          const roundsDone = structuredLive?.completedRounds ?? 0;
          const roundsTarget =
            structuredLive?.targetRounds ?? block.targetRounds ?? block.roundTarget ?? 0;
          const extraDone = structuredLive?.extraRoundState === "completed";

          return (
            <section
              key={block.id}
              className="rounded-2xl border-2 border-violet-200 bg-violet-50/70 p-1"
            >
              <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-900">
                  {structured ? "Rounds" : "Time"}
                </span>
                <span className="text-[10px] text-violet-700 tabular-nums">
                  {idx + 1}/{snapshotBlocks.length}
                </span>
              </div>

              <div className="rounded-xl border border-violet-200 bg-white p-3">
                <h2 className="text-base font-extrabold text-slate-900 mb-2 leading-snug">
                  {blockTitle(block, idx)}
                </h2>
                <ul className="space-y-1.5">
                  {block.exercises.map((ex, i) => (
                    <li key={i} className="text-sm text-slate-800">
                      {formatExerciseLineConcise(ex)}
                    </li>
                  ))}
                </ul>

                {structured && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold text-violet-950">
                      Rounds completed: {roundsDone}/{roundsTarget}
                    </p>
                    {extraDone && (
                      <p className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        Extra round completed
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-violet-700">
                  Saved session · read-only
                </p>
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
