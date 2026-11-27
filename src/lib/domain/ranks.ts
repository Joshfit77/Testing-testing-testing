/**
 * The 27 rank badges: nine each for Fitness (strength & discipline), Food (fuel & nourishment) and Faith
 * (growth & fruitfulness).
 *
 * Ranks are derived from the person's own saved activity, exactly like the existing badges in
 * achievements.ts: nothing is "awarded" or stored. So:
 *   - nothing can be reset by an update, and a rank shows the same on every device;
 *   - repeated or duplicated events can't award a rank twice (each rank counts distinct items or days);
 *   - nobody can grant themselves a rank except by logging the activity itself, which row level security
 *     limits to their own account.
 *
 * Every rank counts totals, never streaks, so rest days, recovery, illness or disability never take a rank
 * away or block one. Faith ranks count the days someone took part (a devotional, a daily practice or a
 * journal entry). They mark participation, never spiritual maturity, worth or standing before God.
 *
 * Thresholds: Fitness reuses the existing workout badges (1, 10, 25, 50, 100) and Food reuses the
 * existing food-logging badges (7, 30, 100). The other steps are proposals, documented in docs/BADGES.md.
 */

export type RankCategory = "fitness" | "food" | "faith";
export type RankLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface RankDefinition {
  category: RankCategory;
  level: RankLevel;
  name: string;
  /** Scripture reference shown with the badge (text comes from the BSB file). */
  reference: string;
  /** Short theme line from the badge design, not a quotation. */
  theme: string;
  /** How many workouts / days are needed. */
  threshold: number;
}

export interface RankCategoryInfo {
  id: RankCategory;
  label: string;
  subtitle: string;
  /** What is counted, singular / plural ("workout", "workouts"). */
  unit: [string, string];
  /** One sentence on what counts. */
  counts: string;
}

export const RANK_CATEGORIES: RankCategoryInfo[] = [
  {
    id: "fitness",
    label: "Fitness",
    subtitle: "Strength · Discipline · Perseverance",
    unit: ["workout", "workouts"],
    counts: "Every completed workout counts. Rest days never set you back.",
  },
  {
    id: "food",
    label: "Food",
    subtitle: "Fuel · Discipline · Nourishment",
    unit: ["day logged", "days logged"],
    counts: "Each day you log food counts once, however many meals you add.",
  },
  {
    id: "faith",
    label: "Faith",
    subtitle: "Growth · Rooted · Fruitfulness",
    unit: ["day", "days"],
    counts: "Each day you read the devotional, check off a daily practice or write in your journal counts once. Your journal stays private.",
  },
];

const R = (category: RankCategory, level: RankLevel, name: string, reference: string, theme: string, threshold: number): RankDefinition => ({
  category,
  level,
  name,
  reference,
  theme,
  threshold,
});

export const RANKS: RankDefinition[] = [
  R("fitness", 1, "Foundation", "Matthew 7:24–25", "Build on the rock.", 1),
  R("fitness", 2, "Faithful", "Luke 16:10", "Faithful in small things.", 10),
  R("fitness", 3, "Endurance", "James 1:12", "Persevere through trials.", 25),
  R("fitness", 4, "Disciplined", "1 Corinthians 9:25–27", "Train with purpose.", 50),
  R("fitness", 5, "Refined", "1 Peter 1:6–7", "Refined through challenges.", 100),
  R("fitness", 6, "Steadfast", "1 Corinthians 15:58", "Remain immovable.", 150),
  R("fitness", 7, "Overcomer", "Romans 8:37", "Victory through Christ.", 250),
  R("fitness", 8, "Mighty", "Ephesians 6:10", "Strong in the Lord.", 400),
  R("fitness", 9, "Conqueror", "Romans 8:37", "More than conquerors.", 600),

  R("food", 1, "Spark", "Proverbs 23:20–21", "A small beginning.", 1),
  R("food", 2, "Ember", "Ecclesiastes 10:18", "Consistency matters.", 7),
  R("food", 3, "Flame", "Romans 12:11", "Keep the fire burning.", 14),
  R("food", 4, "Torch", "2 Timothy 1:6", "Fan into flame.", 30),
  R("food", 5, "Blaze", "Leviticus 6:12", "A continual fire.", 60),
  R("food", 6, "Furnace", "Daniel 3:17", "Faithful in any circumstance.", 100),
  R("food", 7, "Forge", "Proverbs 27:17", "Iron sharpens iron.", 180),
  R("food", 8, "Inferno", "Jeremiah 20:9", "A fire in my bones.", 270),
  R("food", 9, "Phoenix", "Isaiah 40:31", "Renewed strength.", 365),

  R("faith", 1, "Seed", "Mark 4:26", "The beginning of growth.", 1),
  R("faith", 2, "Sprout", "1 Peter 2:2", "Desire the pure milk.", 7),
  R("faith", 3, "Sapling", "Psalm 1:3", "Planted by streams.", 14),
  R("faith", 4, "Root", "Colossians 2:7", "Being rooted in Him.", 30),
  R("faith", 5, "Branch", "John 15:5", "Abide in the vine.", 50),
  R("faith", 6, "Vine", "John 15:1", "Remain and grow.", 80),
  R("faith", 7, "Fruit", "Galatians 5:22–23", "Bearing fruit in every good work.", 120),
  R("faith", 8, "Olive", "Psalm 52:8", "Flourish like an olive tree.", 180),
  R("faith", 9, "Cedar", "Psalm 92:12", "The righteous grow like a cedar in Lebanon.", 365),
];

export interface RankState extends RankDefinition {
  earned: boolean;
  /** Local date the threshold was reached (YYYY-MM-DD), when earned. */
  earnedAt: string | null;
}

export interface CategoryProgress {
  category: RankCategory;
  /** Distinct workouts or days counted so far. */
  count: number;
  ranks: RankState[];
  /** Highest earned rank, or null before the first. */
  current: RankState | null;
  next: RankState | null;
  /** 0–100 progress from the current rank's threshold to the next one. */
  percentToNext: number;
}

export interface RankInputs {
  /** One local date per completed workout (repeats allowed: two workouts on a day count twice). */
  workoutDates: string[];
  /** Days with at least one logged food item. */
  foodDays: string[];
  /** Days with any faith participation (devotional, practice or journal). */
  faithDays: string[];
}

/** Distinct, sorted days. */
function uniqueDays(days: string[]): string[] {
  return [...new Set(days)].sort();
}

/** The date of the n-th item in a sorted list (1-based), or null when there aren't that many. */
function nthDate(sorted: string[], n: number): string | null {
  return n >= 1 && sorted.length >= n ? sorted[n - 1]! : null;
}

export function categoryProgress(category: RankCategory, inputs: RankInputs): CategoryProgress {
  const dates =
    category === "fitness" ? [...inputs.workoutDates].sort() : uniqueDays(category === "food" ? inputs.foodDays : inputs.faithDays);
  const count = dates.length;
  const ranks: RankState[] = RANKS.filter((r) => r.category === category).map((r) => {
    const earnedAt = nthDate(dates, r.threshold);
    return { ...r, earned: earnedAt !== null, earnedAt };
  });
  const earned = ranks.filter((r) => r.earned);
  const current = earned.length ? earned[earned.length - 1]! : null;
  const next = ranks.find((r) => !r.earned) ?? null;
  const from = current?.threshold ?? 0;
  const percentToNext = next ? Math.max(0, Math.min(100, Math.round(((count - from) / (next.threshold - from)) * 100))) : 100;
  return { category, count, ranks, current, next, percentToNext };
}

export function allRankProgress(inputs: RankInputs): CategoryProgress[] {
  return RANK_CATEGORIES.map((c) => categoryProgress(c.id, inputs));
}

/** Ranks reached on `date` (used to celebrate a new rank once, on the day it happens). */
export function ranksEarnedOn(progress: CategoryProgress[], date: string): RankState[] {
  return progress.flatMap((p) => p.ranks.filter((r) => r.earnedAt === date));
}
