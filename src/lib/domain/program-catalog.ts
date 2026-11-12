/**
 * The program catalog: the spec's 13 browse categories, search and filters, equipment and completion text.
 * Pure (no React, no server imports) so the Programs page, the tests and the offline edition can share it.
 */
import { EQUIPMENT_LABELS, type Equipment, type PrimaryGoal, PRIMARY_GOALS, GOAL_LABELS } from "./types";

export const SPEC_CATEGORY_IDS = [
  "beginner",
  "strength",
  "big-three",
  "bodybuilding",
  "strongman",
  "combat",
  "functional",
  "athletic",
  "endurance",
  "home",
  "calisthenics",
  "active-aging",
  "mobility",
] as const;
export type SpecCategoryId = (typeof SPEC_CATEGORY_IDS)[number];

export interface SpecCategory {
  id: SpecCategoryId;
  label: string;
  /** Library category slugs (program_categories.slug) whose programs belong here. */
  categories: string[];
}

/** SPEC §5: the 13 categories that form the browse structure. Each library category maps to exactly one. */
export const SPEC_CATEGORIES: SpecCategory[] = [
  { id: "beginner", label: "Beginner & general fitness", categories: ["beginner"] },
  { id: "strength", label: "Strength & powerlifting", categories: ["strength", "womens-strength", "powerbuilding", "powerlifting"] },
  { id: "big-three", label: "Bench, squat & deadlift", categories: ["bench-press", "squat-specialization", "deadlift-specialization"] },
  { id: "bodybuilding", label: "Bodybuilding & muscle", categories: ["hypertrophy", "show-prep"] },
  { id: "strongman", label: "Strongman", categories: ["strongman"] },
  { id: "combat", label: "MMA, boxing & grappling", categories: ["mma-conditioning", "boxing-conditioning", "grappling-conditioning"] },
  { id: "functional", label: "Functional, circuits & intervals", categories: ["functional-conditioning", "weight-loss-cardio"] },
  { id: "athletic", label: "Speed, agility & power", categories: ["athletic-performance", "speed", "agility"] },
  { id: "endurance", label: "Endurance & hybrid", categories: ["cardiovascular", "hybrid-training"] },
  { id: "home", label: "Home, dumbbell, band & bodyweight", categories: ["home-workouts"] },
  { id: "calisthenics", label: "Calisthenics", categories: ["calisthenics"] },
  { id: "active-aging", label: "Active aging, seated & low-impact", categories: ["active-aging"] },
  { id: "mobility", label: "Mobility, warm-ups & recovery", categories: ["mobility-flexibility", "recovery-deload"] },
];

const BY_ID = new Map(SPEC_CATEGORIES.map((c) => [c.id, c]));
export function getSpecCategory(id: string | null | undefined): SpecCategory | undefined {
  return id ? BY_ID.get(id as SpecCategoryId) : undefined;
}

/** Equipment you can keep at home. A program using only these also shows under "Home". */
const HOME_EQUIPMENT = new Set<Equipment>(["bodyweight", "mat", "dumbbell", "kettlebell", "band", "bench", "pull_up_bar", "box", "jump_rope"]);

/** The spec categories a program appears in: its own, plus Home when everything it needs fits in a home. */
export function specCategoriesFor(p: { category: string | null; equipment: string[] }): SpecCategoryId[] {
  const own = SPEC_CATEGORIES.find((c) => p.category && c.categories.includes(p.category))?.id ?? "beginner";
  const out: SpecCategoryId[] = [own];
  const homeFriendly = p.equipment.length > 0 && p.equipment.every((e) => HOME_EQUIPMENT.has(e as Equipment));
  if (homeFriendly && own !== "home" && own !== "mobility") out.push("home");
  return out;
}

// --------------------------------------------------------------------------- Filters

/** "What do you have?" — a program matches when everything it needs is in the set. */
export const EQUIPMENT_FILTERS = [
  { id: "none", label: "No equipment", items: ["bodyweight", "mat"] },
  { id: "bar", label: "Pull-up bar / dip bars", items: ["bodyweight", "mat", "pull_up_bar", "dip_station", "band", "bench"] },
  { id: "bands", label: "Resistance bands", items: ["bodyweight", "mat", "band"] },
  { id: "dumbbells", label: "Dumbbells & bench", items: ["bodyweight", "mat", "dumbbell", "bench", "band"] },
  { id: "home", label: "Home gym (no barbell)", items: [...HOME_EQUIPMENT, "dip_station", "medicine_ball", "sandbag"] },
  { id: "barbell", label: "Barbell home gym", items: [...HOME_EQUIPMENT, "barbell", "rack", "trap_bar", "landmine", "dip_station"] },
] as const satisfies readonly { id: string; label: string; items: readonly Equipment[] }[];
export type EquipmentFilterId = (typeof EQUIPMENT_FILTERS)[number]["id"];

export const EXPERIENCE_FILTERS = ["beginner", "intermediate", "advanced"] as const;
/** "Up to N days a week." */
export const DAYS_FILTERS = [2, 3, 4, 5, 6] as const;
/** "Sessions up to N minutes." */
export const MINUTES_FILTERS = [30, 45, 60, 90] as const;
export const GOAL_FILTERS: { id: PrimaryGoal; label: string }[] = PRIMARY_GOALS.map((id) => ({ id, label: GOAL_LABELS[id] }));

export interface CatalogFilters {
  q?: string;
  category?: SpecCategoryId;
  goal?: PrimaryGoal;
  experience?: (typeof EXPERIENCE_FILTERS)[number];
  equipment?: EquipmentFilterId;
  days?: number;
  minutes?: number;
}

export interface CatalogProgram {
  slug: string;
  name: string;
  summary: string;
  difficulty: string;
  days_per_week: number;
  session_minutes: number;
  goals: string[];
  equipment: string[];
  /** Library category slug. */
  category: string | null;
  categoryName?: string | null;
}

const num = (v: unknown, allowed: readonly number[]) => {
  const n = Number(v);
  return allowed.includes(n) ? n : undefined;
};

/** Read filters from URL search params, dropping anything unknown. */
export function parseCatalogFilters(sp: Record<string, string | string[] | undefined>): CatalogFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const out: CatalogFilters = {};
  const q = one("q")?.slice(0, 60);
  if (q) out.q = q;
  const category = getSpecCategory(one("category"));
  if (category) out.category = category.id;
  const goal = one("goal");
  if (goal && (PRIMARY_GOALS as readonly string[]).includes(goal)) out.goal = goal as PrimaryGoal;
  const exp = one("experience");
  if (exp && (EXPERIENCE_FILTERS as readonly string[]).includes(exp)) out.experience = exp as CatalogFilters["experience"];
  const eq = one("equipment");
  if (eq && EQUIPMENT_FILTERS.some((f) => f.id === eq)) out.equipment = eq as EquipmentFilterId;
  const days = num(one("days"), DAYS_FILTERS);
  if (days) out.days = days;
  const minutes = num(one("minutes"), MINUTES_FILTERS);
  if (minutes) out.minutes = minutes;
  return out;
}

/** Back to a query string (stable order), e.g. for links that change one filter. */
export function catalogQuery(f: CatalogFilters): string {
  const params = new URLSearchParams();
  for (const k of ["q", "category", "goal", "experience", "equipment", "days", "minutes"] as const) {
    const v = f[k];
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(f: CatalogFilters): number {
  return (["goal", "experience", "equipment", "days", "minutes"] as const).filter((k) => f[k] !== undefined).length;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Every search word must prefix a word in the program's name, summary, category, equipment or goals. */
export function matchesSearch(p: CatalogProgram, q: string): boolean {
  const terms = words(q);
  if (!terms.length) return true;
  const hay = words(
    [
      p.name,
      p.summary,
      p.categoryName ?? "",
      ...specCategoriesFor(p).map((c) => BY_ID.get(c)!.label),
      ...p.equipment.map((e) => EQUIPMENT_LABELS[e as Equipment] ?? e),
      ...p.goals.filter((g) => !g.startsWith("type:")).map((g) => GOAL_LABELS[g as PrimaryGoal] ?? g),
      p.difficulty,
    ].join(" "),
  );
  return terms.every((t) => hay.some((h) => h.startsWith(t)));
}

export function filterCatalog<T extends CatalogProgram>(programs: T[], f: CatalogFilters): T[] {
  const equipment = f.equipment ? new Set<string>(EQUIPMENT_FILTERS.find((x) => x.id === f.equipment)!.items) : null;
  return programs.filter((p) => {
    if (f.category && !specCategoriesFor(p).includes(f.category)) return false;
    if (f.goal && !p.goals.includes(f.goal)) return false;
    if (f.experience && p.difficulty !== f.experience) return false;
    if (equipment && !p.equipment.every((e) => equipment.has(e))) return false;
    if (f.days && p.days_per_week > f.days) return false;
    if (f.minutes && p.session_minutes > f.minutes) return false;
    if (f.q && !matchesSearch(p, f.q)) return false;
    return true;
  });
}

// --------------------------------------------------------------------------- Equipment & completion

/** "Dumbbells, Bench and Resistance bands" (bodyweight is implied unless it's the only thing). */
export function equipmentSummary(equipment: string[]): string {
  const items = equipment.filter((e) => e !== "bodyweight" && e !== "mat");
  if (!items.length) return equipment.includes("mat") ? "No equipment (a mat helps)" : "No equipment";
  const labels = items.map((e) => EQUIPMENT_LABELS[e as Equipment] ?? e);
  return labels.length === 1 ? labels[0]! : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/** Share of scheduled sessions a program asks you to complete. */
export const COMPLETION_SHARE = 0.8;

export function requiredSessions(daysPerWeek: number, weeks: number): { total: number; required: number } {
  const total = Math.max(1, daysPerWeek * weeks);
  return { total, required: weeks <= 1 ? total : Math.ceil(total * COMPLETION_SHARE) };
}

/**
 * The completion requirement shown on every program. One-week session libraries ask for every session; longer
 * programs ask for 80% of the scheduled sessions, including the last week (where tests, races and meets sit).
 */
export function completionRequirement(p: { days_per_week: number; duration_weeks: number }, override?: string | null): string {
  if (override) return override;
  const { total, required } = requiredSessions(p.days_per_week, p.duration_weeks);
  if (p.duration_weeks <= 1) return `Complete all ${total} session${total === 1 ? "" : "s"}.`;
  return `Complete at least 80% of the ${total} sessions — ${required} or more — including the final week.`;
}
