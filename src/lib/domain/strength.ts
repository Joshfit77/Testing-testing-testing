/**
 * Strength calculations. All loads are in kilograms.
 */

export interface LoggedSet {
  reps: number | null;
  weightKg: number | null;
  durationSeconds?: number | null;
  completed: boolean;
  isWarmup?: boolean;
}

/**
 * Estimated one-rep max using the Epley formula, which is reasonably accurate for
 * sets of roughly 1–10 reps. Returns null when an estimate would be unreliable.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return round2(weightKg);
  if (reps > 12) return null;
  return round2(weightKg * (1 + reps / 30));
}

export function setVolume(set: LoggedSet): number {
  if (!set.completed || set.isWarmup) return 0;
  if (!set.reps || !set.weightKg) return 0;
  return set.reps * set.weightKg;
}

export function totalVolume(sets: LoggedSet[]): number {
  return round2(sets.reduce((sum, s) => sum + setVolume(s), 0));
}

export type RecordType = "estimated_1rm" | "max_weight" | "max_reps" | "max_set_volume" | "max_duration";

export interface PersonalBest {
  recordType: RecordType;
  value: number;
  weightKg?: number | null;
  reps?: number | null;
}

/** The best value of each record type achieved within a set of logged sets for one exercise. */
export function bestsFromSets(sets: LoggedSet[]): PersonalBest[] {
  const working = sets.filter((s) => s.completed && !s.isWarmup);
  const out = new Map<RecordType, PersonalBest>();
  const consider = (b: PersonalBest) => {
    const prev = out.get(b.recordType);
    if (!prev || b.value > prev.value) out.set(b.recordType, b);
  };
  for (const s of working) {
    const reps = s.reps ?? 0;
    const w = s.weightKg ?? 0;
    if (w > 0 && reps > 0) {
      consider({ recordType: "max_weight", value: w, weightKg: w, reps });
      consider({ recordType: "max_set_volume", value: round2(w * reps), weightKg: w, reps });
      const e1rm = estimateOneRepMax(w, reps);
      if (e1rm != null) consider({ recordType: "estimated_1rm", value: e1rm, weightKg: w, reps });
    } else if (reps > 0 && w === 0) {
      consider({ recordType: "max_reps", value: reps, reps, weightKg: null });
    }
    if (s.durationSeconds && s.durationSeconds > 0) {
      consider({ recordType: "max_duration", value: s.durationSeconds });
    }
  }
  return [...out.values()];
}

/**
 * Compare new bests against previously stored bests and return only true improvements.
 * A first-ever value counts as a record.
 */
export function detectNewRecords(previous: PersonalBest[], candidates: PersonalBest[]): PersonalBest[] {
  const prevMap = new Map(previous.map((p) => [p.recordType, p.value]));
  return candidates.filter((c) => {
    const prev = prevMap.get(c.recordType);
    return prev === undefined || c.value > prev + 1e-9;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
