import { addDays, daysBetween, eachDay, startOfWeek } from "./dates";

/**
 * Training streak in consecutive days ending today (or yesterday — a streak isn't broken
 * until a full day passes without training).
 */
export function dailyStreak(trainedDates: string[], today: string): number {
  const set = new Set(trainedDates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Consecutive weeks (Monday-based) in which the user trained at least `minPerWeek` times.
 * The current week counts once it meets the target; an in-progress week doesn't break the streak.
 */
export function weeklyStreak(trainedDates: string[], today: string, minPerWeek = 1): number {
  const counts = new Map<string, number>();
  for (const d of new Set(trainedDates)) {
    const w = startOfWeek(d);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let week = startOfWeek(today);
  let streak = 0;
  if ((counts.get(week) ?? 0) >= minPerWeek) streak += 1;
  week = addDays(week, -7);
  while ((counts.get(week) ?? 0) >= minPerWeek) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

/**
 * Whether history older than what is loaded could still lengthen a streak. `trainedDates` must hold every trained
 * date from `loadedFrom` up to today. True when the run of trained weeks reaches back to the week of `loadedFrom`
 * (a day streak can't outrun the week streak, so one check covers both); false once an empty week inside the loaded
 * span has already ended it.
 */
export function streakNeedsOlderHistory(trainedDates: string[], today: string, loadedFrom: string): boolean {
  const weeks = new Set(trainedDates.map((d) => startOfWeek(d)));
  let week = startOfWeek(today);
  if (!weeks.has(week)) week = addDays(week, -7); // an in-progress week doesn't break the streak
  while (weeks.has(week)) week = addDays(week, -7);
  return week <= startOfWeek(loadedFrom);
}

/** Sessions per day for the last 7 days ending today, oldest first. */
export function lastSevenDays(trainedDates: string[], today: string): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of trainedDates) counts.set(d, (counts.get(d) ?? 0) + 1);
  return eachDay(addDays(today, -6), today).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

/** Weekly session counts for the window, keyed by Monday. */
export function weeklyFrequency(trainedDates: string[], start: string, end: string): { week: string; count: number }[] {
  const weeks: string[] = [];
  for (let w = startOfWeek(start); daysBetween(w, end) >= 0; w = addDays(w, 7)) weeks.push(w);
  const counts = new Map<string, number>();
  for (const d of trainedDates) {
    if (d < start || d > end) continue;
    const w = startOfWeek(d);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return weeks.map((week) => ({ week, count: counts.get(week) ?? 0 }));
}
