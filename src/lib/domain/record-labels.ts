/**
 * One set of words for personal bests across the app (milestones, records, workout summary, progress, muscle map).
 *
 *   Heaviest lift      the most weight completed for at least one rep (record type max_weight). Something you lifted.
 *   Estimated 1RM      a calculation (Epley) from a set's weight and reps (record type estimated_1rm). It can be heavier
 *                      than anything you have lifted, so it is always called "estimated", never a "lift" or "best set".
 *   Most reps          the most reps in one set; for bodyweight exercises, at bodyweight (no added weight).
 *   Heaviest added weight   the most weight added to a bodyweight exercise (weighted pull-ups, dips), for at least one rep.
 *   Longest hold       the longest timed set of a hold (plank, hang); cardio by time is a "longest session".
 *   Longest run / walk / distance   the longest single effort.
 */
export const RECORD_TERMS = {
  max_weight: "Heaviest lift",
  estimated_1rm: "Estimated 1RM",
  max_reps: "Most reps",
  bodyweight_reps: "Most reps at bodyweight",
  added_weight: "Heaviest added weight",
  max_set_volume: "Best set volume",
  max_duration: "Longest hold",
  longest_session: "Longest session",
  max_distance: "Longest distance",
  longest_run: "Longest run",
  longest_walk: "Longest walk",
} as const;

/** Labels for the stored record types (personal_records.record_type), sentence case. */
export const RECORD_TYPE_LABEL: Record<string, string> = {
  estimated_1rm: RECORD_TERMS.estimated_1rm,
  max_weight: RECORD_TERMS.max_weight,
  max_reps: RECORD_TERMS.max_reps,
  max_set_volume: RECORD_TERMS.max_set_volume,
  max_duration: RECORD_TERMS.max_duration,
};
