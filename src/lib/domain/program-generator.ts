import type { ProgramDaySeed, ProgramExerciseSeed, ProgramSeed } from "@/data/programs";
import { STANDARD_COOLDOWN, STANDARD_WARMUP } from "@/data/programs";
import { canAccessTier } from "./plans";
import type { Difficulty, Equipment, ExerciseCategory, ExperienceLevel, MovementPattern, Plan, PrimaryGoal, ProgramType } from "./types";

export interface CatalogExercise {
  slug: string;
  name: string;
  equipment: Equipment[];
  pattern: MovementPattern;
  category: ExerciseCategory;
  difficulty: Difficulty;
  timed?: boolean;
  lowImpact?: boolean;
}

export interface GeneratorAnswers {
  primary_goal: PrimaryGoal;
  experience: ExperienceLevel;
  days_per_week: number;
  session_minutes: number;
  equipment: Equipment[];
  preferred_types: ProgramType[];
}

/** Equipment that supports an exercise but isn't the main implement. */
const ACCESSORIES: Equipment[] = ["bench", "rack", "mat", "box"];

/**
 * An exercise is available when the user owns at least one of its main implements
 * (or it only needs bodyweight/accessories).
 */
export function isExerciseAvailable(ex: Pick<CatalogExercise, "equipment">, owned: Equipment[]): boolean {
  const have = new Set<Equipment>([...owned, "bodyweight", "mat"]);
  const main = ex.equipment.filter((e) => !ACCESSORIES.includes(e));
  if (main.length === 0) return ex.equipment.every((e) => have.has(e) || e === "box" || e === "bench");
  return main.some((e) => have.has(e));
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const EXPERIENCE_MAX: Record<ExperienceLevel, number> = { new: 0, beginner: 0, intermediate: 1, advanced: 2 };

type DayKind = "full" | "upper" | "lower" | "conditioning" | "mobility";

const DAY_SLOTS: Record<DayKind, MovementPattern[]> = {
  full: ["squat", "horizontal_push", "hinge", "horizontal_pull", "lunge", "core", "carry"],
  upper: ["horizontal_push", "vertical_pull", "vertical_push", "horizontal_pull", "isolation", "core"],
  lower: ["squat", "hinge", "lunge", "core", "isolation", "carry"],
  conditioning: ["conditioning", "power", "conditioning", "core", "conditioning", "carry"],
  mobility: ["mobility", "mobility", "mobility", "mobility", "mobility", "core"],
};

const DAY_NAMES: Record<DayKind, string> = {
  full: "Full Body",
  upper: "Upper Body",
  lower: "Lower Body",
  conditioning: "Conditioning",
  mobility: "Mobility & Recovery",
};

export function chooseSplit(answers: GeneratorAnswers): DayKind[] {
  const days = Math.min(6, Math.max(2, Math.round(answers.days_per_week)));
  if (answers.primary_goal === "mobility") {
    return Array.from({ length: days }, (_, i) => (i % 3 === 2 ? "full" : "mobility"));
  }
  const conditioningFocus =
    answers.primary_goal === "improve_conditioning" ||
    answers.primary_goal === "combat_sports" ||
    answers.preferred_types.some((t) => ["mma", "boxing", "grappling", "functional", "cardio"].includes(t));
  switch (days) {
    case 2:
      return ["full", "full"];
    case 3:
      return conditioningFocus ? ["full", "conditioning", "full"] : ["full", "full", "full"];
    case 4:
      return conditioningFocus ? ["upper", "lower", "conditioning", "full"] : ["upper", "lower", "upper", "lower"];
    case 5:
      return ["upper", "lower", "conditioning", "upper", "lower"];
    default:
      return ["upper", "lower", "conditioning", "upper", "lower", "mobility"];
  }
}

interface Scheme {
  sets: number;
  reps: string;
  rest: number;
  rpe: number;
}

function schemeFor(goal: PrimaryGoal, experience: ExperienceLevel, slotIndex: number): Scheme {
  const novice = experience === "new" || experience === "beginner";
  const primary = slotIndex < 2;
  let s: Scheme;
  switch (goal) {
    case "build_strength":
      s = primary ? { sets: 4, reps: "4-6", rest: 180, rpe: 7 } : { sets: 3, reps: "8-10", rest: 90, rpe: 7 };
      break;
    case "build_muscle":
      s = primary ? { sets: 4, reps: "6-10", rest: 120, rpe: 7.5 } : { sets: 3, reps: "10-15", rest: 75, rpe: 8 };
      break;
    case "athletic_performance":
      s = primary ? { sets: 4, reps: "3-5", rest: 150, rpe: 7 } : { sets: 3, reps: "6-8", rest: 90, rpe: 7 };
      break;
    case "lose_fat":
    case "improve_conditioning":
    case "combat_sports":
      s = { sets: 3, reps: "8-12", rest: 60, rpe: 7 };
      break;
    default:
      s = { sets: 3, reps: "8-12", rest: 75, rpe: 6.5 };
  }
  if (novice) {
    s = { ...s, sets: Math.min(s.sets, 3), rpe: Math.min(s.rpe, 6.5), reps: s.reps === "4-6" || s.reps === "3-5" ? "6-8" : s.reps };
  }
  return s;
}

const LOADED: Equipment[] = ["barbell", "dumbbell", "kettlebell", "trap_bar", "machine", "cable", "sandbag", "landmine"];

/** Prefer movements that match the user's experience and, for strength/muscle goals, external load. */
function candidateScore(e: CatalogExercise, answers: GeneratorAnswers, maxDifficulty: number, lowImpact: boolean): number {
  const gap = maxDifficulty - DIFFICULTY_RANK[e.difficulty];
  let score = gap === 0 ? 2 : gap === 1 ? 1 : 0;
  const loadGoal = ["build_strength", "build_muscle", "athletic_performance"].includes(answers.primary_goal);
  const owned = new Set(answers.equipment);
  if (loadGoal && e.equipment.some((x) => LOADED.includes(x) && owned.has(x))) score += 3;
  if (lowImpact && e.lowImpact) score += 2;
  return score;
}

function exercisesPerSession(minutes: number): number {
  return Math.min(7, Math.max(3, Math.round(minutes / 10)));
}

/**
 * Build a personalized starter program from onboarding answers. Deterministic so the same
 * answers always produce the same plan.
 */
export function buildStarterProgram(answers: GeneratorAnswers, catalog: CatalogExercise[]): ProgramSeed {
  const maxDifficulty = EXPERIENCE_MAX[answers.experience];
  const lowImpact = answers.preferred_types.includes("low_impact");
  const pool = catalog.filter(
    (e) =>
      isExerciseAvailable(e, answers.equipment) &&
      DIFFICULTY_RANK[e.difficulty] <= maxDifficulty &&
      (!lowImpact || e.lowImpact || (e.category !== "plyometric" && e.pattern !== "power")),
  );

  const split = chooseSplit(answers);
  const perSession = exercisesPerSession(answers.session_minutes);
  const usage = new Map<string, number>();
  const kindCounts = new Map<DayKind, number>();

  const days: ProgramDaySeed[] = split.map((kind) => {
    const occurrence = kindCounts.get(kind) ?? 0;
    kindCounts.set(kind, occurrence + 1);
    const slots = DAY_SLOTS[kind].slice(0, perSession);
    const chosen = new Set<string>();
    const exercises: ProgramExerciseSeed[] = [];

    slots.forEach((pattern, slotIndex) => {
      const candidates = pool
        .filter((e) => e.pattern === pattern && !chosen.has(e.slug))
        .map((e) => ({ e, score: candidateScore(e, answers, maxDifficulty, lowImpact) - 3 * (usage.get(e.slug) ?? 0) }))
        .sort((a, b) => b.score - a.score || a.e.slug.localeCompare(b.e.slug));
      if (candidates.length === 0) return;
      const pick = candidates[0]!.e;
      chosen.add(pick.slug);
      usage.set(pick.slug, (usage.get(pick.slug) ?? 0) + 1);

      if (pick.timed || kind === "mobility" || pick.pattern === "conditioning") {
        const seconds = kind === "mobility" ? 40 : pick.pattern === "conditioning" ? 30 : 30;
        exercises.push({
          ex: pick.slug,
          sets: kind === "conditioning" ? 4 : 2,
          seconds,
          rest: kind === "conditioning" ? 30 : 30,
        });
      } else if (pick.pattern === "power") {
        exercises.push({ ex: pick.slug, sets: 3, reps: "3-5", rest: 90, notes: "Stop the set if speed drops." });
      } else {
        const s = schemeFor(answers.primary_goal, answers.experience, slotIndex);
        exercises.push({ ex: pick.slug, sets: s.sets, reps: pick.pattern === "core" ? "8-12" : s.reps, rest: s.rest, rpe: s.rpe });
      }
    });

    const suffix = (kindCounts.get(kind) ?? 1) > 1 || split.filter((k) => k === kind).length > 1 ? ` ${String.fromCharCode(65 + occurrence)}` : "";
    return {
      name: `${DAY_NAMES[kind]}${suffix}`,
      focus: kind === "conditioning" ? "Work capacity" : kind === "mobility" ? "Move well" : "Strength",
      minutes: answers.session_minutes,
      exercises,
    };
  });

  const novice = answers.experience === "new" || answers.experience === "beginner";
  const weeks = novice ? 4 : 6;
  const model =
    answers.primary_goal === "build_strength" || answers.primary_goal === "athletic_performance"
      ? "linear_rpe"
      : answers.primary_goal === "improve_conditioning" || answers.primary_goal === "combat_sports"
        ? "density"
        : answers.primary_goal === "mobility"
          ? "steady"
          : "volume_wave";

  const equipmentUsed = [...new Set(days.flatMap((d) => d.exercises.flatMap((e) => catalog.find((c) => c.slug === e.ex)?.equipment ?? [])))]
    .filter((e) => answers.equipment.includes(e) || e === "bodyweight");

  return {
    slug: "starter",
    name: "Your Starter Program",
    summary: `${split.length} sessions per week, about ${answers.session_minutes} minutes each, built around your goals and equipment.`,
    description:
      "Generated from your onboarding answers. It favors exercises that match your equipment and experience. Swap any exercise " +
      "for an alternative, skip anything that causes pain, and update your answers at any time to rebuild it.",
    category: novice ? "beginner" : "strength",
    types: answers.preferred_types,
    difficulty: novice ? "beginner" : answers.experience === "advanced" ? "advanced" : "intermediate",
    weeks,
    sessionMinutes: answers.session_minutes,
    goals: [answers.primary_goal],
    equipment: equipmentUsed,
    tier: "free",
    lowImpact,
    progression:
      model === "linear_rpe"
        ? "Add a small amount of weight when you complete all reps at or below the target RPE. The final week is a deload."
        : model === "density"
          ? "Each week, add a round or trim rest by 10 seconds while keeping quality high. The final week is a deload."
          : model === "steady"
            ? "Increase hold times or reps gradually as movements feel easier."
            : "Add reps within the range each week; once you reach the top of the range on every set, add load. The final week is a deload.",
    progressionModel: model,
    deloadFinalWeek: model !== "steady",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days,
  };
}

export interface ProgramRecommendation {
  slug: string;
  score: number;
  reasons: string[];
  locked: boolean;
}

/** Rank library programs against a user's answers. Locked programs are still returned (marked). */
export function recommendPrograms(
  answers: GeneratorAnswers,
  programs: Pick<ProgramSeed, "slug" | "goals" | "types" | "equipment" | "difficulty" | "tier" | "days" | "lowImpact">[],
  plan: Plan,
): ProgramRecommendation[] {
  const maxDifficulty = EXPERIENCE_MAX[answers.experience];
  const owned = new Set<Equipment>([...answers.equipment, "bodyweight", "mat"]);
  return programs
    .map((p) => {
      let score = 0;
      const reasons: string[] = [];
      if (p.goals.includes(answers.primary_goal)) {
        score += 4;
        reasons.push("Matches your primary goal");
      }
      const typeMatches = p.types.filter((t) => answers.preferred_types.includes(t));
      if (typeMatches.length) {
        score += 2 * typeMatches.length;
        reasons.push("Fits your preferred training style");
      }
      const mainEquipment = p.equipment.filter((e) => !ACCESSORIES.includes(e) && e !== "bodyweight");
      const missing = mainEquipment.filter((e) => !owned.has(e));
      if (mainEquipment.length === 0 || missing.length === 0) {
        score += 2;
        reasons.push("Works with your equipment");
      } else {
        score -= Math.min(4, missing.length * 1.5);
      }
      const diff = DIFFICULTY_RANK[p.difficulty] - maxDifficulty;
      if (diff <= 0) score += 1;
      else score -= 2 * diff;
      if (p.days.length <= answers.days_per_week) {
        score += 1;
        reasons.push(`${p.days.length} sessions per week fits your schedule`);
      }
      if (p.lowImpact && answers.preferred_types.includes("low_impact")) score += 2;
      return { slug: p.slug, score: Math.round(score * 10) / 10, reasons, locked: !canAccessTier(plan, p.tier) };
    })
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
}
