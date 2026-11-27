/**
 * Exercises logged by time although the catalog counts them in reps.
 *
 * The catalog marks an exercise as timed (a plank) or not (kettlebell swings). Programs also prescribe some rep
 * exercises by time ("kettlebell swings, 30 s", "cat-cow, 45 s"). For that workout the exercise is logged by time: the
 * set starts with the prescribed seconds and one tap completes it. History then shows those sets as time, not as
 * "× 0".
 */

/** A program target that gives a time and no reps. */
export function prescribedByTime(isTimed: boolean, target: { reps?: string | null; seconds?: number | null }): boolean {
  if (isTimed) return true;
  const hasReps = typeof target.reps === "string" && target.reps.trim() !== "";
  return !hasReps && (target.seconds ?? 0) > 0;
}

/** Saved sets that were logged by time: a duration on at least one set and reps on none. */
export function loggedByTime(isTimed: boolean, sets: readonly { reps: number | null; durationSeconds: number | null }[]): boolean {
  if (isTimed) return true;
  return sets.some((s) => (s.durationSeconds ?? 0) > 0) && sets.every((s) => !s.reps);
}
