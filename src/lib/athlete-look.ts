/**
 * Which exercises draw the new black-and-gold athlete (src/lib/exercise-motion/athlete.ts) instead of the classic gold
 * figure. While the owner reviews the new look, four exercises show it (with a button to compare it with the classic
 * figure); the classic figure stays the fallback for every other exercise. Approving it for the whole library is one
 * line: ATHLETE_LOOK_FOR_ALL = true.
 */
export const ATHLETE_LOOK_PREVIEW: readonly string[] = ["back-squat", "dumbbell-curl", "seated-cable-row", "zone-2-run"];

export const ATHLETE_LOOK_FOR_ALL = false;

/** True when this exercise's demonstration uses the athlete look. */
export function usesAthleteLook(slug: string): boolean {
  return ATHLETE_LOOK_FOR_ALL || ATHLETE_LOOK_PREVIEW.includes(slug);
}

/** True while the athlete look is a preview awaiting approval (it shows a badge and the compare button). */
export function athleteLookInReview(slug: string): boolean {
  return !ATHLETE_LOOK_FOR_ALL && ATHLETE_LOOK_PREVIEW.includes(slug);
}
