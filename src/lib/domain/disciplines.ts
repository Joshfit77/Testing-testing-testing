/**
 * Training disciplines: how program styles and library categories are grouped on the Train pages.
 * Pure data (no React, no server imports) so the web app and the offline edition can share it.
 * Slugs and ids referenced here are stable — saved programs point at them.
 */
import type { CustomProgramType } from "./custom-programs";

export const DISCIPLINE_IDS = ["strength", "strongman", "physique", "combat", "endurance", "speed_agility", "general"] as const;
export type DisciplineId = (typeof DISCIPLINE_IDS)[number];

export interface Discipline {
  id: DisciplineId;
  label: string;
  /** One line: who the discipline is for. */
  whoFor: string;
  /** One line: what a typical training week looks like. */
  typicalWeek: string;
  /** "Build my program" styles in this discipline, in display order. */
  customTypes: CustomProgramType[];
  /** Library category slugs (program_categories.slug) in this discipline, in display order. */
  categories: string[];
}

export const DISCIPLINES: Discipline[] = [
  {
    id: "strength",
    label: "Strength & Powerlifting",
    whoFor: "Lifters who want a bigger squat, bench, deadlift and press — from first barbell sessions to meet day.",
    typicalWeek: "3–5 sessions built around the main lifts at set percentages or RPE, with planned deloads and a peak when you need one.",
    customTypes: ["strength", "powerlifting", "bench", "squat", "deadlift"],
    categories: ["strength", "womens-strength", "powerbuilding", "powerlifting", "bench-press", "squat-specialization", "deadlift-specialization"],
  },
  {
    id: "strongman",
    label: "Strongman",
    whoFor: "Competitors and anyone chasing brute, real-world strength — with or without strongman implements.",
    typicalWeek: "Max-effort overhead and deadlift days, a squat day and 1–2 event days: yoke, farmer's, stones and drags by distance.",
    customTypes: ["strongman"],
    categories: ["strongman"],
  },
  {
    id: "physique",
    label: "Bodybuilding & Physique",
    whoFor: "Anyone building muscle, from recreational lifters to bodybuilding, physique, figure, bikini and wellness competitors.",
    typicalWeek: "Upper/lower, push/pull/legs or body-part splits with 10–20 hard sets per muscle per week; show prep adds cardio, steps and posing.",
    customTypes: ["bodybuilding", "show_prep"],
    categories: ["hypertrophy", "show-prep"],
  },
  {
    id: "combat",
    label: "Combat Sports",
    whoFor: "MMA fighters, boxers, kickboxers, wrestlers and grapplers who already train skills and spar.",
    typicalWeek: "2–3 low-soreness S&C sessions around skills work — strength, power, sprints, intervals and fight-length rounds — tapering into fight week.",
    customTypes: ["mma"],
    categories: ["mma-conditioning", "boxing-conditioning", "grappling-conditioning"],
  },
  {
    id: "endurance",
    label: "Endurance & Conditioning",
    whoFor: "New runners, endurance athletes and anyone training for heart health, work capacity or fat loss.",
    typicalWeek: "Mostly easy zone 2 sessions plus one or two harder interval days, with strength circuits to keep muscle.",
    customTypes: ["cardio"],
    categories: ["cardiovascular", "weight-loss-cardio", "functional-conditioning"],
  },
  {
    id: "speed_agility",
    label: "Speed & Agility",
    whoFor: "Field, court and combat athletes who need to accelerate, sprint, cut and react faster.",
    typicalWeek: "2–4 fresh sessions: sprints and jumps with full rest, change-of-direction drills and a strength/power day.",
    customTypes: ["speed", "agility"],
    categories: ["athletic-performance", "speed", "agility"],
  },
  {
    id: "general",
    label: "General Fitness",
    whoFor: "Beginners, home trainees, active agers and anyone after health, mobility and a consistent habit.",
    typicalWeek: "2–4 approachable full-body sessions, home-friendly options, mobility work and planned recovery weeks.",
    customTypes: [],
    categories: ["beginner", "home-workouts", "active-aging", "mobility-flexibility", "recovery-deload"],
  },
];

const BY_ID = new Map(DISCIPLINES.map((d) => [d.id, d]));

export function getDiscipline(id: string | null | undefined): Discipline | undefined {
  return id ? BY_ID.get(id as DisciplineId) : undefined;
}

/** The discipline a library category belongs to (General Fitness for anything unmapped). */
export function disciplineForCategory(slug: string | null | undefined): Discipline {
  return DISCIPLINES.find((d) => slug && d.categories.includes(slug)) ?? BY_ID.get("general")!;
}

/** The discipline a "Build my program" style belongs to. */
export function disciplineForCustomType(type: CustomProgramType): Discipline {
  return DISCIPLINES.find((d) => d.customTypes.includes(type))!;
}

/** Group items by discipline, keeping discipline order and dropping empty groups. */
export function groupByDiscipline<T>(items: T[], disciplineOf: (item: T) => Discipline): { discipline: Discipline; items: T[] }[] {
  return DISCIPLINES.map((discipline) => ({ discipline, items: items.filter((i) => disciplineOf(i).id === discipline.id) })).filter((g) => g.items.length > 0);
}

const DIFFICULTY_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Library order inside a discipline: beginner → intermediate → advanced, then by the discipline's
 * category order, then by name — so newcomers see the right starting point first.
 */
export function compareLibraryPrograms(
  a: { category: string | null | undefined; difficulty: string; name: string },
  b: { category: string | null | undefined; difficulty: string; name: string },
): number {
  const byDifficulty = (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9);
  if (byDifficulty) return byDifficulty;
  const da = disciplineForCategory(a.category);
  const db = disciplineForCategory(b.category);
  if (da.id !== db.id) return DISCIPLINES.indexOf(da) - DISCIPLINES.indexOf(db);
  const byCategory = da.categories.indexOf(a.category ?? "") - db.categories.indexOf(b.category ?? "");
  return byCategory || a.name.localeCompare(b.name);
}
