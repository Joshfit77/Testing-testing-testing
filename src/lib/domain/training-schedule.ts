/**
 * Planned program sessions with dates (training calendar, SPEC §3).
 *
 * Programs are sequences (week N, day M); they are not pinned to dates. This module gives every pending
 * session a planned date:
 *
 * - The next session is due today (a session you haven't done rolls forward to today), unless a
 *   program workout was already completed today, in which case it is planned for the next training day.
 * - Each later session goes on the next default training weekday after the previous session.
 * - A user can move a pending session to another date (an override). Later sessions without their own
 *   override then flow after it. Overrides never move a completed session: completed workouts are read
 *   from workout history and only pending sessions (from the program pointer onwards) are scheduled, so
 *   an override for a day that is already done is simply ignored.
 *
 * Pure functions; ISO calendar dates (YYYY-MM-DD) in the user's time zone.
 */
import { addDays, daysBetween } from "./dates";

/** Default training weekdays per days-per-week, Monday = 0 … Sunday = 6. */
export const DEFAULT_TRAINING_WEEKDAYS: Record<number, readonly number[]> = {
  1: [2],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** How far ahead a session may be moved. */
export const MAX_MOVE_DAYS_AHEAD = 120;

/** Monday-first weekday index (0 = Monday) of an ISO date. */
export function mondayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function trainingWeekdays(daysPerWeek: number): readonly number[] {
  const n = Math.min(7, Math.max(1, Math.round(daysPerWeek || 3)));
  return DEFAULT_TRAINING_WEEKDAYS[n]!;
}

/** The first default training day strictly after `after`. */
export function nextTrainingDay(after: string, daysPerWeek: number): string {
  const days = trainingWeekdays(daysPerWeek);
  for (let i = 1; i <= 7; i++) {
    const d = addDays(after, i);
    if (days.includes(mondayIndex(d))) return d;
  }
  return addDays(after, 1);
}

/** A pending program session, in program order. */
export interface PendingSession {
  dayId: string;
  week: number;
  day: number;
  name: string;
  minutes: number | null;
}

export interface PlannedSession extends PendingSession {
  date: string;
  /** Where it would be without its own override (given the sessions before it). */
  defaultDate: string;
  /** True when the user moved it (its date differs from the default). */
  moved: boolean;
  /** Position in the pending list (0 = the next session). */
  index: number;
}

export interface ScheduleInput {
  /** Pending sessions in program order, starting at the program pointer. */
  pending: PendingSession[];
  /** program_day_id → planned date chosen by the user. Entries for completed days are ignored. */
  overrides: ReadonlyMap<string, string> | Record<string, string>;
  today: string;
  daysPerWeek: number;
  /** A program workout was already completed today. */
  completedToday?: boolean;
}

function overrideMap(o: ScheduleInput["overrides"]): ReadonlyMap<string, string> {
  return o instanceof Map ? o : new Map(Object.entries(o));
}

/** Give every pending session a date. Dates never go backwards and never fall before today. */
export function planSchedule(input: ScheduleInput): PlannedSession[] {
  const overrides = overrideMap(input.overrides);
  const out: PlannedSession[] = [];
  let prev: string | null = null;
  input.pending.forEach((s, index) => {
    const defaultDate: string =
      prev === null ? (input.completedToday ? nextTrainingDay(input.today, input.daysPerWeek) : input.today) : nextTrainingDay(prev, input.daysPerWeek);
    const o = overrides.get(s.dayId);
    let date = defaultDate;
    if (o) {
      // A moved session can't fall before today, or before the session that comes before it.
      date = o < input.today ? input.today : o;
      if (prev !== null && date < prev) date = prev;
    }
    out.push({ ...s, date, defaultDate, moved: date !== defaultDate, index });
    prev = date;
  });
  return out;
}

export type MoveCheck =
  | { ok: true; /** Store this date, or null to remove the override (the date is the default). */ store: string | null; /** Overrides of later sessions to drop because they would now fall before this one. */ clear: string[] }
  | { ok: false; reason: string };

/**
 * Validate moving pending session `dayId` to `to`. Completed sessions can't be moved (they are not in
 * the pending list); dates in the past, before the previous session, or too far ahead are refused.
 */
export function checkMove(schedule: PlannedSession[], overrides: ScheduleInput["overrides"], dayId: string, to: string, today: string): MoveCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(Date.parse(`${to}T00:00:00Z`))) return { ok: false, reason: "Choose a valid date." };
  const s = schedule.find((x) => x.dayId === dayId);
  if (!s) return { ok: false, reason: "Only upcoming sessions can be moved. Completed workouts stay where they are." };
  if (to < today) return { ok: false, reason: "Choose today or a later date." };
  if (daysBetween(today, to) > MAX_MOVE_DAYS_AHEAD) return { ok: false, reason: `Choose a date within the next ${MAX_MOVE_DAYS_AHEAD} days.` };
  const before = s.index > 0 ? schedule[s.index - 1]! : null;
  if (before && to < before.date) {
    return { ok: false, reason: `Sessions stay in program order: this one can't come before ${before.name} (${before.date}).` };
  }
  const map = overrideMap(overrides);
  const clear = schedule.filter((x) => x.index > s.index && map.has(x.dayId) && map.get(x.dayId)! < to).map((x) => x.dayId);
  return { ok: true, store: to === s.defaultDate ? null : to, clear };
}
