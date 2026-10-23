import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { debtBand, sleepDebt } from "@/lib/domain/sleep-debt";

const GOAL = 480;
const END = "2026-10-23";
const date = (i: number) => {
  const d = new Date(Date.parse(`${END}T00:00:00Z`) - i * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const night = (d: string, asleep: number): SleepSession => ({
  id: d,
  kind: "night",
  source: "manual",
  startedAt: `${d}T00:00:00Z`,
  endedAt: new Date(Date.parse(`${d}T00:00:00Z`) + asleep * 60_000).toISOString(),
  timezone: "UTC",
  nightOf: d,
});

describe("sleep debt v1", () => {
  it("adds each night's whole shortfall and skips nights without data", () => {
    // Seven nights an hour short, the other seven not logged.
    const nights = summarizeNights(Array.from({ length: 7 }, (_, i) => night(date(i), 420)));
    const d = sleepDebt(nights, GOAL, END);
    expect(d.days).toHaveLength(14);
    expect(d.nightsWithData).toBe(7);
    expect(d.debtMinutes).toBe(420);
    expect(d.totalShortfall).toBe(420);
    expect(d.days[0]).toMatchObject({ asleep: null, shortfall: 0, repaid: 0, debt: 0 });
    expect(d.band).toBe("deficit");
    expect(d.trend).toBe("rising");
  });

  it("pays back half of the extra sleep over the goal, never more than is owed", () => {
    // Seven short nights (60 each), then seven nights of 9 hours (60 over → 30 back each).
    const sessions = [...Array.from({ length: 7 }, (_, i) => night(date(13 - i), 420)), ...Array.from({ length: 7 }, (_, i) => night(date(6 - i), 540))];
    const d = sleepDebt(summarizeNights(sessions), GOAL, END);
    expect(d.totalShortfall).toBe(420);
    expect(d.totalRepaid).toBe(210);
    expect(d.debtMinutes).toBe(210);
    expect(d.trend).toBe("falling");
    // Nothing owed: a long night repays nothing.
    const rested = sleepDebt(summarizeNights([night(date(0), 600)]), GOAL, END);
    expect(rested.debtMinutes).toBe(0);
    expect(rested.totalRepaid).toBe(0);
    expect(rested.band).toBe("on_track");
  });

  it("only states a trend with enough nights and bands the estimate", () => {
    expect(sleepDebt(summarizeNights([night(date(0), 400), night(date(1), 400)]), GOAL, END).trend).toBeNull();
    expect(debtBand(0)).toBe("on_track");
    expect(debtBand(61)).toBe("behind");
    expect(debtBand(181)).toBe("deficit");
  });
});
