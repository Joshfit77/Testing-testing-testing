/**
 * Structural audit of a program: weekly hard sets per muscle group, weekly frequency per main lift,
 * push:pull balance and an estimate of how long each session takes. Pure — used by
 * scripts/audit-programs.ts and by the program-library tests.
 */
import { EXERCISES } from "@/data/exercises";
import type { ProgramExerciseSeed, ProgramSeed } from "@/data/programs";
import { expandProgram, type ExpandedWeek } from "./program-expansion";
import { estimateSessionMinutes, framingMinutes, repsForTiming } from "./session-time";

export { estimateSessionMinutes, framingMinutes, repsForTiming, workSeconds } from "./session-time";

export const AUDIT_MUSCLES = ["chest", "back", "delts", "quads", "glutes_hams", "biceps", "triceps", "calves"] as const;
export type AuditMuscle = (typeof AUDIT_MUSCLES)[number];
/** Groups that hypertrophy programs should train with roughly 10–20 hard sets per week. */
export const MAJOR_AUDIT_MUSCLES: AuditMuscle[] = ["chest", "back", "delts", "quads", "glutes_hams"];

export const MAIN_LIFT_FAMILIES = {
  squat: ["back-squat", "front-squat", "pause-squat", "tempo-squat", "box-squat", "zercher-squat", "hack-squat"],
  bench: ["bench-press", "paused-bench-press", "close-grip-bench-press", "pin-press", "dumbbell-bench-press", "incline-dumbbell-press"],
  deadlift: ["conventional-deadlift", "sumo-deadlift", "trap-bar-deadlift", "deficit-deadlift", "block-pull"],
  press: ["overhead-press", "push-press", "log-press", "axle-clean-and-press", "seated-dumbbell-shoulder-press"],
} as const;
export type AuditLift = keyof typeof MAIN_LIFT_FAMILIES;

const MUSCLE_ALIASES: Record<string, AuditMuscle> = {
  chest: "chest",
  "upper chest": "chest",
  lats: "back",
  "upper back": "back",
  shoulders: "delts",
  "front delts": "delts",
  "front deltoids": "delts",
  "side delts": "delts",
  "side deltoids": "delts",
  "rear delts": "delts",
  "rear deltoids": "delts",
  quadriceps: "quads",
  glutes: "glutes_hams",
  hamstrings: "glutes_hams",
  biceps: "biceps",
  brachialis: "biceps",
  triceps: "triceps",
  calves: "calves",
  "calves (soleus)": "calves",
};

/** Exercise categories whose sets count as hard resistance-training sets. */
const COUNTED = new Set(["strength"]);
const BY_SLUG = new Map(EXERCISES.map((e) => [e.slug, e]));

/**
 * Fractional set counting (as in Pelland et al.'s volume meta-regression): a set counts 1 toward the
 * exercise's first listed primary muscle group and 0.5 toward any other primary group.
 */
export function setContribution(slug: string): Partial<Record<AuditMuscle, number>> {
  const e = BY_SLUG.get(slug);
  if (!e || !COUNTED.has(e.category) || e.pattern === "carry" || e.pattern === "core" || e.pattern === "mobility") return {};
  const out: Partial<Record<AuditMuscle, number>> = {};
  let first = true;
  for (const m of e.primary) {
    const g = MUSCLE_ALIASES[m];
    if (!g || out[g] !== undefined) continue;
    out[g] = first ? 1 : 0.5;
    first = false;
  }
  return out;
}

export interface AuditDay {
  name: string;
  minutes: number;
  estimatedMinutes: number;
  exercises: ProgramExerciseSeed[];
}
export interface AuditWeek {
  weekNumber: number;
  focus: string;
  isDeload: boolean;
  days: AuditDay[];
  setsByMuscle: Record<AuditMuscle, number>;
  liftFrequency: Record<AuditLift, number>;
  pushSets: number;
  pullSets: number;
}
export interface ProgramAudit {
  weeks: AuditWeek[];
  deloadWeeks: number[];
}

const PUSH = new Set(["horizontal_push", "vertical_push"]);
const PULL = new Set(["horizontal_pull", "vertical_pull"]);

/**
 * Dynamic-effort / speed sets (3 reps or fewer at under 70% of a max) are far from failure, so they
 * don't count as hard sets for hypertrophy.
 */
export function isSpeedWork(ex: Pick<ProgramExerciseSeed, "reps" | "intensity">): boolean {
  const pctMatch = ex.intensity?.match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*\d+(?:\.\d+)?\s*)?%/);
  const reps = repsForTiming(ex.reps);
  return Boolean(pctMatch && Number(pctMatch[1]) < 70 && reps !== null && reps <= 3);
}

export function auditWeek(week: ExpandedWeek): AuditWeek {
  const setsByMuscle = Object.fromEntries(AUDIT_MUSCLES.map((m) => [m, 0])) as Record<AuditMuscle, number>;
  const liftFrequency = { squat: 0, bench: 0, deadlift: 0, press: 0 } as Record<AuditLift, number>;
  let pushSets = 0;
  let pullSets = 0;
  for (const d of week.days) {
    for (const ex of d.exercises) {
      if (!isSpeedWork(ex)) for (const [m, f] of Object.entries(setContribution(ex.ex))) setsByMuscle[m as AuditMuscle] += f * ex.sets;
      const pattern = BY_SLUG.get(ex.ex)?.pattern ?? "";
      if (PUSH.has(pattern)) pushSets += ex.sets;
      if (PULL.has(pattern)) pullSets += ex.sets;
    }
    for (const lift of Object.keys(MAIN_LIFT_FAMILIES) as AuditLift[])
      if (d.exercises.some((e) => (MAIN_LIFT_FAMILIES[lift] as readonly string[]).includes(e.ex))) liftFrequency[lift] += 1;
  }
  return {
    weekNumber: week.weekNumber,
    focus: week.focus,
    isDeload: week.isDeload,
    days: week.days.map((d) => ({ name: d.name, minutes: d.minutes, estimatedMinutes: estimateSessionMinutes(d.exercises, framingMinutes(d.warmup, d.cooldown)), exercises: d.exercises })),
    setsByMuscle,
    liftFrequency,
    pushSets,
    pullSets,
  };
}

export function auditProgram(p: ProgramSeed): ProgramAudit {
  const weeks = expandProgram(p).map(auditWeek);
  return { weeks, deloadWeeks: weeks.filter((w) => w.isDeload).map((w) => w.weekNumber) };
}

/** Programs whose main goal is muscle growth (weekly-volume bounds apply to them). */
export function isHypertrophyProgram(p: Pick<ProgramSeed, "category" | "types" | "goals">): boolean {
  return ["hypertrophy", "show-prep", "powerbuilding"].includes(p.category) || (p.types[0] === "hypertrophy" && p.goals[0] === "build_muscle");
}

/**
 * How alike two programs are, 0–1: the Jaccard overlap of their first-week prescriptions (exercise, sets and
 * reps or time), discounted by a fifth unless they also share the schedule (days per week) and level. Barbell
 * programs share the same big lifts, so comparing exercises alone would flag plans that are loaded quite
 * differently. Used to keep near-identical plans with different names out of the library (SPEC §5).
 */
export function programSimilarity(a: ProgramSeed, b: ProgramSeed): number {
  const ex = (p: ProgramSeed) => new Set(expandProgram(p)[0]!.days.flatMap((d) => d.exercises.map((e) => `${e.ex}:${e.sets}x${e.reps ?? e.seconds}`)));
  const ea = ex(a);
  const eb = ex(b);
  const inter = [...ea].filter((x) => eb.has(x)).length;
  const jaccard = inter / (ea.size + eb.size - inter || 1);
  const sameShape = a.days.length === b.days.length && a.difficulty === b.difficulty;
  return sameShape ? jaccard : jaccard * 0.8;
}
