/**
 * Extra teaching detail for each exercise, kept beside the catalog (src/data/exercises.ts) so the catalog's seed rows
 * and stable ids are untouched. Every exercise must have an entry (tests/unit/exercise-library.test.ts).
 *
 * Written for general fitness education from standard strength-training references (NSCA Essentials of Strength
 * Training and Conditioning; ACSM's Guidelines for Exercise Testing and Prescription; ExRx.net technique pages).
 * It is not medical advice and makes no injury-prevention claims.
 */
export const LIBRARY_GROUPS = ["chest", "back", "shoulders", "biceps", "triceps", "quads_glutes", "hamstrings_calves", "core", "functional", "mobility"] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

export const LIBRARY_GROUP_LABELS: Record<LibraryGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads_glutes: "Quads & glutes",
  hamstrings_calves: "Hamstrings & calves",
  core: "Core & abs",
  functional: "Functional & athletic",
  mobility: "Mobility & recovery",
};

export interface ExerciseDetails {
  /** The one library group the exercise is listed under (its main target). */
  group: LibraryGroup;
  /** Other names people search for ("RDL", "skull crusher"). Lowercase is fine; no duplicates of the name itself. */
  aliases: string[];
  /** The starting position in one or two sentences. */
  start: string;
  /** When to breathe in and out (or "breathe steadily" for holds and conditioning). */
  breathing: string;
  /** How far to move: where the rep starts and ends, and what limits it. */
  rangeOfMotion: string;
  /** Setup and equipment considerations: safeties, bench angle, cable height, footwear, spotter, etc. 1–3 items. */
  setup: string[];
  /** Can be done at home with little or no equipment (bodyweight, dumbbells, kettlebell or bands only). */
  home: boolean;
}
