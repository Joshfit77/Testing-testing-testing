import { DETAILS_BASE_A } from "./base-a";
import { DETAILS_BASE_B } from "./base-b";
import { DETAILS_BACK_BICEPS } from "./back-biceps";
import { DETAILS_CHEST_TRICEPS } from "./chest-triceps";
import { DETAILS_LEGS_MOBILITY } from "./legs-mobility";
import { DETAILS_SHOULDERS_CORE } from "./shoulders-core";
import type { ExerciseDetails } from "./types";

export * from "./types";

export const EXERCISE_DETAILS: Record<string, ExerciseDetails> = {
  ...DETAILS_BASE_A,
  ...DETAILS_BASE_B,
  ...DETAILS_CHEST_TRICEPS,
  ...DETAILS_BACK_BICEPS,
  ...DETAILS_SHOULDERS_CORE,
  ...DETAILS_LEGS_MOBILITY,
};

export function exerciseDetails(slug: string): ExerciseDetails | null {
  return EXERCISE_DETAILS[slug] ?? null;
}
