"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkoutCoachBlock } from "@/types";
import { signalTimerEnd } from "@/lib/workout-coach/timer-sfx";

function formatMmSs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isTimerBlock(b: WorkoutCoachBlock): boolean {
  return b.kind === "amrap" || b.kind === "kb_ladder";
}

function isWarmup(b: WorkoutCoachBlock): boolean {
  return b.kind === "warmup";
}

function isStructured(b: WorkoutCoachBlock): boolean {
  return b.kind === "structured_push" || b.kind === "core_circuit";
}

export function CollapsedBlock({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 flex items-center gap-2 min-h-[52px]">
      <span className="text-emerald-700 text-xl font-bold">✓</span>
      <span className="font-bold text-emerald-900">{title}</span>
    </div>
  );
}

type Props = {
  block: WorkoutCoachBlock;
  index: number;
  total: number;
  onBlockFinished: () => void;
};

export function WorkoutBlockRunner({ block, index, total, onBlockFinished }: Props) {
  if (isWarmup(block)) {
    return <WarmupBlock block={block} index={index} total={total} onBlockFinished={onBlockFinished} />;
  }
  if (isTimerBlock(block)) {
    return <AmrapBlock block={block} index={index} total={total} onBlockFinished={onBlockFinished} />;
  }
  if (isStructured(block)) {
    return (
      <StructuredBlock block={block} index={index} total={total} onBlockFinished={onBlockFinished} />
    );
  }
  return null;
}

function WarmupBlock({
  block,
  index,
  total,
  onBlockFinished,
}: Props & { block: WorkoutCoachBlock }) {
  const [done, setDone] = useState(false);

  const handleStart = () => {
    setDone(true);
    window.setTimeout(() => onBlockFinished(), 400);
  };

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-colors duration-300 ${
        done ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">
        {index + 1}/{total}
      </p>
      <h3 className="text-lg font-extrabold text-slate-900 mb-3">{block.title}</h3>
      <ul className="space-y-2 mb-4">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-base">
            <span className="font-bold text-slate-900">{ex.name}</span>
            <span className="text-slate-600"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {!done && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full min-h-[56px] rounded-2xl bg-blue-600 text-white text-lg font-extrabold active:scale-[0.99]"
        >
          Start workout
        </button>
      )}
      {done && <p className="text-center text-lg font-black text-emerald-700 py-2">Done</p>}
    </div>
  );
}

function AmrapBlock({ block, index, total, onBlockFinished }: Props) {
  const [phase, setPhase] = useState<"idle" | "work" | "done">("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const finishedRef = useRef(false);

  const workSeconds = block.minutes * 60;

  useEffect(() => {
    if (phase !== "work") return;
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          signalTimerEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, timerKey, secondsLeft]);

  useEffect(() => {
    if (phase !== "work" || secondsLeft > 0) return;
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("done");
    const t = window.setTimeout(() => onBlockFinished(), 900);
    return () => window.clearTimeout(t);
  }, [secondsLeft, phase, onBlockFinished]);

  const handleStart = () => {
    finishedRef.current = false;
    setPhase("work");
    setSecondsLeft(workSeconds);
    setTimerKey((k) => k + 1);
  };

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-colors ${
        phase === "done" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">
        {index + 1}/{total}
      </p>
      <h3 className="text-lg font-extrabold text-slate-900 mb-3">{block.title}</h3>
      <ul className="space-y-2 mb-4">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-base">
            <span className="font-bold text-slate-900">{ex.name}</span>
            <span className="text-slate-600"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full min-h-[56px] rounded-2xl bg-blue-600 text-white text-lg font-extrabold active:scale-[0.99]"
        >
          Start block
        </button>
      )}
      {phase === "work" && (
        <button
          type="button"
          className="w-full min-h-[72px] rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center gap-1 active:scale-[0.99]"
          disabled
        >
          <span className="text-4xl font-black tabular-nums">{formatMmSs(secondsLeft)}</span>
          <span className="text-xs font-bold uppercase opacity-90">Go</span>
        </button>
      )}
      {phase === "done" && (
        <p className="text-center text-lg font-black text-emerald-700 py-2">Block complete</p>
      )}
    </div>
  );
}

function StructuredBlock({ block, index, total, onBlockFinished }: Props) {
  const target = block.roundTarget ?? 3;
  const [started, setStarted] = useState(false);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [blockComplete, setBlockComplete] = useState(false);
  const [extraMode, setExtraMode] = useState(false);
  const [extraCount, setExtraCount] = useState(0);

  const handleMainTap = () => {
    if (!started) {
      setStarted(true);
      return;
    }
    if (roundsCompleted < target) {
      const next = roundsCompleted + 1;
      setRoundsCompleted(next);
      if (next >= target) {
        setBlockComplete(true);
      }
    }
  };

  const handleExtraPushEnter = () => {
    setExtraMode(true);
  };

  const handleExtraRoundDone = () => {
    setExtraCount((c) => c + 1);
  };

  const handleDone = () => {
    onBlockFinished();
  };

  const showExtra = blockComplete;
  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3 ${
        blockComplete && !extraMode ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">
        {index + 1}/{total}
      </p>
      <h3 className="text-lg font-extrabold text-slate-900">{block.title}</h3>
      {started && !blockComplete && (
        <p className="text-sm font-bold text-slate-700">
          Round {Math.min(roundsCompleted + 1, target)} / {target}
        </p>
      )}
      <ul className="space-y-2">
        {block.exercises.map((ex, i) => (
          <li key={i} className="text-base">
            <span className="font-bold text-slate-900">{ex.name}</span>
            <span className="text-slate-600"> — {ex.detail}</span>
          </li>
        ))}
      </ul>
      {block.coaching && <p className="text-xs text-slate-500">{block.coaching}</p>}

      {!blockComplete && (
        <button
          type="button"
          onClick={handleMainTap}
          className="w-full min-h-[56px] rounded-2xl bg-blue-600 text-white text-lg font-extrabold active:scale-[0.99]"
        >
          {!started
            ? "Start block"
            : roundsCompleted < target
              ? `Round ${roundsCompleted + 1} done`
              : "Block complete"}
        </button>
      )}

      {blockComplete && (
        <>
          <button
            type="button"
            disabled
            className="w-full min-h-[56px] rounded-2xl bg-emerald-600 text-white text-lg font-extrabold"
          >
            Block complete
          </button>
          {extraCount > 0 && (
            <p className="text-center font-bold text-slate-800">Extra rounds: {extraCount}</p>
          )}
          {!extraMode && (
            <button
              type="button"
              onClick={handleExtraPushEnter}
              className="w-full min-h-[48px] rounded-2xl border-2 border-dashed border-slate-400 bg-slate-50 text-slate-800 font-bold"
            >
              Extra push
            </button>
          )}
          {extraMode && (
            <button
              type="button"
              onClick={handleExtraRoundDone}
              className="w-full min-h-[52px] rounded-2xl border-2 border-slate-300 bg-white font-extrabold text-slate-900"
            >
              Extra round done
            </button>
          )}
          <button
            type="button"
            onClick={handleDone}
            className="w-full min-h-[52px] rounded-2xl bg-slate-900 text-white font-extrabold"
          >
            Done
          </button>
        </>
      )}
    </div>
  );
}
