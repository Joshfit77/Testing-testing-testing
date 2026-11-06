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

export interface LayoutPrefs {
  home?: { order?: HomeModule[]; hidden?: HomeModule[] };
  faith?: { hidden?: FaithSection[] };
}

/** The stored JSON, kept only where it is well-formed (anything else is treated as "no preference"). */
export function parseLayoutPrefs(raw: unknown): LayoutPrefs {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: LayoutPrefs = {};
  const home = o.home as Record<string, unknown> | undefined;
  if (home && typeof home === "object") {
    const order = Array.isArray(home.order) ? home.order.filter((m): m is HomeModule => (HOME_MODULES as readonly string[]).includes(m as string)) : undefined;
    const hidden = Array.isArray(home.hidden) ? home.hidden.filter((m): m is HomeModule => (HOME_MODULES as readonly string[]).includes(m as string)) : undefined;
    out.home = { ...(order?.length ? { order: [...new Set(order)] } : {}), ...(hidden ? { hidden: [...new Set(hidden)] } : {}) };
  }
  const faith = o.faith as Record<string, unknown> | undefined;
  if (faith && typeof faith === "object" && Array.isArray(faith.hidden)) {
    out.faith = { hidden: [...new Set(faith.hidden.filter((s): s is FaithSection => (FAITH_SECTIONS as readonly string[]).includes(s as string)))] };
  }
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
 * The default Home order for a member, from their answers:
 * - every member: today's workout, then today's nutrition, then Faith, then quick actions;
 * - fat loss and general health: nutrition first (the daily habit that matters most for that goal);
 * - muscle and strength: workout, nutrition, sleep & recovery higher (recovery drives those goals);
 * - conditioning, athletic and combat sports: workout, quick actions (the run is one tap), recovery;
 * - a short schedule (3 days or fewer at 30 minutes or less, the "busy parent" pattern): workout and quick actions
 *   first, so the fast paths are on the first screen;
 * - Faith switched off in onboarding: the Faith modules move last (never removed: Faith is always a tab).
 */
export function defaultHomeOrder(p: HomeProfile): HomeModule[] {
  const busy = (p.daysPerWeek ?? 7) <= 3 && (p.sessionMinutes ?? 60) <= 30;
  let order: HomeModule[];
  if (busy) order = ["workout", "quick", "nutrition", "faith", "verse", "week", "calendar", "sleep"];
  else if (p.goal === "lose_fat" || p.goal === "general_health") order = ["nutrition", "workout", "faith", "quick", "verse", "week", "sleep", "calendar"];
  else if (p.goal === "build_muscle" || p.goal === "build_strength") order = ["workout", "nutrition", "sleep", "faith", "quick", "verse", "week", "calendar"];
  else if (p.goal === "improve_conditioning" || p.goal === "athletic_performance" || p.goal === "combat_sports") order = ["workout", "quick", "nutrition", "sleep", "faith", "verse", "week", "calendar"];
  else order = ["workout", "nutrition", "faith", "quick", "verse", "week", "sleep", "calendar"];
  if (!p.faithEnabled) order = [...order.filter((m) => m !== "faith" && m !== "verse"), "faith", "verse"];
  return order;
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
