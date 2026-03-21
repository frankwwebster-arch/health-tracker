/**
 * User equipment (canonical KB/DB) for normal vs low-intensity days.
 * Rules: suitcase carries always 24kg; shoulder press minimum 10kg pair (never lower).
 */

export type IntensityMode = "normal" | "low";

export interface ResolvedEquipment {
  /** Kettlebell swings, rows, carries, RDL, thrusters (single KB) */
  kbSwing: string;
  kbGoblet: string;
  kbRow: string;
  kbCarry: string;
  kbRdl: string;
  kbThruster: string;
  /** Pairs */
  dbBenchPair: string;
  dbShoulderPair: string;
  dbDeadBug: string;
  /** Single small plate / DB for leg raises */
  dbLegRaise: string;
  /** Swing ladder — spec default 24kg; low uses 20kg */
  swingLadderKb: string;
}

/** Normal: spec defaults. Low: one step lighter where it matters. */
export function resolveEquipment(mode: IntensityMode): ResolvedEquipment {
  if (mode === "low") {
    return {
      kbSwing: "20kg",
      kbGoblet: "16kg",
      kbRow: "20kg",
      kbCarry: "24kg",
      kbRdl: "20kg",
      kbThruster: "16kg",
      dbBenchPair: "10kg pair",
      dbShoulderPair: "10kg pair",
      dbDeadBug: "10kg",
      dbLegRaise: "3kg",
      swingLadderKb: "20kg",
    };
  }
  return {
    kbSwing: "24kg",
    kbGoblet: "20kg",
    kbRow: "24kg",
    kbCarry: "24kg",
    kbRdl: "24kg",
    kbThruster: "24kg",
    dbBenchPair: "12.5kg pair",
    dbShoulderPair: "10kg pair",
    dbDeadBug: "12.5kg",
    dbLegRaise: "3kg",
    swingLadderKb: "24kg",
  };
}
