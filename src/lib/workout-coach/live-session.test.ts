import { describe, expect, it } from "vitest";
import {
  mergeLiveSessionBlockStates,
  REST_SECONDS,
  resolveWorkoutRenderMode,
  startTimedBlock,
  startWorkoutSession,
  stepWorkoutStateMachine,
} from "./live-session";
import { normalizeWorkoutBlocks } from "./normalize-blocks";

describe("stepWorkoutStateMachine", () => {
  it("WORKOUT_STARTED transition initializes a persistent in-progress session at block 0", () => {
    const workout = {
      id: "start-w1",
      generatedAt: 10,
      variant: "standard",
      blocks: [{ id: "warmup-1", blockType: "warmup_timed", minutes: 5, exercises: [] }],
    } as const;

    const started = startWorkoutSession(workout as never);
    expect(started.sessionStarted).toBe(true);
    expect(started.workoutStatus).toBe("in_progress");
    expect(started.activeBlockIndex).toBe(0);
    expect(started.restTimer).toBeNull();
    expect(started.blockStates["warmup-1"]).toMatchObject({
      blockId: "warmup-1",
      blockType: "warmup_timed",
      status: "not_started",
    });
  });

  it("integration-style entry flow: generated -> begin -> warmup ready -> start warmup active", () => {
    const now = 1_700_000_600_000;
    const workout = {
      id: "entry-flow-w1",
      generatedAt: 11,
      variant: "standard",
      blocks: [
        { id: "warmup-1", blockType: "warmup_timed", minutes: 5, exercises: [] },
        { id: "amrap-1", blockType: "amrap_timed", minutes: 8, exercises: [] },
      ],
    } as const;

    // 1) Workout generated, then 2) Begin workout creates persistent live session
    const started = startWorkoutSession(workout as never);
    expect(started.sessionStarted).toBe(true);
    expect(started.workoutStatus).toBe("in_progress");

    // 3) Warm-up is active first block
    expect(started.activeBlockIndex).toBe(0);
    expect(started.restTimer).toBeNull();

    // 4) Warm-up visible/ready initial state
    const warmupReady = started.blockStates["warmup-1"] as {
      status: string;
      remainingSeconds: number;
      endAtEpochMs: number | null;
      blockType: string;
    };
    expect(warmupReady.blockType).toBe("warmup_timed");
    expect(warmupReady.status).toBe("not_started");
    expect(warmupReady.remainingSeconds).toBe(300);
    expect(warmupReady.endAtEpochMs).toBeNull();

    // 5) Starting warm-up transitions into active/timed state correctly
    const running = startTimedBlock(started, "warmup-1", now);
    const warmupRunning = running.blockStates["warmup-1"] as {
      status: string;
      remainingSeconds: number;
      endAtEpochMs: number | null;
    };
    expect(warmupRunning.status).toBe("active");
    expect(warmupRunning.remainingSeconds).toBe(300);
    expect(warmupRunning.endAtEpochMs).toBe(now + 300 * 1000);

    // Session remains in workout flow (persistent live mode)
    expect(running.sessionStarted).toBe(true);
    expect(running.workoutStatus).toBe("in_progress");
    expect(running.activeBlockIndex).toBe(0);
  });

  it("regression: begin session stays in_progress after normalization/effect-style follow-up steps", () => {
    const now = 1_700_000_650_000;
    const workout = {
      id: "entry-regression-w1",
      generatedAt: 12,
      variant: "standard",
      blocks: [
        { id: "warmup-1", blockType: "warmup_timed", minutes: 5, exercises: [] },
        { id: "amrap-1", blockType: "amrap_timed", minutes: 8, exercises: [] },
      ],
    } as const;
    const normalizedBlocks = normalizeWorkoutBlocks(workout.blocks as never, {
      id: workout.id,
      generatedAt: workout.generatedAt,
    });

    // Begin workout
    const started = startWorkoutSession(workout as never);
    expect(started.workoutStatus).toBe("in_progress");
    expect(started.sessionStarted).toBe(true);
    expect(started.activeBlockIndex).toBe(0);

    // Simulate post-begin normalization effect pass
    const merged = mergeLiveSessionBlockStates(started, normalizedBlocks as never);
    expect(merged.workoutStatus).toBe("in_progress");
    expect(merged.sessionStarted).toBe(true);
    expect(merged.activeBlockIndex).toBe(0);

    // Simulate next state-machine tick without timer completion
    const stepped = stepWorkoutStateMachine(merged, normalizedBlocks as never, now);
    expect(stepped.events).toEqual([]);
    expect(stepped.session.workoutStatus).toBe("in_progress");
    expect(stepped.session.sessionStarted).toBe(true);
    expect(stepped.session.activeBlockIndex).toBe(0);
    expect(resolveWorkoutRenderMode(workout as never, stepped.session)).toBe("LIVE");

    // Warm-up remains the active/visible first block state
    const warmup = stepped.session.blockStates["warmup-1"] as {
      status: string;
      blockType: string;
    };
    expect(warmup.blockType).toBe("warmup_timed");
    expect(warmup.status).toBe("not_started");
  });

  it("render precedence resolves LIVE over preview after begin and follow-up effect-style merge", () => {
    const workout = {
      id: "precedence-w1",
      generatedAt: 13,
      variant: "standard",
      blocks: [{ id: "warmup-1", blockType: "warmup_timed", minutes: 5, exercises: [] }],
    } as const;
    const normalizedBlocks = normalizeWorkoutBlocks(workout.blocks as never, {
      id: workout.id,
      generatedAt: workout.generatedAt,
    });

    const started = startWorkoutSession(workout as never);
    const merged = mergeLiveSessionBlockStates(started, normalizedBlocks as never);

    expect(resolveWorkoutRenderMode(workout as never, merged)).toBe("LIVE");
    expect(resolveWorkoutRenderMode(workout as never, { ...merged, workoutStatus: "completed" })).toBe(
      "COMPLETE"
    );
    expect(resolveWorkoutRenderMode(workout as never, { ...merged, sessionStarted: false })).toBe(
      "PREVIEW"
    );
  });

  it("AMRAP timer reaching 0 marks block complete and starts REST immediately", () => {
    const now = 1_700_000_000_000;
    const blocks = [
      { id: "amrap-1", blockType: "amrap_timed", minutes: 8, exercises: [] },
      { id: "next-1", blockType: "warmup_timed", minutes: 2, exercises: [] },
    ] as const;

    const session = {
      workoutId: "w1",
      workoutGeneratedAt: 1,
      sessionStarted: true,
      workoutStatus: "in_progress",
      activeBlockIndex: 0,
      restTimer: null,
      blockStates: {
        "amrap-1": {
          blockId: "amrap-1",
          blockType: "amrap_timed",
          status: "active",
          remainingSeconds: 3,
          endAtEpochMs: now - 1,
        },
      },
    } as const;

    const stepped = stepWorkoutStateMachine(session, blocks as never, now);
    const amrap = stepped.session.blockStates["amrap-1"] as {
      status: string;
      remainingSeconds: number;
      endAtEpochMs: number | null;
    };

    expect(stepped.events).toEqual(["AMRAP_COMPLETED", "REST_STARTED"]);
    expect(amrap.status).toBe("completed");
    expect(amrap.remainingSeconds).toBe(0);
    expect(amrap.endAtEpochMs).toBeNull();
    expect(stepped.session.restTimer).toMatchObject({
      active: true,
      sourceBlockId: "amrap-1",
      durationSeconds: REST_SECONDS,
      remainingSeconds: REST_SECONDS,
    });
  });

  it("REST timer reaching 0 removes REST and reveals next block immediately", () => {
    const now = 1_700_000_100_000;
    const blocks = [
      { id: "amrap-1", blockType: "amrap_timed", minutes: 8, exercises: [] },
      { id: "next-1", blockType: "warmup_timed", minutes: 2, exercises: [] },
    ] as const;

    const session = {
      workoutId: "w1",
      workoutGeneratedAt: 1,
      sessionStarted: true,
      workoutStatus: "in_progress",
      activeBlockIndex: 0,
      restTimer: {
        active: true,
        sourceBlockId: "amrap-1",
        durationSeconds: REST_SECONDS,
        remainingSeconds: 1,
        autoStarted: true,
        endAtEpochMs: now - 1,
      },
      blockStates: {
        "amrap-1": {
          blockId: "amrap-1",
          blockType: "amrap_timed",
          status: "completed",
          remainingSeconds: 0,
          endAtEpochMs: null,
        },
        "next-1": {
          blockId: "next-1",
          blockType: "warmup_timed",
          status: "not_started",
          remainingSeconds: 120,
          endAtEpochMs: null,
        },
      },
    } as const;

    const stepped = stepWorkoutStateMachine(session, blocks as never, now);

    expect(stepped.events).toEqual(["REST_COMPLETED"]);
    expect(stepped.session.restTimer).toBeNull();
    expect(stepped.session.activeBlockIndex).toBe(1);
  });

  it("cooldown timer reaching 0 marks cooldown complete and completes workout immediately", () => {
    const now = 1_700_000_200_000;
    const blocks = [
      { id: "cooldown-1", blockType: "cooldown_timed", minutes: 5, exercises: [] },
    ] as const;

    const session = {
      workoutId: "w2",
      workoutGeneratedAt: 2,
      sessionStarted: true,
      workoutStatus: "in_progress",
      activeBlockIndex: 0,
      restTimer: null,
      blockStates: {
        "cooldown-1": {
          blockId: "cooldown-1",
          blockType: "cooldown_timed",
          status: "active",
          remainingSeconds: 2,
          endAtEpochMs: now - 1,
        },
      },
    } as const;

    const stepped = stepWorkoutStateMachine(session, blocks as never, now);
    const cooldown = stepped.session.blockStates["cooldown-1"] as {
      status: string;
      remainingSeconds: number;
    };

    expect(stepped.events).toEqual(["COOLDOWN_COMPLETED", "WORKOUT_COMPLETED"]);
    expect(cooldown.status).toBe("completed");
    expect(cooldown.remainingSeconds).toBe(0);
    expect(stepped.session.workoutStatus).toBe("completed");
  });

  it("AMRAP completion fires once only (no duplicate AMRAP_COMPLETED or REST_STARTED)", () => {
    const now = 1_700_000_300_000;
    const blocks = [
      { id: "amrap-1", blockType: "amrap_timed", minutes: 8, exercises: [] },
      { id: "next-1", blockType: "warmup_timed", minutes: 2, exercises: [] },
    ] as const;

    const baseSession = {
      workoutId: "w3",
      workoutGeneratedAt: 3,
      sessionStarted: true,
      workoutStatus: "in_progress",
      activeBlockIndex: 0,
      restTimer: null,
      blockStates: {
        "amrap-1": {
          blockId: "amrap-1",
          blockType: "amrap_timed",
          status: "active",
          remainingSeconds: 1,
          endAtEpochMs: now - 1,
        },
      },
    } as const;

    const first = stepWorkoutStateMachine(baseSession, blocks as never, now);
    expect(first.events).toEqual(["AMRAP_COMPLETED", "REST_STARTED"]);

    const second = stepWorkoutStateMachine(first.session, blocks as never, now + 10);
    const third = stepWorkoutStateMachine(second.session, blocks as never, now + 20);

    expect(second.events).not.toContain("AMRAP_COMPLETED");
    expect(second.events).not.toContain("REST_STARTED");
    expect(third.events).not.toContain("AMRAP_COMPLETED");
    expect(third.events).not.toContain("REST_STARTED");
    expect(second.session.activeBlockIndex).toBe(0);
    expect(third.session.activeBlockIndex).toBe(0);
  });

  it("REST completion fires once only (next block revealed once, no duplicate transitions)", () => {
    const now = 1_700_000_400_000;
    const blocks = [
      { id: "amrap-1", blockType: "amrap_timed", minutes: 8, exercises: [] },
      { id: "next-1", blockType: "warmup_timed", minutes: 2, exercises: [] },
      { id: "next-2", blockType: "cooldown_timed", minutes: 3, exercises: [] },
    ] as const;

    const baseSession = {
      workoutId: "w4",
      workoutGeneratedAt: 4,
      sessionStarted: true,
      workoutStatus: "in_progress",
      activeBlockIndex: 0,
      restTimer: {
        active: true,
        sourceBlockId: "amrap-1",
        durationSeconds: REST_SECONDS,
        remainingSeconds: 1,
        autoStarted: true,
        endAtEpochMs: now - 1,
      },
      blockStates: {
        "amrap-1": {
          blockId: "amrap-1",
          blockType: "amrap_timed",
          status: "completed",
          remainingSeconds: 0,
          endAtEpochMs: null,
        },
        "next-1": {
          blockId: "next-1",
          blockType: "warmup_timed",
          status: "not_started",
          remainingSeconds: 120,
          endAtEpochMs: null,
        },
        "next-2": {
          blockId: "next-2",
          blockType: "cooldown_timed",
          status: "not_started",
          remainingSeconds: 180,
          endAtEpochMs: null,
        },
      },
    } as const;

    const first = stepWorkoutStateMachine(baseSession, blocks as never, now);
    expect(first.events).toEqual(["REST_COMPLETED"]);
    expect(first.session.activeBlockIndex).toBe(1);

    const second = stepWorkoutStateMachine(first.session, blocks as never, now + 10);
    const third = stepWorkoutStateMachine(second.session, blocks as never, now + 20);

    expect(second.events).toEqual([]);
    expect(third.events).toEqual([]);
    expect(second.session.activeBlockIndex).toBe(1);
    expect(third.session.activeBlockIndex).toBe(1);
  });

  it("cooldown completion fires once only (WORKOUT_COMPLETED not duplicated)", () => {
    const now = 1_700_000_500_000;
    const blocks = [
      { id: "cooldown-1", blockType: "cooldown_timed", minutes: 5, exercises: [] },
    ] as const;

    const baseSession = {
      workoutId: "w5",
      workoutGeneratedAt: 5,
      sessionStarted: true,
      workoutStatus: "in_progress",
      activeBlockIndex: 0,
      restTimer: null,
      blockStates: {
        "cooldown-1": {
          blockId: "cooldown-1",
          blockType: "cooldown_timed",
          status: "active",
          remainingSeconds: 1,
          endAtEpochMs: now - 1,
        },
      },
    } as const;

    const first = stepWorkoutStateMachine(baseSession, blocks as never, now);
    expect(first.events).toEqual(["COOLDOWN_COMPLETED", "WORKOUT_COMPLETED"]);
    expect(first.session.workoutStatus).toBe("completed");

    const second = stepWorkoutStateMachine(first.session, blocks as never, now + 10);
    const third = stepWorkoutStateMachine(second.session, blocks as never, now + 20);

    expect(second.events).toEqual([]);
    expect(third.events).toEqual([]);
    expect(second.session.workoutStatus).toBe("completed");
    expect(third.session.workoutStatus).toBe("completed");
  });
});
