/**
 * How long a prescribed session takes. Pure and dependency-free so the program catalog can use it to
 * state honest session lengths, and the audit/tests can check them.
 */
type Prescription = { sets: number; reps?: string; seconds?: number; rest: number };

/** Reps implied by a rep string, for timing: "8-12" → 10, "5 per side" → 10, "AMRAP" → 10. */
export function repsForTiming(reps: string | undefined): number | null {
  if (!reps) return null;
  if (/\b(m|ft|yd)\b/.test(reps) || /fly/.test(reps)) return null;
  const nums = (reps.match(/\d+/g) ?? []).map(Number);
  let n = nums.length === 0 ? 10 : nums.length >= 2 && /\d\s*[-–]\s*\d/.test(reps) ? (nums[0]! + nums[1]!) / 2 : nums[0]!;
  if (/per (side|arm|leg)|each/.test(reps)) n *= 2;
  return n;
}

/** Working time of one set in seconds. */
export function workSeconds(ex: Pick<Prescription, "reps" | "seconds">): number {
  const reps = repsForTiming(ex.reps);
  if (reps !== null && !ex.seconds) return Math.max(15, Math.min(90, reps * 4));
  if (ex.seconds) return ex.seconds;
  return 20; // distance work without a time
}

/**
 * Minutes a session takes: the general warm-up and cool-down (`framing`: about 8 + 4 minutes by default, or
 * see framingMinutes), each set's work plus
 * its rest (no rest after the last set), about a minute to set up each exercise, and about 3 minutes of
 * ramp-up sets before each heavy lift (any rep-based exercise prescribed with 150 s or more of rest).
 */
export function estimateSessionMinutes(exercises: Prescription[], framing: boolean | number = true): number {
  let s = (framing === true ? 12 : framing === false ? 0 : framing) * 60;
  for (const ex of exercises) {
    s += ex.sets * workSeconds(ex) + Math.max(0, ex.sets - 1) * ex.rest + 60;
    if (ex.reps && !ex.seconds && ex.rest >= 150 && repsForTiming(ex.reps) !== null) s += 180;
  }
  return Math.round(s / 60);
}

/** Warm-up and cool-down time: about 1.5 minutes per listed item, capped at 8 and 4 minutes. */
export function framingMinutes(warmup: string[], cooldown: string[]): number {
  return Math.round(Math.min(8, 1.5 * warmup.length) + Math.min(4, 1.5 * cooldown.length));
}
