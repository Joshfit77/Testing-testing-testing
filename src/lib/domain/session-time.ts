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

export interface FitResult<T> {
  exercises: T[];
  minutes: number;
  /** True when anything was cut to make the session fit. */
  trimmed: boolean;
}

/**
 * Fit a session into a time budget, using the same estimate the label shows (estimateSessionMinutes), so a
 * 60-minute choice never produces a session labelled longer than 60 minutes. Cuts happen in this order:
 *  1. accessory sets above 2, from the last accessory backwards;
 *  2. long single timed blocks (10+ minutes: easy cardio, posing), down to 10 minutes;
 *  3. whole accessories, from the end (at least one exercise always stays);
 *  4. main-lift sets above 2, from the last main lift backwards;
 *  5. (only with `minExercises`) the accessories that step 3 kept.
 * `isMain` marks the exercises to protect until step 4. If even that can't fit, the honest (longer) estimate
 * is returned so the label never understates the session.
 */
export function fitSessionToMinutes<T extends Prescription>(
  input: T[],
  budgetMinutes: number,
  framing: number,
  isMain: (ex: T, index: number) => boolean = () => false,
  opts: { minExercises?: number } = {},
): FitResult<T> {
  const keep = Math.max(1, opts.minExercises ?? 1);
  let list = input.map((e, i) => ({ ex: { ...e }, main: isMain(e, i) }));
  const est = () => estimateSessionMinutes(list.map((x) => x.ex), framing);
  let trimmed = false;
  const over = () => est() > budgetMinutes;
  // 1. Accessory sets.
  while (over()) {
    const idx = findLastIndex(list, (x) => !x.main && x.ex.sets > 2);
    if (idx < 0) break;
    list[idx]!.ex.sets -= 1;
    trimmed = true;
  }
  // 2. Long single timed blocks.
  while (over()) {
    const idx = findLastIndex(list, (x) => x.ex.sets === 1 && (x.ex.seconds ?? 0) > 600);
    if (idx < 0) break;
    const excess = (est() - budgetMinutes) * 60;
    const item = list[idx]!.ex;
    item.seconds = Math.max(600, Math.floor((item.seconds! - excess) / 60) * 60);
    trimmed = true;
  }
  // 3. Whole accessories (down to `minExercises`).
  while (over() && list.length > keep) {
    const idx = findLastIndex(list, (x) => !x.main);
    if (idx < 0) break;
    list = list.filter((_, i) => i !== idx);
    trimmed = true;
  }
  // 4. Main-lift sets.
  while (over()) {
    const idx = findLastIndex(list, (x) => x.main && x.ex.sets > 2);
    if (idx < 0) break;
    list[idx]!.ex.sets -= 1;
    trimmed = true;
  }
  // 5. Below `minExercises` only when nothing else is left to cut.
  while (over() && list.length > 1) {
    const idx = findLastIndex(list, (x) => !x.main);
    if (idx < 0) break;
    list = list.filter((_, i) => i !== idx);
    trimmed = true;
  }
  return { exercises: list.map((x) => x.ex), minutes: est(), trimmed };
}

function findLastIndex<T>(arr: T[], fn: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i]!)) return i;
  return -1;
}
