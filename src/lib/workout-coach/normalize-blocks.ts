import type { GeneratedWorkout, WorkoutCoachBlock, WorkoutCoachBlockType } from "@/types";
import {
  createCooldownBlock,
  createDefaultWarmupBlock,
  STRENGTH_WARMUP_SECONDS,
} from "./block-factory";

function inferBlockType(block: WorkoutCoachBlock): WorkoutCoachBlockType {
  if (block.blockType) return block.blockType;
  switch (block.kind) {
    case "warmup":
      return "warmup_timed";
    case "amrap":
    case "kb_ladder":
      return "amrap_timed";
    case "structured_push":
    case "core_circuit":
      return "structured_rounds";
    case "cooldown":
      return "cooldown_timed";
    default:
      return "amrap_timed";
  }
}

function fillDuration(block: WorkoutCoachBlock, blockType: WorkoutCoachBlockType): number {
  if (block.durationSeconds != null && block.durationSeconds > 0) return block.durationSeconds;
  if (blockType === "warmup_timed") return STRENGTH_WARMUP_SECONDS;
  if (blockType === "cooldown_timed") return Math.max(60, block.minutes * 60);

  if (blockType === "amrap_timed") return Math.max(1, block.minutes) * 60;
  return 0;
}

/** Normalize a single block for runtime (blockType, durationSeconds, targetRounds). */
export function normalizeWorkoutBlock(block: WorkoutCoachBlock): WorkoutCoachBlock {
  const blockType = inferBlockType(block);
  const targetRounds =
    block.targetRounds ?? block.roundTarget ?? (blockType === "structured_rounds" ? 3 : undefined);
  const durationSeconds =
    blockType === "structured_rounds"
      ? undefined
      : fillDuration({ ...block, blockType }, blockType);

  return {
    ...block,
    blockType,
    durationSeconds: durationSeconds ?? undefined,
    targetRounds: targetRounds ?? undefined,
  };
}

/** Ensure workout blocks include warm-up + cooldown; merge legacy shapes. */
export function normalizeWorkoutBlocks(
  blocks: WorkoutCoachBlock[],
  workoutMeta: { id: string; generatedAt: number }
): WorkoutCoachBlock[] {
  let list = blocks.map(normalizeWorkoutBlock);

  if (list[0]?.blockType !== "warmup_timed") {
    const w = createDefaultWarmupBlock();
    w.id = `warmup-fallback-${workoutMeta.generatedAt}`;
    list = [normalizeWorkoutBlock(w), ...list];
  }

  if (list[list.length - 1]?.blockType !== "cooldown_timed") {
    list = [...list, normalizeWorkoutBlock(createCooldownBlock(workoutMeta.id))];
  }

  return list;
}

export function normalizeGeneratedWorkout(workout: GeneratedWorkout): GeneratedWorkout {
  return {
    ...workout,
    blocks: normalizeWorkoutBlocks(workout.blocks, {
      id: workout.id,
      generatedAt: workout.generatedAt,
    }),
  };
}
