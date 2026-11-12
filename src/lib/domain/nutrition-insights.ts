import type { MacroKey } from "./food-basis";

/**
 * Weekly nutrition summary (SPEC §8): per-day calories and macros against the target, an average over
 * the days that were actually logged, and the foods that supplied the most protein and calories.
 *
 * A day is one of:
 * - "not_logged": nothing logged and not marked as a day you ate nothing. It is left out of averages.
 * - "logged_zero": marked "I ate nothing" (a fast), or only zero-calorie entries. It counts as 0.
 * - "logged": food was logged.
 * Days can also be marked complete; logged days that aren't are labelled "may be incomplete".
 */

export type DayMark = "complete" | "fasted";
export type DayState = "not_logged" | "logged_zero" | "logged";

export interface InsightItem {
  date: string;
  name: string;
  /** Stable source key when there is one ("usda:…", "recipe:…"), else null (grouped by name). */
  source: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Macros the item's source didn't list (counted as 0 in the sums, so the total is "at least"). */
  missing?: MacroKey[];
}

export interface Macros4 {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface DaySummary {
  date: string;
  state: DayState;
  /** Marked complete by the person. */
  markedComplete: boolean;
  items: number;
  totals: Macros4;
  /** Macros for which some entry had no value, so the day's total is a minimum. */
  incomplete: MacroKey[];
}

export interface FoodSource {
  name: string;
  amount: number;
  /** Share of the week's total, 0–100. */
  share: number;
  times: number;
}

export interface WeeklyInsights {
  days: DaySummary[];
  /** Days counted in averages (logged, including logged-as-zero). */
  loggedDays: number;
  notLoggedDays: number;
  /** Average per logged day, or null when nothing was logged. */
  average: Macros4 | null;
  /** Macros whose average includes entries with no value. */
  averageIncomplete: MacroKey[];
  topProtein: FoodSource[];
  topCalories: FoodSource[];
}

const MACROS: MacroKey[] = ["protein_g", "carbs_g", "fat_g"];
const r = (n: number) => Math.round(n);

export function summarizeDay(date: string, items: InsightItem[], mark: DayMark | null | undefined): DaySummary {
  const totals: Macros4 = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const incomplete = new Set<MacroKey>();
  for (const i of items) {
    totals.calories += Number(i.calories) || 0;
    totals.protein_g += Number(i.protein_g) || 0;
    totals.carbs_g += Number(i.carbs_g) || 0;
    totals.fat_g += Number(i.fat_g) || 0;
    for (const m of i.missing ?? []) incomplete.add(m);
  }
  const rounded = { calories: r(totals.calories), protein_g: r(totals.protein_g), carbs_g: r(totals.carbs_g), fat_g: r(totals.fat_g) };
  const state: DayState = items.length && rounded.calories > 0 ? "logged" : items.length || mark === "fasted" ? "logged_zero" : "not_logged";
  return { date, state, markedComplete: mark === "complete" || mark === "fasted", items: items.length, totals: rounded, incomplete: MACROS.filter((m) => incomplete.has(m)) };
}

function topSources(items: InsightItem[], pick: (i: InsightItem) => number, limit: number): FoodSource[] {
  const groups = new Map<string, { name: string; amount: number; times: number }>();
  for (const i of items) {
    const k = i.source && !i.source.startsWith("custom") ? i.source : `name:${i.name.trim().toLowerCase()}`;
    const g = groups.get(k) ?? { name: i.name, amount: 0, times: 0 };
    g.amount += pick(i) || 0;
    g.times += 1;
    groups.set(k, g);
  }
  const total = [...groups.values()].reduce((s, g) => s + g.amount, 0);
  return [...groups.values()]
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((g) => ({ name: g.name, amount: Math.round(g.amount * 10) / 10, share: total > 0 ? Math.round((g.amount / total) * 100) : 0, times: g.times }));
}

export function weeklyInsights(dates: string[], items: InsightItem[], marks: Map<string, DayMark> | Record<string, DayMark>, limit = 5): WeeklyInsights {
  const markOf = (d: string) => (marks instanceof Map ? marks.get(d) : marks[d]);
  const byDate = new Map<string, InsightItem[]>();
  for (const i of items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
  const days = dates.map((d) => summarizeDay(d, byDate.get(d) ?? [], markOf(d)));
  const counted = days.filter((d) => d.state !== "not_logged");
  const average = counted.length
    ? {
        calories: r(counted.reduce((s, d) => s + d.totals.calories, 0) / counted.length),
        protein_g: r(counted.reduce((s, d) => s + d.totals.protein_g, 0) / counted.length),
        carbs_g: r(counted.reduce((s, d) => s + d.totals.carbs_g, 0) / counted.length),
        fat_g: r(counted.reduce((s, d) => s + d.totals.fat_g, 0) / counted.length),
      }
    : null;
  const inWeek = items.filter((i) => dates.includes(i.date));
  return {
    days,
    loggedDays: counted.length,
    notLoggedDays: days.length - counted.length,
    average,
    averageIncomplete: MACROS.filter((m) => counted.some((d) => d.incomplete.includes(m))),
    topProtein: topSources(inWeek, (i) => (i.missing?.includes("protein_g") ? 0 : Number(i.protein_g)), limit),
    topCalories: topSources(inWeek, (i) => Number(i.calories), limit),
  };
}

/** Percent of target, or null without a target. */
export function pctOfTarget(value: number, target: number | null | undefined): number | null {
  return target && target > 0 ? Math.round((value / target) * 100) : null;
}
