import {
  COMBINABLE_TYPES,
  CUSTOM_TYPES,
  weeksRange,
  type CustomProgramInput,
  type CustomProgramType,
} from "@/lib/domain/custom-programs";
import type { Equipment, ExperienceLevel, PrimaryGoal, UnitSystem } from "@/lib/domain/types";

/**
 * The program built automatically at the end of sign-up, from the onboarding answers. Each main goal maps
 * to one of the custom program types and one of its goals, then days and session length are fitted to
 * what that type supports.
 */
export const STARTER_PROGRAM: Record<PrimaryGoal, { type: CustomProgramType; goal: string }> = {
  build_strength: { type: "strength", goal: "get_stronger" },
  build_muscle: { type: "bodybuilding", goal: "mass" },
  lose_fat: { type: "bodybuilding", goal: "recomp" },
  improve_conditioning: { type: "cardio", goal: "endurance" },
  athletic_performance: { type: "speed", goal: "sport_speed" },
  combat_sports: { type: "mma", goal: "fight_shape" },
  general_health: { type: "strength", goal: "strength_size" },
  mobility: { type: "strength", goal: "get_stronger" },
};

/** Session length choices offered during onboarding. */
export const SESSION_MINUTES = [30, 45, 60, 75] as const;

export interface StarterAnswers {
  goal: PrimaryGoal;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  age: number;
  heightCm: number;
  bodyweightKg: number;
  equipment: Equipment[];
  units: UnitSystem;
  /** Optional second goal from onboarding (e.g. "run_5k"). */
  secondaryGoal?: string | null;
}

export function starterProgramInput(a: StarterAnswers): CustomProgramInput {
  const { type, goal } = STARTER_PROGRAM[a.goal];
  const cfg = CUSTOM_TYPES[type];
  const novice = a.experience === "new" || a.experience === "beginner";
  const daysPerWeek = Math.min(cfg.days.max, Math.max(cfg.days.min, Math.round(a.daysPerWeek)));
  const sessionMinutes = Math.min(90, Math.max(30, Math.round(a.sessionMinutes || cfg.defaultMinutes)));
  // A running or conditioning second goal becomes a combined week (two run days out of the days available) when
  // the starter is a strength or muscle program and there are at least four days to share.
  const combineGoal = a.secondaryGoal === "run_5k" ? "5k" : a.secondaryGoal === "improve_conditioning" ? "conditioning" : null;
  const combine = combineGoal && COMBINABLE_TYPES.includes(type) && Math.round(a.daysPerWeek) >= 4 ? { goal: combineGoal, days: 2 } as const : null;
  const weeksDefault = weeksRange(type, goal).default;
  return {
    type,
    goal,
    ...(combine ? { combine } : {}),
    experience: a.experience,
    daysPerWeek: combine ? Math.max(cfg.days.min, Math.min(cfg.days.max, Math.round(a.daysPerWeek) - 2)) : daysPerWeek,
    sessionMinutes,
    weeks: combine ? Math.min(16, Math.max(4, weeksDefault)) : weeksDefault,
    units: a.units,
    age: a.age,
    heightCm: a.heightCm,
    bodyweightKg: a.bodyweightKg,
    maxesKg: {},
    goalMaxesKg: {},
    cardio: cfg.cardioInput ? { modality: "run", continuousMinutes: novice ? 10 : 20 } : null,
    division: null,
    equipment: a.equipment,
  };
}
