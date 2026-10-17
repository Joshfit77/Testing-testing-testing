/** Pure logic for the "40 Days Through the Narrow Gate" challenge. */
import { CHALLENGE_DAYS, DEVOTIONALS, type Devotional } from "@/data/devotionals";
import { addDays, daysBetween, isoDateInTz } from "@/lib/domain/dates";

export type ChallengeDayStatus = "done" | "today" | "missed" | "upcoming";

export interface ChallengeCheckin {
  day_number: number;
  devotional_done: boolean;
  workout_done: boolean;
  note?: string | null;
}

export interface ChallengeDay {
  day: number;
  /** Calendar date (user's time zone) this challenge day falls on. */
  date: string;
  status: ChallengeDayStatus;
  /** One of the two check-offs is done but not both. */
  partial: boolean;
}

/** A day counts as done when both the devotional and the training check-off are confirmed. */
export function isDayDone(c: Pick<ChallengeCheckin, "devotional_done" | "workout_done"> | undefined): boolean {
  return Boolean(c?.devotional_done && c?.workout_done);
}

/**
 * Current challenge day = whole days since `startedOn` (both calendar dates in the user's time zone) + 1,
 * clamped to 1…40.
 */
export function challengeDayNumber(startedOn: string, today: string): number {
  const n = daysBetween(startedOn, today) + 1;
  return Math.min(CHALLENGE_DAYS, Math.max(1, n));
}

/** Same as challengeDayNumber, resolving "today" from an instant in the user's IANA time zone. */
export function currentChallengeDay(startedOn: string, now: Date, timeZone: string): number {
  return challengeDayNumber(startedOn, isoDateInTz(now, timeZone));
}

export function challengeDate(startedOn: string, day: number): string {
  return addDays(startedOn, day - 1);
}

export function challengeDays(startedOn: string, today: string, checkins: ChallengeCheckin[]): ChallengeDay[] {
  const current = challengeDayNumber(startedOn, today);
  const byDay = new Map(checkins.map((c) => [c.day_number, c]));
  return Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
    const day = i + 1;
    const c = byDay.get(day);
    const done = isDayDone(c);
    const status: ChallengeDayStatus = done ? "done" : day === current ? "today" : day < current ? "missed" : "upcoming";
    return { day, date: challengeDate(startedOn, day), status, partial: !done && Boolean(c?.devotional_done || c?.workout_done) };
  });
}

export function completedDayCount(checkins: ChallengeCheckin[]): number {
  return new Set(checkins.filter(isDayDone).map((c) => c.day_number)).size;
}

export function isChallengeComplete(checkins: ChallengeCheckin[]): boolean {
  return completedDayCount(checkins) >= CHALLENGE_DAYS;
}

/** Whether a check-in may be recorded for `day` (no skipping ahead; catching up is allowed). */
export function canCheckIn(day: number, currentDay: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= Math.min(currentDay, CHALLENGE_DAYS);
}

const ROTATION_EPOCH = "2026-01-01";

/** For users not in the challenge: rotate through the 40 devotionals by calendar date (same for everyone on a date). */
export function devotionalForDate(isoDate: string): Devotional {
  const n = daysBetween(ROTATION_EPOCH, isoDate);
  const idx = ((n % CHALLENGE_DAYS) + CHALLENGE_DAYS) % CHALLENGE_DAYS;
  return DEVOTIONALS[idx]!;
}
