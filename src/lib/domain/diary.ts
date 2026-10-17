import { addDays } from "./dates";
import type { WeeklyRateKg } from "./calorie-budget";
import type { UnitSystem } from "./types";
import { kgToLb } from "./units";

/**
 * Food-diary helpers in the style of MyFitnessPal / MyNetDiary: pace labels, weekly summaries,
 * workout minutes for the exercise line, weight-goal progress and recent/frequent foods.
 * Pure functions; everything here is display maths on numbers the app already stores.
 */

/** Weekly pace in the user's units, e.g. "Lose 1 lb per week" or "Gain 0.25 kg per week". */
export function paceLabel(rateKg: number, units: UnitSystem): string {
  if (rateKg === 0) return "Maintain my weight";
  const verb = rateKg < 0 ? "Lose" : "Gain";
  const abs = Math.abs(rateKg);
  // Imperial shows the familiar half-pound steps (0.25 kg ≈ 0.5 lb, 0.5 kg ≈ 1 lb, 1 kg ≈ 2 lb).
  // Paces outside the standard steps (e.g. a budget limited by the safety floor) keep one decimal.
  const lb = Math.round(kgToLb(abs) * 2) / 2 || Math.round(kgToLb(abs) * 10) / 10;
  const amount = units === "imperial" ? `${lb} lb` : `${abs} kg`;
  return `${verb} ${amount} per week`;
}

/** Pace options that point toward the goal weight (all of them when there is no goal weight). */
export function paceOptions(rates: readonly WeeklyRateKg[], currentKg: number | null, goalKg: number | null): WeeklyRateKg[] {
  if (!currentKg || !goalKg) return [...rates];
  const diff = goalKg - currentKg;
  if (Math.abs(diff) < 0.5) return rates.filter((r) => r === 0);
  return rates.filter((r) => (diff < 0 ? r < 0 : r > 0));
}

/** ISO date `weeks` weeks after `today`. */
export function goalDate(today: string, weeks: number): string {
  return addDays(today, Math.max(0, Math.round(weeks * 7)));
}

/** Human date like "Mar 14, 2027" for an ISO date. */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Active minutes of a finished workout (wall time minus pauses), or 0 when it can't be measured. */
export function workoutMinutes(startedAt: string, endedAt: string | null, pausedSeconds = 0): number {
  if (!endedAt) return 0;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  // Ignore obviously abandoned timers (a workout left running overnight).
  const minutes = (ms / 1000 - Math.max(0, pausedSeconds)) / 60;
  return Math.max(0, Math.min(240, Math.round(minutes)));
}

export interface WeeklySummary {
  /** Days with any food logged. */
  daysLogged: number;
  /** Average calories over the logged days (0 when nothing is logged). */
  average: number;
  /** Logged days at or under the goal. */
  under: number;
  /** Logged days over the goal. */
  over: number;
  total: number;
}

/** Calories vs goal across a set of days; days with nothing logged are left out of the average. */
export function weeklySummary(days: { calories: number }[], goal: number | null): WeeklySummary {
  const logged = days.filter((d) => d.calories > 0);
  const total = logged.reduce((s, d) => s + d.calories, 0);
  const under = goal ? logged.filter((d) => d.calories <= goal).length : 0;
  return {
    daysLogged: logged.length,
    average: logged.length ? Math.round(total / logged.length) : 0,
    under,
    over: goal ? logged.length - under : 0,
    total: Math.round(total),
  };
}

/** Share of the way from the start weight to the goal weight, 0–100. */
export function weightGoalProgress(startKg: number, currentKg: number, goalKg: number): number {
  const span = goalKg - startKg;
  if (Math.abs(span) < 0.05) return 100;
  const pct = ((currentKg - startKg) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export interface DiaryItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** When it was logged (ISO timestamp); newest first wins for "recent". */
  loggedAt: string;
}

export interface QuickFood extends DiaryItem {
  /** Times this exact food (name + calories) was logged in the window. */
  count: number;
}

function foodKey(i: Pick<DiaryItem, "name" | "calories">): string {
  return `${i.name.trim().toLowerCase()}|${Math.round(i.calories)}`;
}

/**
 * Recent and frequent foods for one-tap re-logging. Identical entries (same name and calories) are merged;
 * "recent" is newest first, "frequent" only lists foods logged at least twice, most-logged first.
 */
export function recentAndFrequent(items: DiaryItem[], limit = 8): { recent: QuickFood[]; frequent: QuickFood[] } {
  const byKey = new Map<string, QuickFood>();
  const sorted = [...items].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  for (const i of sorted) {
    const k = foodKey(i);
    const found = byKey.get(k);
    if (found) found.count += 1;
    else byKey.set(k, { ...i, count: 1 });
  }
  const all = [...byKey.values()];
  const recent = all.slice(0, limit);
  const frequent = all
    .filter((f) => f.count >= 2)
    .sort((a, b) => b.count - a.count || b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, limit);
  return { recent, frequent };
}

/** Body-mass index; used only to show a gentle note on very low goal weights. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
