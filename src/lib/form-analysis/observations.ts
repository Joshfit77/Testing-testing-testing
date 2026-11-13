/**
 * Neutral wording for analysis output. Observations describe measurements only: no grades
 * ("good", "bad", ...), no pain or injury advice. A unit test scans every output string for such words.
 */

export const DISCLAIMER =
  "Experimental measurements from 2D keypoints on a side-on recording. The thresholds have not been " +
  "validated against coach-rated footage, and these numbers are not an assessment of technique.";

/** [1,2,3,5] -> "reps 1–3 and 5"; [4] -> "rep 4". */
export function formatRepList(reps: readonly number[]): string {
  const sorted = [...reps].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}` : `${sorted[i]}`);
    i = j + 1;
  }
  const noun = sorted.length === 1 ? "rep" : "reps";
  if (parts.length <= 1) return `${noun} ${parts[0] ?? ""}`.trim();
  return `${noun} ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "the bottom of reps 3–5" or "the bottom of all 5 reps". */
export function bottomOf(reps: readonly number[], total: number): string {
  return reps.length === total && total > 1 ? `the bottom of all ${total} reps` : `the bottom of ${formatRepList(reps)}`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function formatSeconds(s: number): string {
  return `${s.toFixed(1)} s`;
}

export function formatDeg(d: number): string {
  return `${Math.round(d)}°`;
}
