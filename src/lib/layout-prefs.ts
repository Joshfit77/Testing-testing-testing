/**
 * Dashboard layout: the Home modules in the order a member sees them, and the Faith sections they can hide.
 *
 * The default order comes from the member's own onboarding answers (goal, experience, schedule), so a beginner, a
 * bodybuilder, a parent with twenty minutes and a runner each see what matters to them first, in one and the same
 * app. The member can reorder or hide modules from You → Customize Home; that choice is saved on the profile
 * (`layout_prefs`) so it follows them to every device. Nothing here is inferred from age: a safeguard for members
 * under 18 lives with the nutrition code, and "older adult" is not a thing the app guesses.
 */
import type { ExperienceLevel, PrimaryGoal } from "@/lib/domain/types";

export const HOME_MODULES = ["workout", "nutrition", "faith", "quick", "verse", "week", "sleep", "calendar"] as const;
export type HomeModule = (typeof HOME_MODULES)[number];

export const HOME_MODULE_LABELS: Record<HomeModule, { title: string; body: string }> = {
  workout: { title: "Today's workout", body: "Start or resume today's session" },
  nutrition: { title: "Today's nutrition", body: "Calories, protein and water, with quick logging" },
  faith: { title: "Faith today", body: "Continue reading, today's devotional and prayer" },
  quick: { title: "Quick actions", body: "Run, log food, AI Coach" },
  verse: { title: "Verse of the day", body: "Today's Scripture" },
  week: { title: "This week", body: "Workouts this week and My Progress" },
  sleep: { title: "Sleep & Recovery", body: "Last night, from your watch or by hand" },
  calendar: { title: "Training calendar", body: "Planned sessions, runs and rest days" },
};

export const FAITH_SECTIONS = ["today", "challenge", "practices", "journal", "themes", "devotionals", "reflection"] as const;
export type FaithSection = (typeof FAITH_SECTIONS)[number];

export const FAITH_SECTION_LABELS: Record<FaithSection, string> = {
  today: "Today (journey, challenge, fitness)",
  challenge: "40 Days Through the Narrow Gate",
  practices: "Daily practices",
  journal: "Prayer journal",
  themes: "Scripture by theme",
  devotionals: "Devotionals",
  reflection: "Verse of the day in full",
};

/** The Train hub's sections after today's workout (which always stays). */
export const TRAIN_SECTIONS = ["run", "programs", "exercises", "calendar", "tools"] as const;
export type TrainSection = (typeof TRAIN_SECTIONS)[number];
export const TRAIN_SECTION_LABELS: Record<TrainSection, { title: string; body: string }> = {
  run: { title: "Run & walk", body: "GPS runs and walks, running plans, records" },
  programs: { title: "Programs", body: "Your program and the library" },
  exercises: { title: "Exercises", body: "The library, with demonstrations and your history" },
  calendar: { title: "Training calendar", body: "Planned sessions, runs and rest days" },
  tools: { title: "More training tools", body: "Builder, history, My workouts, recovery, training review" },
};

/** The Nutrition tab's sections after the three logging buttons, the daily totals and the meals (which always stay). */
export const NUTRITION_SECTIONS = ["relog", "water", "budget", "nutrients", "week", "weight", "targets", "saved", "tools"] as const;
export type NutritionSection = (typeof NUTRITION_SECTIONS)[number];
export const NUTRITION_SECTION_LABELS: Record<NutritionSection, { title: string; body: string }> = {
  relog: { title: "Recent foods", body: "One tap logs a recent food again" },
  water: { title: "Water", body: "Glasses and the daily goal" },
  budget: { title: "Calories remaining & today's estimate", body: "What's left of today's budget" },
  nutrients: { title: "Nutrients", body: "Fiber, sugar and sodium" },
  week: { title: "This week & history", body: "Charts and daily history" },
  weight: { title: "Weight goal", body: "Bodyweight log and goal" },
  targets: { title: "Targets & calorie budget", body: "Your daily numbers" },
  saved: { title: "Saved meals, recipes & my foods", body: "Things you log often" },
  tools: { title: "More tools", body: "Nutrition Score, recipes, planner, grocery, insights, supplements, diet" },
};

export interface SectionPrefs<T extends string> {
  order?: T[];
  hidden?: T[];
}
export interface LayoutPrefs {
  home?: { order?: HomeModule[]; hidden?: HomeModule[] };
  faith?: { hidden?: FaithSection[] };
  train?: SectionPrefs<TrainSection>;
  nutrition?: SectionPrefs<NutritionSection>;
}

function sectionPrefs<T extends string>(raw: unknown, all: readonly T[]): SectionPrefs<T> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const keep = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => (all as readonly string[]).includes(x as string)))] : undefined);
  const order = keep(o.order);
  const hidden = keep(o.hidden);
  if (!order?.length && !hidden) return undefined;
  return { ...(order?.length ? { order } : {}), ...(hidden ? { hidden } : {}) };
}

/**
 * A tab's sections in the member's order (new sections appended in their default place) minus the hidden ones;
 * `always` can't be hidden.
 */
export function sectionLayout<T extends string>(all: readonly T[], prefs: SectionPrefs<T> | undefined, always: readonly T[] = []): T[] {
  const chosen = prefs?.order ?? [];
  const order = [...chosen.filter((m) => all.includes(m)), ...all.filter((m) => !chosen.includes(m))];
  const hidden = new Set(prefs?.hidden ?? []);
  return order.filter((m) => always.includes(m) || !hidden.has(m));
}

/**
 * Home modules that start hidden until the member turns them on in Customize Home. Quick actions (Run, Log food,
 * AI Coach) repeat the header and the nutrition card, so a new Home leaves them out; a member who has saved their
 * own Home layout keeps it exactly as saved.
 */
export const DEFAULT_HIDDEN_HOME: readonly HomeModule[] = ["quick"];

/**
 * The stored JSON, kept only where it is well-formed (anything else is treated as "no preference"). With no saved
 * hidden list for Home, the default hidden modules apply.
 */
export function parseLayoutPrefs(raw: unknown): LayoutPrefs {
  if (!raw || typeof raw !== "object") return { home: { hidden: [...DEFAULT_HIDDEN_HOME] } };
  const o = raw as Record<string, unknown>;
  const out: LayoutPrefs = {};
  const home = o.home as Record<string, unknown> | undefined;
  if (home && typeof home === "object") {
    const order = Array.isArray(home.order) ? home.order.filter((m): m is HomeModule => (HOME_MODULES as readonly string[]).includes(m as string)) : undefined;
    const hidden = Array.isArray(home.hidden) ? home.hidden.filter((m): m is HomeModule => (HOME_MODULES as readonly string[]).includes(m as string)) : undefined;
    out.home = { ...(order?.length ? { order: [...new Set(order)] } : {}), hidden: hidden ? [...new Set(hidden)] : [...DEFAULT_HIDDEN_HOME] };
  } else {
    out.home = { hidden: [...DEFAULT_HIDDEN_HOME] };
  }
  const faith = o.faith as Record<string, unknown> | undefined;
  if (faith && typeof faith === "object" && Array.isArray(faith.hidden)) {
    out.faith = { hidden: [...new Set(faith.hidden.filter((s): s is FaithSection => (FAITH_SECTIONS as readonly string[]).includes(s as string)))] };
  }
  const train = sectionPrefs(o.train, TRAIN_SECTIONS);
  if (train) out.train = train;
  const nutrition = sectionPrefs(o.nutrition, NUTRITION_SECTIONS);
  if (nutrition) out.nutrition = nutrition;
  return out;
}

export interface HomeProfile {
  goal: PrimaryGoal | null;
  experience: ExperienceLevel | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  faithEnabled: boolean;
  /** The existing "Scripture card on Home" setting: off hides the verse module. */
  homeScripture: boolean;
}

/**
 * The default Home order for a member, from their answers. Today's workout is always first: starting it is the one
 * thing Home is for. Then:
 * - every member: today's nutrition, then Faith;
 * - fat loss and general health: nutrition straight after the workout (the daily habit that matters most there);
 * - muscle and strength: sleep & recovery higher (recovery drives those goals);
 * - conditioning, athletic and combat sports: recovery higher;
 * - a short schedule (3 days or fewer at 30 minutes or less, the "busy parent" pattern): nutrition and Faith only,
 *   the rest further down;
 * - Faith switched off in onboarding: the Faith modules move last (never removed: Faith is always a tab).
 * Quick actions come last and start hidden (DEFAULT_HIDDEN_HOME); the header's Quick add covers them.
 */
export function defaultHomeOrder(p: HomeProfile): HomeModule[] {
  const busy = (p.daysPerWeek ?? 7) <= 3 && (p.sessionMinutes ?? 60) <= 30;
  let order: HomeModule[];
  if (busy) order = ["workout", "nutrition", "faith", "verse", "week", "calendar", "sleep"];
  else if (p.goal === "lose_fat" || p.goal === "general_health") order = ["workout", "nutrition", "faith", "verse", "week", "sleep", "calendar"];
  else if (p.goal === "build_muscle" || p.goal === "build_strength") order = ["workout", "nutrition", "sleep", "faith", "verse", "week", "calendar"];
  else if (p.goal === "improve_conditioning" || p.goal === "athletic_performance" || p.goal === "combat_sports") order = ["workout", "nutrition", "sleep", "faith", "verse", "week", "calendar"];
  else order = ["workout", "nutrition", "faith", "verse", "week", "sleep", "calendar"];
  if (!p.faithEnabled) order = [...order.filter((m) => m !== "faith" && m !== "verse"), "faith", "verse"];
  return [...order, "quick"];
}

/** The modules to show, in order: the member's own order (with any new modules appended), minus the hidden ones. */
export function homeLayout(p: HomeProfile, prefs: LayoutPrefs): HomeModule[] {
  const base = defaultHomeOrder(p);
  const chosen = prefs.home?.order ?? [];
  const order = [...chosen.filter((m) => base.includes(m)), ...base.filter((m) => !chosen.includes(m))];
  const hidden = new Set(prefs.home?.hidden ?? []);
  if (!p.homeScripture) hidden.add("verse");
  // Today's workout can't be hidden: it is the one thing the app is for, and Start lives there.
  return order.filter((m) => m === "workout" || !hidden.has(m));
}

/** Is a member under 18, from a birth year (null when unknown)? Used only for nutrition safeguards, never to limit training. */
export function isMinor(birthYear: number | null | undefined, now = new Date()): boolean {
  if (!birthYear) return false;
  return now.getUTCFullYear() - birthYear < 18;
}
