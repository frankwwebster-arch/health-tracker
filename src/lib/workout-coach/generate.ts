import type {
  DayData,
  GeneratedWorkout,
  WorkoutCoachBlock,
  WorkoutCoachVariant,
} from "@/types";
import { todayHasBootcampLike, hasStrengthPelotonToday } from "./peloton";

export interface GenerateContext {
  today: DayData;
  /** Previous calendar day data (for "strength yesterday" bias). */
  yesterday: DayData | null;
  preferShort: boolean;
  preferLowEnergy: boolean;
}

function id(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function standardBlocks(short: boolean, low: boolean): WorkoutCoachBlock[] {
  const amrapMin = short ? 8 : low ? 10 : 11;
  const pushMin = short ? 8 : 10;
  const coreMin = short ? 8 : low ? 8 : 9;
  const kb = low ? "20kg" : "24kg";
  const squat = low ? "16kg" : "20kg";

  const b1: WorkoutCoachBlock = {
    id: id(),
    kind: "amrap",
    title: `Block 1 — AMRAP (${amrapMin} min)`,
    minutes: amrapMin,
    exercises: [
      {
        name: "Goblet squats",
        detail: `${squat}. Use a squat wedge. AMRAP with good form.`,
      },
      { name: "KB swings", detail: `${kb}. Hinge, not squat.` },
      {
        name: "One-arm KB rows",
        detail: `${kb} each side. Square hips.`,
      },
    ],
    coaching: "Lower + pull. Keep moving; quality over panic pace.",
  };

  const b2: WorkoutCoachBlock = {
    id: id(),
    kind: "structured_push",
    title: `Block 2 — Structured push (${pushMin} min)`,
    minutes: pushMin,
    exercises: [
      {
        name: "DB bench press",
        detail: low ? "10kg · 8 reps · 3–4 sets" : "12.5kg · 8–10 reps · 3–4 sets",
      },
      {
        name: "Shoulder press",
        detail: low
          ? "8kg · 8 reps · strict — no tiptoes"
          : "10kg · 8 reps · strict — no tiptoes",
      },
    ],
    coaching: "Rest 45–60 sec between sets. Controlled reps.",
  };

  const b3: WorkoutCoachBlock = {
    id: id(),
    kind: "core_circuit",
    title: `Block 3 — Core circuit (${coreMin} min)`,
    minutes: coreMin,
    exercises: [
      {
        name: "Dead bug pullovers",
        detail: low ? "10kg · 10 reps" : "12.5kg · 10 reps",
      },
      { name: "Bench leg raises", detail: "3kg · 12 reps · slow" },
      {
        name: "Suitcase carries",
        detail: `${kb} each side · 30–40 steps each`,
      },
    ],
    coaching: "2–3 rounds. Core circuit — not AMRAP. Breathe.",
  };

  return [b1, b2, b3];
}

function ladderBlocks(low: boolean): WorkoutCoachBlock[] {
  const kb = low ? "20kg" : "24kg";
  return [
    {
      id: id(),
      kind: "kb_ladder",
      title: "KB swing ladder + push-ups (22–28 min)",
      minutes: 24,
      exercises: [
        {
          name: "Swing ladder",
          detail: `5-10-15-20-15-10-5 swings (${kb}). Push-ups between each rung.`,
        },
        {
          name: "Push-ups",
          detail: "As many good reps as needed between swing sets. Stop before form breaks.",
        },
      ],
      coaching: "One rung at a time. Walk around between if needed.",
    },
  ];
}

/**
 * Picks variant and builds workout from Peloton + yesterday + prefs.
 */
export function generateWorkout(ctx: GenerateContext): GeneratedWorkout {
  const { today, yesterday, preferShort, preferLowEnergy } = ctx;

  const bootcampToday = todayHasBootcampLike(today);
  const strengthYesterday =
    yesterday != null &&
    ((yesterday.workoutMinutes != null && yesterday.workoutMinutes >= 20) ||
      hasStrengthPelotonToday(yesterday) ||
      (yesterday.workoutSessions ?? []).some((s) =>
        (s.discipline ?? "").toLowerCase().includes("strength")
      ));

  let variant: WorkoutCoachVariant = "standard";
  if (preferShort) variant = "short";
  if (preferLowEnergy) variant = "low_energy";

  // Bootcamp done → message handled in UI; still allow a tiny "optional" workout — spec says no strength needed; we return minimal mobility optional in UI. For generate: return a very light "active recovery" single block if they insist — actually spec says "no strength needed". UI won't show Generate as primary — we'll handle in panel.

  // Rotate ladder sometimes (deterministic by date)
  const daySeed = new Date().getDate();
  const useLadder =
    !bootcampToday &&
    !preferShort &&
    daySeed % 3 === 0 &&
    !strengthYesterday;

  if (useLadder && !preferLowEnergy) {
    return {
      id: id(),
      generatedAt: Date.now(),
      variant: "ladder",
      blocks: ladderBlocks(preferLowEnergy),
      stretchGoal: "If shoulders feel good, add one extra ladder rung at the top.",
    };
  }

  // Strength yesterday → bias cardio / lighter
  const short = preferShort || strengthYesterday;
  const low = preferLowEnergy || strengthYesterday;

  // If bootcamp today, UI should skip generation; this is a safe fallback.
  if (bootcampToday) {
    return {
      id: id(),
      generatedAt: Date.now(),
      variant: "short",
      blocks: [
        {
          id: id(),
          kind: "core_circuit",
          title: "Optional — easy core (8 min)",
          minutes: 8,
          exercises: [
            { name: "Dead bug", detail: "Bodyweight · 2×10 slow" },
            { name: "Side plank", detail: "20s each side" },
          ],
          coaching: "Bootcamp already covered you. Skip if you want.",
        },
      ],
    };
  }

  const blocks = standardBlocks(short, low);
  const stretch =
    !low && !short
      ? "If you finish early: +1 round of core circuit."
      : undefined;

  return {
    id: id(),
    generatedAt: Date.now(),
    variant,
    blocks,
    stretchGoal: stretch,
  };
}
