# Workout Coach — engine overview

## Mobile UI (Coach panel)

- **Upper scroll area:** status + “Suggested today” + workout blocks + post log — **no primary taps** in the status card.
- **Fixed thumb dock (bottom):** Generate, Bootcamp / Golf / Swim / Low energy, Short, Apply toggles, **rest timer strip** (horizontal scroll, large presets). Safe-area padding on iOS.
- Timers use `QuickTimersBar` only inside that dock.

---


## Files

| File | Purpose |
|------|---------|
| **`equipment.ts`** | KB/DB resolution for **normal** vs **low** intensity; carries **24kg**; shoulder press **≥10kg pair**. |
| **`library.ts`** | Exercise library — Block 1 pairs (lower+pull), Block 2 push patterns, Block 3 core patterns, swing ladder. |
| **`rotation.ts`** | Picks next pattern while avoiding the last 1–2 repeats; updates **`Settings.workoutCoachRotation`**. |
| **`generate.ts`** | Session types: standard/short/low, swing-ladder conditioning, bootcamp optional core. |
| **`decision-engine.ts`** | **Coach decision**: whether to train, bootcamp vs strength vs rest, hard rules + weekly balance + recovery. **Peloton rides** (cycling) count toward **2/week** suggested cardio; more rides or bootcamps stay optional. |
| **`training-streak.ts`** | **`consecutive_training_days`** — calendar streak of days with **strength, bootcamp, golf, or swim** (manual `swimToday`, Peloton swim heuristic, or logged strength/bootcamp). Ride-only days do **not** extend the streak. |
| **`stretch-suggestions.ts`** | Optional finisher copy (not the structured **Extra Round** control). |
| **`exercise-catalog.ts`** | Legacy shuffle pools (optional); main path is **`library.ts`**. |

## Equipment & weights

- **Normal:** e.g. swings/rows/carry **24kg**, goblet **20kg** (with **squat wedge** called out on goblet squats), bench **12.5kg pair**, shoulder **10kg pair**, dead bug **12.5kg**, leg raise **3kg**, swing ladder **24kg**.
- **Low energy** (Coach toggle or “heavy yesterday” bias): one step lighter on most lifts (e.g. **20kg** swing, **16kg** goblet, **10kg** bench pair); shoulder stays **10kg pair**; carries **24kg**.
- **Goblet squats:** default **use squat wedge** — stated explicitly on the line.

## Rotation (no random churn)

`Settings.workoutCoachRotation` stores:

- Recent Block 1 **pair** ids (`goblet_row`, `swings_row`, …).
- Recent Block 2 **push** patterns (`bench_shoulder`, `bench_pushups`, …).
- Recent Block 3 **core** patterns (staples + optional RKC line).
- **`gensSinceThruster`** — thruster pairs only when this ≥ 5.
- **`generationsSinceLadder`** — after **3** standard strength generations, next eligible session can be a **swing ladder** (unless short/low/bootcamp).

Generating a workout **updates** this state (saved with settings).

## Timing (deterministic)

- **Warm-up** and **cool-down** are always timed blocks, first / last, with a **single explicit duration** in minutes (4, 5, or 6; **never below 4 min**). `durationSeconds` and headers stay in sync (`Warm-up — 4 min`, etc.).
- **AMRAP / KB ladder** blocks use one integer minute duration (`N min AMRAP`); no approximate or ranged durations in titles.
- **Structured** blocks use **rounds only** in headers (`Block N — … — 3 Rounds`), never mixed with time.
- Quick-timer presets parse **single** hold durations (e.g. `20s`); no second-ranges in exercise copy for holds.
- UI shows **exact** minute totals (no `~`).

## Session types

1. **Standard strength** — Block 1 AMRAP lower+pull (2 moves), Block 2 structured push, Block 3 controlled core.
2. **Short** — Shorter block times; same structure.
3. **Low / reset** — Lighter equipment; Block 1 may include **glute bridge + band row**; no thruster/RDL emphasis.
4. **Swing ladder** — `5-10-15-20-15-10-5` swings at **24kg** (20kg if low), push-ups between sets.
5. **Bootcamp day** — optional easy core block only.

## Swim activity type

**Swim** is its own category (`swim_today` / logged swim session). It does **not** count toward bootcamp weekly cap, is **not** a ride or strength class, and does **not** block strength suggestions when swim is the only activity — the coach biases to **optional light** or **recovery** copy instead of pushing volume.

Manual **Swim** in the coach UI sets `swimToday` and appends a small `workoutSessions` entry (`discipline: "Swim"`). Peloton swim imports are detected the same way and are excluded from **ride** counts.

## Consecutive training & recovery mode

**Priority** (after golf / already trained today / bootcamp weekly cap): if **`consecutive_training_days` ≥ 4**, the coach shows a calm rest-or-light message — not bootcamp or heavy strength. The user can still tap **Generate workout**; **`generate.ts`** then uses **`recoveryMode`**: ~22 min blocks, **no swing ladder**, Block 1 titled **Easy flow** (not AMRAP grind), low intensity.

## Progression (design)

Progression is **not** random exercise churn: same blocks, better rounds, cleaner reps, optional bench top set when fresh — see copy in **`generate.ts`** stretch / Extra lines.

## Dashboard extras

Saved exercises on the Dashboard are stored in settings; the **primary** generator is **`library.ts`**. You can still use extras as a personal list until merge is wired.
