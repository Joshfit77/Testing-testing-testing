import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { recoveryInsight } from "@/lib/domain/sleep-insight";

const night = (date: string, hours: number): SleepSession => {
  const end = Date.parse(`${date}T06:30:00Z`);
  return { id: date, kind: "night", source: "manual", startedAt: new Date(end - hours * 3_600_000).toISOString(), endedAt: new Date(end).toISOString(), timezone: "UTC", nightOf: date };
};
const week = (...hours: number[]) => summarizeNights(hours.map((h, i) => night(`2026-10-${String(20 + i).padStart(2, "0")}`, h)));
const GOAL = 480;

describe("the dashboard's one recovery line", () => {
  it("restates the sleep debt estimate when there is one (Pro)", () => {
    const i = recoveryInsight({ week: week(7, 8, 6), goalMinutes: GOAL, debt: { debtMinutes: 150, band: "behind", nightsWithData: 3 } });
    expect(i.text).toBe("Estimated sleep debt 2h 30m. A little behind: an earlier night or two would clear it.");
    expect(i.href).toBe("/progress/sleep/debt");
  });

  it("otherwise counts this week's logged nights at goal, from the member's own entries", () => {
    expect(recoveryInsight({ week: week(7, 8, 6, 9), goalMinutes: GOAL, debt: null }).text).toBe("2 of 4 nights you logged this week reached your 8h goal. A fixed wake time is the easiest place to start.");
    expect(recoveryInsight({ week: week(8, 8.5, 9), goalMinutes: GOAL, debt: null }).text).toMatch(/^All 3 nights you logged this week reached your 8h goal/);
    // Too few nights for the debt line falls back to the week.
    expect(recoveryInsight({ week: week(8, 8, 8), goalMinutes: GOAL, debt: { debtMinutes: 0, band: "on_track", nightsWithData: 2 } }).href).toBe("/progress/sleep/history");
  });

  it("asks for more nights rather than drawing a conclusion from one or two", () => {
    const i = recoveryInsight({ week: week(5), goalMinutes: GOAL, debt: null });
    expect(i.text).toBe("Log 2 more nights this week to see how often you reach your goal.");
    expect(i.href).toBeNull();
    expect(recoveryInsight({ week: [], goalMinutes: GOAL, debt: null }).text).toContain("Log 3 more nights");
  });
});
