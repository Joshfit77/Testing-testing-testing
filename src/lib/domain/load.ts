/**
 * Owner decision T8 (2026-11-12): a loaded exercise (barbell, dumbbell, machine…) needs its weight entered, or the
 * member's explicit "no added weight", before a set is logged. The app never invents a weight and never silently logs
 * a barbell set at zero. Bodyweight work stays one tap.
 */

/** Equipment that puts an external load in the hands or on the bar. */
export const LOADED_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine",
  "cable",
  "trap_bar",
  "landmine",
  "sandbag",
  "medicine_ball",
  "strongman_implements",
  "ez_bar",
  "plate",
]);

/**
 * Does this exercise need a weight? Yes when its equipment includes a load and it isn't also listed as a bodyweight
 * movement (a lunge or step-up that can be done either way stays optional). Timed and distance work never asks.
 */
export function requiresWeight(equipment: readonly string[] | null | undefined, opts: { isTimed?: boolean; usesDistance?: boolean } = {}): boolean {
  if (opts.isTimed || opts.usesDistance) return false;
  const eq = equipment ?? [];
  if (eq.includes("bodyweight")) return false;
  return eq.some((e) => LOADED_EQUIPMENT.has(e));
}

/** Should completing this set ask for the weight first? */
export function needsWeightFirst(
  exercise: { isTimed: boolean; usesDistance: boolean; noWeightConfirmed?: boolean },
  set: { weightKg: number | null; completed: boolean },
  loaded: boolean,
): boolean {
  if (!loaded || set.completed || exercise.isTimed || exercise.usesDistance || exercise.noWeightConfirmed) return false;
  return !(set.weightKg != null && set.weightKg > 0);
}
