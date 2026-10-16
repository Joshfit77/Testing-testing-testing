/**
 * Badges / achievements, computed purely from data the user already logs.
 * Nothing is stored: given aggregated stats, every badge's earned state, the date the
 * threshold was crossed (`earnedAt`) and progress (current/target) are derived here.
 *
 * All dates are ISO calendar dates (YYYY-MM-DD) in the user's time zone.
 * Weights are kilograms; conversion to the user's units happens only for display.
 */
import { addDays, startOfWeek } from "./dates";
import { dailyStreak, weeklyStreak } from "./streak";
import { KG_PER_LB } from "./units";

export type BadgeTier = "bronze" | "silver" | "gold";
export type BadgeCategory = "training" | "strength" | "consistency" | "nutrition" | "faith" | "milestones";
/** Lucide icon names; mapped to components in src/components/achievements/badge-icon.tsx. */
export type BadgeIconName =
  | "Dumbbell"
  | "Flame"
  | "Medal"
  | "Trophy"
  | "Crown"
  | "Sunrise"
  | "Zap"
  | "TrendingUp"
  | "Weight"
  | "CalendarCheck"
  | "CalendarRange"
  | "Utensils"
  | "Salad"
  | "BookOpen"
  | "NotebookPen"
  | "CheckCheck"
  | "ShieldCheck"
  | "Flag"
  | "Camera"
  | "Scale";

/** "kg" progress values are volume in kilograms (convert for display). */
export type BadgeUnit = "count" | "kg" | "weeks" | "days";

export const BADGE_CATEGORIES: { id: BadgeCategory; label: string }[] = [
  { id: "training", label: "Training" },
  { id: "strength", label: "Strength" },
  { id: "consistency", label: "Consistency" },
  { id: "nutrition", label: "Nutrition" },
  { id: "faith", label: "Faith & discipline" },
  { id: "milestones", label: "Milestones" },
];

export interface WorkoutEvent {
  sessionId: string;
  /** Local calendar date the workout started. */
  date: string;
  /** Local hour (0–23) the workout started. */
  startHour: number;
  volumeKg: number;
  /** ISO timestamp used for ordering. */
  startedAt: string;
}

export interface PrEvent {
  sessionId: string | null;
  exerciseId: string;
  recordType: string;
  /** ISO timestamp used for ordering. */
  achievedAt: string;
  /** Local calendar date. */
  date: string;
}

export interface AchievementStats {
  workouts: WorkoutEvent[];
  /** Raw personal_records rows (the first record per exercise/type is a baseline, not a PR). */
  prs: PrEvent[];
  /** Days with at least one logged food item. */
  foodDays: string[];
  journalDates: string[];
  disciplineDates: string[];
  weightDates: string[];
  /** Completion dates of finished programs. */
  programsCompleted: string[];
  /** Upload dates of progress photos. */
  photoDates: string[];
}

export const emptyStats = (): AchievementStats => ({
  workouts: [],
  prs: [],
  foodDays: [],
  journalDates: [],
  disciplineDates: [],
  weightDates: [],
  programsCompleted: [],
  photoDates: [],
});

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: BadgeIconName;
  tier: BadgeTier;
  category: BadgeCategory;
  unit: BadgeUnit;
  target: number;
}

export interface BadgeState extends BadgeDefinition {
  earned: boolean;
  earnedAt: string | null;
  /** Progress toward `target` (capped at target once earned). */
  current: number;
}

/** 1,000,000 lb expressed in kilograms (≈ 453,592.37 kg). */
export const MILLION_LB_KG = 1_000_000 * KG_PER_LB;
/** 100,000 lb expressed in kilograms (≈ 45,359.24 kg). */
export const HUNDRED_K_LB_KG = 100_000 * KG_PER_LB;

/** Hours (local, inclusive start / exclusive end) that count as an early-bird session. */
export const EARLY_BIRD_HOURS = { from: 4, to: 7 } as const;

interface Evaluation {
  current: number;
  earnedAt: string | null;
}

type Evaluator = (s: Derived, target: number, today: string) => Evaluation;

interface CatalogEntry extends BadgeDefinition {
  evaluate: Evaluator;
}

/** Pre-sorted / de-duplicated views of the stats shared by evaluators. */
interface Derived {
  workouts: WorkoutEvent[];
  workoutDates: string[];
  prMoments: string[];
  foodDays: string[];
  journalDates: string[];
  disciplineDates: string[];
  weightDates: string[];
  programsCompleted: string[];
  photoDates: string[];
}

const sortedDates = (dates: string[]) => [...dates].sort();
const distinctSorted = (dates: string[]) => [...new Set(dates)].sort();

/** Date of the n-th (1-based) item in an ascending list, or null. */
function nth(dates: string[], n: number): string | null {
  return dates[n - 1] ?? null;
}

const countBadge: (pick: (s: Derived) => string[]) => Evaluator = (pick) => (s, target) => {
  const list = pick(s);
  return { current: list.length, earnedAt: nth(list, target) };
};

/**
 * Real PRs only: the first record for an exercise/record type is a baseline, not a PR.
 * Several record types beaten on the same exercise in the same session count as one PR.
 * Returns the local date of each PR "moment", ascending.
 */
export function prMoments(prs: PrEvent[]): string[] {
  const ordered = [...prs].sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));
  const seenBaseline = new Set<string>();
  const moments = new Set<string>();
  const dates: string[] = [];
  for (const p of ordered) {
    const key = `${p.exerciseId}:${p.recordType}`;
    if (!seenBaseline.has(key)) {
      seenBaseline.add(key);
      continue;
    }
    const moment = `${p.sessionId ?? p.achievedAt}:${p.exerciseId}`;
    if (moments.has(moment)) continue;
    moments.add(moment);
    dates.push(p.date);
  }
  return dates;
}

/** Cumulative volume in kg, and the date the running total first reached `targetKg`. */
export function volumeProgress(workouts: WorkoutEvent[], targetKg: number): Evaluation {
  let total = 0;
  let earnedAt: string | null = null;
  for (const w of workouts) {
    total += Math.max(0, w.volumeKg);
    if (earnedAt === null && total >= targetKg - 1e-6) earnedAt = w.date;
  }
  return { current: total, earnedAt };
}

/**
 * First date on which a run of `target` consecutive Monday-weeks (each with ≥1 workout)
 * was completed — the date of the first workout in the target-th week.
 */
export function weeklyStreakEarnedAt(dates: string[], target: number): string | null {
  const firstInWeek = new Map<string, string>();
  for (const d of distinctSorted(dates)) {
    const w = startOfWeek(d);
    if (!firstInWeek.has(w)) firstInWeek.set(w, d);
  }
  let run = 0;
  let prev: string | null = null;
  for (const [week, first] of [...firstInWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    run = prev !== null && addDays(prev, 7) === week ? run + 1 : 1;
    prev = week;
    if (run >= target) return first;
  }
  return null;
}

/** First date on which `target` consecutive calendar days had an entry. */
export function dailyStreakEarnedAt(dates: string[], target: number): string | null {
  let run = 0;
  let prev: string | null = null;
  for (const d of distinctSorted(dates)) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run >= target) return d;
  }
  return null;
}

const weeklyStreakBadge: Evaluator = (s, target, today) => ({
  current: weeklyStreak(s.workoutDates, today, 1),
  earnedAt: weeklyStreakEarnedAt(s.workoutDates, target),
});

const disciplineStreakBadge: Evaluator = (s, target, today) => ({
  current: dailyStreak(s.disciplineDates, today),
  earnedAt: dailyStreakEarnedAt(s.disciplineDates, target),
});

const workoutCount: Evaluator = countBadge((s) => s.workouts.map((w) => w.date));

export const BADGE_CATALOG: CatalogEntry[] = [
  // Training
  { id: "first-workout", name: "First Step", description: "Complete your first workout.", icon: "Dumbbell", tier: "bronze", category: "training", unit: "count", target: 1, evaluate: workoutCount },
  { id: "workouts-10", name: "Showing Up", description: "Complete 10 workouts.", icon: "Flame", tier: "bronze", category: "training", unit: "count", target: 10, evaluate: workoutCount },
  { id: "workouts-25", name: "Committed", description: "Complete 25 workouts.", icon: "Medal", tier: "silver", category: "training", unit: "count", target: 25, evaluate: workoutCount },
  { id: "workouts-50", name: "Iron Habit", description: "Complete 50 workouts.", icon: "Trophy", tier: "silver", category: "training", unit: "count", target: 50, evaluate: workoutCount },
  { id: "workouts-100", name: "Centurion", description: "Complete 100 workouts.", icon: "Crown", tier: "gold", category: "training", unit: "count", target: 100, evaluate: workoutCount },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Start a workout between 4am and 7am.",
    icon: "Sunrise",
    tier: "bronze",
    category: "training",
    unit: "count",
    target: 1,
    evaluate: countBadge((s) => s.workouts.filter((w) => w.startHour >= EARLY_BIRD_HOURS.from && w.startHour < EARLY_BIRD_HOURS.to).map((w) => w.date)),
  },
  // Strength
  { id: "first-pr", name: "New Best", description: "Beat one of your own records.", icon: "Zap", tier: "bronze", category: "strength", unit: "count", target: 1, evaluate: countBadge((s) => s.prMoments) },
  { id: "prs-10", name: "Record Breaker", description: "Set 10 personal records.", icon: "TrendingUp", tier: "silver", category: "strength", unit: "count", target: 10, evaluate: countBadge((s) => s.prMoments) },
  { id: "prs-25", name: "Relentless", description: "Set 25 personal records.", icon: "TrendingUp", tier: "gold", category: "strength", unit: "count", target: 25, evaluate: countBadge((s) => s.prMoments) },
  {
    id: "volume-100k-lb",
    name: "Heavy Lifting",
    description: "Lift 100,000 lb (45,359 kg) of total volume.",
    icon: "Weight",
    tier: "silver",
    category: "strength",
    unit: "kg",
    target: HUNDRED_K_LB_KG,
    evaluate: (s, target) => volumeProgress(s.workouts, target),
  },
  {
    id: "volume-1m-lb",
    name: "Million Pound Club",
    description: "Lift 1,000,000 lb (453,592 kg) of total volume.",
    icon: "Crown",
    tier: "gold",
    category: "strength",
    unit: "kg",
    target: MILLION_LB_KG,
    evaluate: (s, target) => volumeProgress(s.workouts, target),
  },
  // Consistency
  { id: "streak-4w", name: "Four Strong Weeks", description: "Train at least once a week for 4 weeks in a row.", icon: "CalendarCheck", tier: "bronze", category: "consistency", unit: "weeks", target: 4, evaluate: weeklyStreakBadge },
  { id: "streak-12w", name: "Steadfast", description: "Train at least once a week for 12 weeks in a row.", icon: "CalendarRange", tier: "silver", category: "consistency", unit: "weeks", target: 12, evaluate: weeklyStreakBadge },
  { id: "streak-26w", name: "Unshaken", description: "Train at least once a week for 26 weeks in a row.", icon: "ShieldCheck", tier: "gold", category: "consistency", unit: "weeks", target: 26, evaluate: weeklyStreakBadge },
  // Nutrition
  { id: "food-7", name: "Fuel Tracker", description: "Log food on 7 different days.", icon: "Utensils", tier: "bronze", category: "nutrition", unit: "days", target: 7, evaluate: countBadge((s) => s.foodDays) },
  { id: "food-30", name: "Mindful Eater", description: "Log food on 30 different days.", icon: "Salad", tier: "silver", category: "nutrition", unit: "days", target: 30, evaluate: countBadge((s) => s.foodDays) },
  { id: "food-100", name: "Good Steward", description: "Log food on 100 different days.", icon: "Salad", tier: "gold", category: "nutrition", unit: "days", target: 100, evaluate: countBadge((s) => s.foodDays) },
  // Faith & discipline
  { id: "journal-1", name: "First Reflection", description: "Write your first journal entry.", icon: "BookOpen", tier: "bronze", category: "faith", unit: "count", target: 1, evaluate: countBadge((s) => s.journalDates) },
  { id: "journal-10", name: "Faithful Writer", description: "Write 10 journal entries.", icon: "NotebookPen", tier: "silver", category: "faith", unit: "count", target: 10, evaluate: countBadge((s) => s.journalDates) },
  { id: "discipline-7", name: "Seven Days Faithful", description: "Check in on a discipline goal 7 days in a row.", icon: "CheckCheck", tier: "silver", category: "faith", unit: "days", target: 7, evaluate: disciplineStreakBadge },
  { id: "discipline-30", name: "Rooted", description: "Check in on a discipline goal 30 days in a row.", icon: "ShieldCheck", tier: "gold", category: "faith", unit: "days", target: 30, evaluate: disciplineStreakBadge },
  // Milestones
  { id: "program-complete", name: "Finisher", description: "Complete a training program.", icon: "Flag", tier: "gold", category: "milestones", unit: "count", target: 1, evaluate: countBadge((s) => s.programsCompleted) },
  { id: "first-photo", name: "Snapshot", description: "Add your first progress photo.", icon: "Camera", tier: "bronze", category: "milestones", unit: "count", target: 1, evaluate: countBadge((s) => s.photoDates) },
  { id: "weigh-ins-10", name: "Know Your Numbers", description: "Log your bodyweight 10 times.", icon: "Scale", tier: "bronze", category: "milestones", unit: "count", target: 10, evaluate: countBadge((s) => s.weightDates) },
];

function derive(stats: AchievementStats): Derived {
  const workouts = [...stats.workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return {
    workouts,
    workoutDates: workouts.map((w) => w.date),
    prMoments: prMoments(stats.prs),
    foodDays: distinctSorted(stats.foodDays),
    journalDates: sortedDates(stats.journalDates),
    disciplineDates: distinctSorted(stats.disciplineDates),
    weightDates: sortedDates(stats.weightDates),
    programsCompleted: sortedDates(stats.programsCompleted),
    photoDates: sortedDates(stats.photoDates),
  };
}

/** Evaluate every badge in the catalog. */
export function computeAchievements(stats: AchievementStats, today: string): BadgeState[] {
  const d = derive(stats);
  return BADGE_CATALOG.map(({ evaluate, ...def }) => {
    const r = evaluate(d, def.target, today);
    const earned = r.earnedAt !== null;
    return { ...def, earned, earnedAt: r.earnedAt, current: earned ? def.target : Math.min(r.current, def.target) };
  });
}

/** Stats as they were before a given workout (its session and the PRs it set are removed). */
export function withoutSession(stats: AchievementStats, sessionId: string): AchievementStats {
  return {
    ...stats,
    workouts: stats.workouts.filter((w) => w.sessionId !== sessionId),
    prs: stats.prs.filter((p) => p.sessionId !== sessionId),
  };
}

/** Badges earned now that weren't earned before the given workout. */
export function badgesUnlockedBySession(stats: AchievementStats, sessionId: string, today: string): BadgeState[] {
  const before = new Set(computeAchievements(withoutSession(stats, sessionId), today).filter((b) => b.earned).map((b) => b.id));
  return computeAchievements(stats, today).filter((b) => b.earned && !before.has(b.id));
}

/** Progress toward a badge as a 0–100 percentage. */
export function badgePercent(b: Pick<BadgeState, "current" | "target" | "earned">): number {
  if (b.earned) return 100;
  return b.target > 0 ? Math.max(0, Math.min(100, (b.current / b.target) * 100)) : 0;
}

/** Local hour (0–23) of an instant in a time zone. */
export function localHour(iso: string, timeZone = "UTC"): number {
  const date = new Date(iso);
  try {
    const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(date);
    const n = Number.parseInt(h, 10);
    return Number.isFinite(n) ? n % 24 : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}
