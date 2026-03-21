import type {
  WorkoutCoachExercise,
  WorkoutCoachExerciseCategory,
  WorkoutCoachSavedExercise,
} from "@/types";

/**
 * Workout Coach — exercise pools
 * --------------------------------
 * To add exercises: append objects to the arrays below. Each item is one line
 * in the generated workout (name + detail). Generators pick a subset or shuffle.
 */

/** Block 1 — lower + pull (AMRAP) */
export const AMRAP_LOWER_PULL: WorkoutCoachExercise[] = [
  {
    name: "Goblet squats",
    detail: "{squat}. Use a squat wedge. AMRAP with good form.",
  },
  { name: "KB swings", detail: "{kb}. Hinge, not squat." },
  {
    name: "One-arm KB rows",
    detail: "{kb} each side. Square hips.",
  },
  {
    name: "Romanian deadlifts",
    detail: "{kb}. Soft knees, long hamstrings.",
  },
  {
    name: "Reverse lunges",
    detail: "{squat} goblet or two {kb} at sides. Alternate legs.",
  },
  {
    name: "Gorilla rows",
    detail: "Two {kb}, flat back, row both sides.",
  },
  {
    name: "KB swing",
    detail: "{kb}. One crisp hinge per rep; stand tall at the top.",
  },
  {
    name: "Thruster",
    detail: "{kb} from front rack — squat, then drive to overhead in one line.",
  },
  {
    name: "Band row",
    detail: "Band anchored low · pull elbows to ribs · pause 1s.",
  },
];

/** Block 2 — structured push */
export const STRUCTURED_PUSH: WorkoutCoachExercise[] = [
  {
    name: "DB bench press",
    detail: "{dbBench} · 8–10 reps · 3–4 sets",
  },
  {
    name: "Shoulder press",
    detail: "{dbPress} · 8 reps · strict — no tiptoes",
  },
  {
    name: "Incline DB press",
    detail: "{dbBench} · 8 reps · 3 sets · slight incline",
  },
  {
    name: "Floor press",
    detail: "{dbBench} · 8–10 reps · pause 1s on floor",
  },
];

/** Block 3 — core circuit */
export const CORE_CIRCUIT: WorkoutCoachExercise[] = [
  {
    name: "Dead bug pullovers",
    detail: "{pullover} · 10 reps · slow",
  },
  { name: "Bench leg raises", detail: "3kg · 12 reps · slow" },
  {
    name: "Suitcase carries",
    detail: "{kb} each side · 30–40 steps each",
  },
  {
    name: "Pallof press",
    detail: "Cable or band · 10 each side",
  },
  {
    name: "Bird dog rows",
    detail: "{pullover} · 8 each side · hips still",
  },
];

/** Optional bootcamp-day block */
export const OPTIONAL_CORE_LIGHT: WorkoutCoachExercise[] = [
  { name: "Dead bug", detail: "Bodyweight · 2×10 slow" },
  { name: "Side plank", detail: "20s each side" },
  {
    name: "Cat-cow",
    detail: "10 slow breaths",
  },
];

/** For UI hints (e.g. stretch suggestions). */
export function kbWeightLabel(low: boolean): string {
  return low ? "20kg" : "24kg";
}

function kgForLow(low: boolean): { kb: string; squat: string; dbBench: string; dbPress: string; pullover: string } {
  return low
    ? {
        kb: "20kg",
        squat: "16kg",
        dbBench: "10kg",
        dbPress: "8kg",
        pullover: "10kg",
      }
    : {
        kb: "24kg",
        squat: "20kg",
        dbBench: "12.5kg",
        dbPress: "10kg",
        pullover: "12.5kg",
      };
}

/** Fill template strings in exercises (weights depend on energy). */
function applyWeights(ex: WorkoutCoachExercise, w: ReturnType<typeof kgForLow>): WorkoutCoachExercise {
  let detail = ex.detail;
  detail = detail.replace(/\{kb\}/g, w.kb);
  detail = detail.replace(/\{squat\}/g, w.squat);
  detail = detail.replace(/\{dbBench\}/g, w.dbBench);
  detail = detail.replace(/\{dbPress\}/g, w.dbPress);
  detail = detail.replace(/\{pullover\}/g, w.pullover);
  return { ...ex, detail };
}

/** Merge Dashboard-saved exercises into a base pool by category. */
export function mergeSavedIntoPool(
  base: readonly WorkoutCoachExercise[],
  saved: readonly WorkoutCoachSavedExercise[],
  category: WorkoutCoachExerciseCategory
): WorkoutCoachExercise[] {
  const extra = saved
    .filter((x) => x.category === category)
    .map((x) => ({ name: x.name.trim(), detail: x.detail.trim() }))
    .filter((x) => x.name.length > 0 && x.detail.length > 0);
  return [...base, ...extra];
}

/** Shuffle array (Fisher–Yates), return new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Take first n after shuffle, or all if shorter. */
export function pickExercises(
  pool: readonly WorkoutCoachExercise[],
  count: number,
  low: boolean
): WorkoutCoachExercise[] {
  const w = kgForLow(low);
  return shuffle(pool)
    .slice(0, count)
    .map((ex) => applyWeights(ex, w));
}

/** AMRAP block: always 3 moves from pool (customize count here if needed). */
export function pickAmrapBlock(
  low: boolean,
  saved: readonly WorkoutCoachSavedExercise[] = []
): WorkoutCoachExercise[] {
  const pool = mergeSavedIntoPool(AMRAP_LOWER_PULL, saved, "amrap");
  return pickExercises(pool, 3, low);
}

/** Push block: 2 moves from pool. */
export function pickPushBlock(
  low: boolean,
  saved: readonly WorkoutCoachSavedExercise[] = []
): WorkoutCoachExercise[] {
  const pool = mergeSavedIntoPool(STRUCTURED_PUSH, saved, "push");
  return pickExercises(pool, 2, low);
}

/** Core: 3 moves from pool. */
export function pickCoreBlock(
  low: boolean,
  saved: readonly WorkoutCoachSavedExercise[] = []
): WorkoutCoachExercise[] {
  const pool = mergeSavedIntoPool(CORE_CIRCUIT, saved, "core");
  return pickExercises(pool, 3, low);
}

/** Optional single block (bootcamp day): 2 from light pool. */
export function pickOptionalCoreBlock(): WorkoutCoachExercise[] {
  return shuffle(OPTIONAL_CORE_LIGHT).slice(0, 2);
}
