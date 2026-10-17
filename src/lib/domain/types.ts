export const EQUIPMENT = [
  "bodyweight",
  "barbell",
  "dumbbell",
  "kettlebell",
  "bench",
  "rack",
  "pull_up_bar",
  "cable",
  "machine",
  "band",
  "box",
  "medicine_ball",
  "sled",
  "sandbag",
  "rower",
  "bike",
  "jump_rope",
  "heavy_bag",
  "mat",
  "landmine",
  "trap_bar",
  "battle_rope",
  "dip_station",
  "ab_wheel",
  "strongman_implements",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bodyweight: "Bodyweight",
  barbell: "Barbell & plates",
  dumbbell: "Dumbbells",
  kettlebell: "Kettlebells",
  bench: "Bench",
  rack: "Squat rack",
  pull_up_bar: "Pull-up bar",
  cable: "Cable machine",
  machine: "Selectorized machines",
  band: "Resistance bands",
  box: "Plyo box / step",
  medicine_ball: "Medicine ball",
  sled: "Sled",
  sandbag: "Sandbag",
  rower: "Rowing machine",
  bike: "Air / stationary bike",
  jump_rope: "Jump rope",
  heavy_bag: "Heavy bag",
  mat: "Mat",
  landmine: "Landmine",
  trap_bar: "Trap bar",
  battle_rope: "Battle rope",
  dip_station: "Dip station",
  ab_wheel: "Ab wheel",
  strongman_implements: "Strongman implements (log, yoke, stones)",
};

export const MOVEMENT_PATTERNS = [
  "squat",
  "hinge",
  "lunge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "core",
  "rotation",
  "carry",
  "power",
  "conditioning",
  "mobility",
  "isolation",
  "other",
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export type ExerciseCategory = "strength" | "conditioning" | "mobility" | "plyometric" | "cardio" | "core";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export const PRIMARY_GOALS = [
  "build_strength",
  "build_muscle",
  "lose_fat",
  "improve_conditioning",
  "athletic_performance",
  "combat_sports",
  "general_health",
  "mobility",
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  build_strength: "Build strength",
  build_muscle: "Build muscle",
  lose_fat: "Lose body fat",
  improve_conditioning: "Improve conditioning",
  athletic_performance: "Athletic performance",
  combat_sports: "Combat sports conditioning",
  general_health: "General health & longevity",
  mobility: "Mobility & flexibility",
};

export const EXPERIENCE_LEVELS = ["new", "beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  new: "Brand new to training",
  beginner: "Under 1 year",
  intermediate: "1–3 years",
  advanced: "3+ years",
};

export const PROGRAM_TYPES = [
  "strength",
  "powerlifting",
  "strongman",
  "hypertrophy",
  "athletic",
  "mma",
  "boxing",
  "grappling",
  "functional",
  "cardio",
  "low_impact",
  "home",
  "mobility",
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  strength: "General strength",
  powerlifting: "Powerlifting",
  strongman: "Strongman",
  hypertrophy: "Bodybuilding / hypertrophy",
  athletic: "Explosive athletic",
  mma: "MMA conditioning",
  boxing: "Boxing conditioning",
  grappling: "Wrestling & grappling",
  functional: "Functional conditioning",
  cardio: "Cardio & weight loss",
  low_impact: "Low-impact",
  home: "Home workouts",
  mobility: "Mobility & recovery",
};

export const DIETARY_PREFERENCES = [
  "no_preference",
  "vegetarian",
  "vegan",
  "pescatarian",
  "dairy_free",
  "gluten_free",
  "halal",
  "kosher",
] as const;
export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number];

export type UnitSystem = "imperial" | "metric";
export type Plan = "free" | "plus" | "pro";
