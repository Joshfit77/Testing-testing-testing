/** A stored split, as the GPS recorder writes it: cumulative distance and moving time at the split, plus its own time. */
export interface StoredSplit {
  index: number;
  unit: "mi" | "km";
  distance_m: number;
  moving_s: number;
  split_s?: number;
}

export interface SplitRow {
  key: number;
  /** "Mile 1", or the real length of a short final split: "0.11 mi". */
  label: string;
  /** This split's own moving time in seconds. */
  seconds: number;
  /** True when the split is shorter than a whole mile or kilometre (the last stretch of a run). */
  partial: boolean;
}

const UNIT_M = { mi: 1609.344, km: 1000 } as const;

/**
 * The rows of a run's split table. Whole splits are numbered; a final split shorter than a whole unit is labelled by
 * its own length, so a 3.11-mile run reads 1, 2, 3, 0.11 mi instead of claiming a fourth mile.
 */
export function splitRows(splits: StoredSplit[]): SplitRow[] {
  const sorted = [...splits].sort((a, b) => a.index - b.index);
  return sorted.map((sp, i) => {
    const size = UNIT_M[sp.unit] ?? 1000;
    const prevDistance = sorted[i - 1]?.distance_m ?? 0;
    const prevMoving = sorted[i - 1]?.moving_s ?? 0;
    const length = sp.distance_m - prevDistance;
    const partial = length > 0 && length < size * 0.98;
    const seconds = sp.split_s ?? sp.moving_s - prevMoving;
    const unitWord = sp.unit === "mi" ? "Mile" : "Km";
    return {
      key: sp.index,
      label: partial ? `${(length / size).toFixed(2)} ${sp.unit}` : `${unitWord} ${sp.index}`,
      seconds: Math.max(0, Math.round(seconds)),
      partial,
    };
  });
}
