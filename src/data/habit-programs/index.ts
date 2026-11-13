import type { HabitProgram } from "@/lib/domain/habit-programs";
import { FAITH_FITNESS_FOUNDATIONS } from "./faith-fitness-foundations";
import { HEALTHY_HABITS_90 } from "./healthy-habits-90";
import { MEAL_PREP_PROTEIN } from "./meal-prep-protein";
import { MUSCLE_GAIN_NUTRITION } from "./muscle-gain-nutrition";
import { NUTRITION_FOUNDATIONS } from "./nutrition-foundations";
import { STRENGTH_AND_SCRIPTURE } from "./strength-and-scripture";
import { SUSTAINABLE_FAT_LOSS } from "./sustainable-fat-loss";

/** Habit programs (nutrition, faith & fitness, lifestyle). Content is educational, not medical or dietetic advice. */
export const HABIT_PROGRAMS: HabitProgram[] = [
  NUTRITION_FOUNDATIONS,
  SUSTAINABLE_FAT_LOSS,
  MUSCLE_GAIN_NUTRITION,
  MEAL_PREP_PROTEIN,
  FAITH_FITNESS_FOUNDATIONS,
  STRENGTH_AND_SCRIPTURE,
  HEALTHY_HABITS_90,
].filter((p): p is HabitProgram => p !== null);

export function getHabitProgram(slug: string): HabitProgram | undefined {
  return HABIT_PROGRAMS.find((p) => p.slug === slug);
}
