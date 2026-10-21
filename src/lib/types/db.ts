import type { Plan, UnitSystem } from "@/lib/domain/types";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
  unit_system: UnitSystem;
  birth_year: number | null;
  height_cm: number | null;
  sex: "male" | "female" | "unspecified" | null;
  faith_enabled: boolean;
  wellness_consent_at: string | null;
  onboarding_completed_at: string | null;
  timezone: string;
  step_goal: number;
  avatar_path: string | null;
  /** Added in 20261020000009_ui_prefs; optional so older rows/mocks still type-check. */
  text_size?: "default" | "large" | "xlarge";
  reduce_motion?: boolean;
  home_scripture?: boolean;
  rest_timer_sound?: boolean;
  rest_timer_vibrate?: boolean;
  created_at: string;
}

export interface OnboardingRow {
  user_id: string;
  primary_goal: string;
  experience: string;
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
  preferred_types: string[];
  limitations: string | null;
  dietary_preferences: string[];
  diet_type: string;
  goal_weight_kg: number | null;
  weekly_change_kg: number | null;
  activity_level: "sedentary" | "light" | "active" | "very_active" | null;
}

export interface ExerciseRow {
  id: string;
  slug: string;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  category: string;
  movement_pattern: string;
  mechanics: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  is_timed: boolean;
  low_impact: boolean;
  description: string;
  instructions: string[];
  form_cues: string[];
  common_mistakes: string[];
  is_published: boolean;
}

export interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category_id: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration_weeks: number;
  days_per_week: number;
  session_minutes: number;
  goals: string[];
  equipment: string[];
  tier: Plan;
  progression: string;
  warmup: string[];
  cooldown: string[];
  low_impact: boolean;
  needs_specialist_review: boolean;
  is_published: boolean;
  owner_id: string | null;
  source: "curated" | "starter" | "ai" | "custom";
}

export interface ProgramExerciseRow {
  id: string;
  day_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number;
  intensity: string | null;
  rpe: number | null;
  notes: string | null;
}

export interface UserProgramRow {
  id: string;
  user_id: string;
  program_id: string;
  status: "saved" | "active" | "paused" | "completed";
  current_week: number;
  current_day: number;
  started_at: string | null;
}

export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  client_id: string;
  user_program_id: string | null;
  program_day_id: string | null;
  name: string;
  status: "in_progress" | "completed" | "discarded";
  started_at: string;
  ended_at: string | null;
  paused_seconds: number;
  notes: string | null;
  total_volume_kg: number;
  draft: unknown;
  updated_at: string;
}

export interface FoodRow {
  id: string;
  owner_id: string | null;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  source: "custom" | "usda" | "curated";
  source_ref: string | null;
  is_estimate: boolean;
}
