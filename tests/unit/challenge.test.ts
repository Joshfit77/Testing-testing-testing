import {
  canCheckIn,
  challengeDate,
  challengeDayNumber,
  challengeDays,
  completedDayCount,
  currentChallengeDay,
  devotionalForDate,
  isChallengeComplete,
  type ChallengeCheckin,
} from "@/lib/domain/challenge";
import { addDays } from "@/lib/domain/dates";

const done = (day: number): ChallengeCheckin => ({ day_number: day, devotional_done: true, workout_done: true });

describe("challenge day computation", () => {
  it("starts at day 1 on the start date and counts calendar days", () => {
    expect(challengeDayNumber("2026-10-16", "2026-10-16")).toBe(1);
    expect(challengeDayNumber("2026-10-16", "2026-10-17")).toBe(2);
    expect(challengeDayNumber("2026-10-16", "2026-11-24")).toBe(40);
  });

  it("caps at 40 and never goes below 1", () => {
    expect(challengeDayNumber("2026-10-16", "2027-03-01")).toBe(40);
    expect(challengeDayNumber("2026-10-16", "2026-10-10")).toBe(1);
  });

  it("crosses month, year and DST boundaries by calendar date", () => {
    expect(challengeDayNumber("2026-12-31", "2027-01-01")).toBe(2);
    expect(challengeDayNumber("2027-02-27", "2027-03-01")).toBe(3); // non-leap February
    // US DST ends 2026-11-01; calendar-date arithmetic is unaffected.
    expect(challengeDayNumber("2026-10-31", "2026-11-02")).toBe(3);
  });

  it("uses the user's time zone for 'today'", () => {
    // 03:00 UTC on Oct 17 is still the evening of Oct 16 in Los Angeles, but midday Oct 17 in Tokyo.
    const now = new Date("2026-10-17T03:00:00Z");
    expect(currentChallengeDay("2026-10-16", now, "America/Los_Angeles")).toBe(1);
    expect(currentChallengeDay("2026-10-16", now, "Asia/Tokyo")).toBe(2);
    expect(currentChallengeDay("2026-10-16", now, "UTC")).toBe(2);
  });

  it("handles the date line: Kiritimati (UTC+14) and Pago Pago (UTC−11)", () => {
    const now = new Date("2026-10-16T11:30:00Z");
    expect(currentChallengeDay("2026-10-16", now, "Pacific/Kiritimati")).toBe(2); // already Oct 17 01:30
    expect(currentChallengeDay("2026-10-16", now, "Pacific/Pago_Pago")).toBe(1); // Oct 16 00:30
  });

  it("falls back to UTC for an invalid time zone", () => {
    expect(currentChallengeDay("2026-10-16", new Date("2026-10-17T00:30:00Z"), "Not/AZone")).toBe(2);
  });

  it("maps challenge days to calendar dates", () => {
    expect(challengeDate("2026-10-16", 1)).toBe("2026-10-16");
    expect(challengeDate("2026-10-16", 40)).toBe(addDays("2026-10-16", 39));
  });
});

describe("challenge day statuses", () => {
  it("marks done / today / missed / upcoming", () => {
    const start = "2026-10-01";
    const today = "2026-10-05"; // day 5
    const days = challengeDays(start, today, [done(1), done(2), { day_number: 3, devotional_done: true, workout_done: false }]);
    expect(days).toHaveLength(40);
    expect(days.slice(0, 6).map((d) => d.status)).toEqual(["done", "done", "missed", "missed", "today", "upcoming"]);
    expect(days[2]!.partial).toBe(true);
    expect(days[3]!.partial).toBe(false);
    expect(days[4]!.date).toBe("2026-10-05");
  });

  it("shows today as done once both check-offs are confirmed", () => {
    const days = challengeDays("2026-10-01", "2026-10-01", [done(1)]);
    expect(days[0]!.status).toBe("done");
    expect(days[1]!.status).toBe("upcoming");
  });

  it("only allows check-ins up to the current day (catch-up allowed, no skipping ahead)", () => {
    expect(canCheckIn(1, 5)).toBe(true);
    expect(canCheckIn(5, 5)).toBe(true);
    expect(canCheckIn(6, 5)).toBe(false);
    expect(canCheckIn(0, 5)).toBe(false);
    expect(canCheckIn(40, 40)).toBe(true);
    expect(canCheckIn(2.5, 5)).toBe(false);
  });

  it("completes only when all 40 days have both check-offs", () => {
    const all = Array.from({ length: 40 }, (_, i) => done(i + 1));
    expect(isChallengeComplete(all)).toBe(true);
    expect(completedDayCount(all)).toBe(40);
    const missingOne = all.map((c) => (c.day_number === 40 ? { ...c, workout_done: false } : c));
    expect(isChallengeComplete(missingOne)).toBe(false);
    expect(completedDayCount(missingOne)).toBe(39);
  });
});

describe("devotional of the day rotation", () => {
  it("rotates through all 40 devotionals by date and repeats", () => {
    const start = "2026-10-16";
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) seen.add(devotionalForDate(addDays(start, i)).day);
    expect(seen.size).toBe(40);
    expect(devotionalForDate(addDays(start, 40)).day).toBe(devotionalForDate(start).day);
    expect(devotionalForDate(addDays(start, 1)).day).toBe((devotionalForDate(start).day % 40) + 1);
  });

  it("works for dates before the rotation epoch", () => {
    expect(devotionalForDate("2025-12-31").day).toBe(40);
    expect(devotionalForDate("2026-01-01").day).toBe(1);
  });
});
