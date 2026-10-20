import { addDays, eachDay, isoDateInTz, startOfWeek } from "./dates";

/** One logged session in the weekly summary (a workout, run or walk). */
export interface WeeklyActivityItem {
  id: string;
  /** Calendar date in the user's time zone (YYYY-MM-DD). */
  date: string;
  name: string;
  startedAt: string;
  /** Active minutes (paused time excluded), or null when unknown. */
  minutes: number | null;
  /** Metres, for runs and walks. */
  distanceM?: number | null;
}

export interface WeeklyActivityDay {
  date: string;
  /** Single-letter weekday label, Monday first. */
  label: string;
  isToday: boolean;
  isFuture: boolean;
  workouts: number;
  runs: number;
  walks: number;
}

export interface WeeklyActivity {
  weekStart: string;
  weekEnd: string;
  today: string;
  workouts: WeeklyActivityItem[];
  runs: WeeklyActivityItem[];
  walks: WeeklyActivityItem[];
  days: WeeklyActivityDay[];
}

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function activeMinutes(startedAt: string, endedAt: string | null, pausedSeconds: number): number | null {
  if (!endedAt) return null;
  const secs = (Date.parse(endedAt) - Date.parse(startedAt)) / 1000 - (pausedSeconds || 0);
  return Number.isFinite(secs) && secs > 0 ? Math.round(secs / 60) : null;
}

/** Group sessions into the Monday–Sunday week containing `now` (in the user's time zone). */
export function buildWeeklyActivity(
  now: Date,
  timezone: string,
  sessions: { workouts: WeeklyActivityItem[]; runs?: WeeklyActivityItem[]; walks?: WeeklyActivityItem[] },
): WeeklyActivity {
  const today = isoDateInTz(now, timezone);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (i: WeeklyActivityItem) => i.date >= weekStart && i.date <= weekEnd;
  const workouts = sessions.workouts.filter(inWeek);
  const runs = (sessions.runs ?? []).filter(inWeek);
  const walks = (sessions.walks ?? []).filter(inWeek);
  const count = (list: WeeklyActivityItem[], d: string) => list.filter((i) => i.date === d).length;
  const days = eachDay(weekStart, weekEnd).map((date, i) => ({
    date,
    label: LABELS[i]!,
    isToday: date === today,
    isFuture: date > today,
    workouts: count(workouts, date),
    runs: count(runs, date),
    walks: count(walks, date),
  }));
  return { weekStart, weekEnd, today, workouts, runs, walks, days };
}
