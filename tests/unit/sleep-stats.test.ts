import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { averageAsleepMinutes, goalPct, nightSlots, scheduleStats } from "@/lib/domain/sleep-stats";

const night = (date: string, bed: string, wake: string, tz = "UTC"): SleepSession => ({
  id: `${date}-${bed}`,
  kind: "night",
  source: "manual",
  startedAt: bed,
  endedAt: wake,
  timezone: tz,
  nightOf: date,
});

describe("night slots", () => {
  it("keeps missing nights as gaps and marks today", () => {
    const nights = summarizeNights([night("2026-10-23", "2026-10-22T22:30:00Z", "2026-10-23T06:00:00Z"), night("2026-10-21", "2026-10-20T23:00:00Z", "2026-10-21T06:30:00Z")]);
    const slots = nightSlots(nights, "2026-10-23", 4);
    expect(slots.map((s) => s.date)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
    expect(slots.map((s) => (s.night ? s.night.asleepMinutes : null))).toEqual([null, 450, null, 450]);
    expect(slots[3]!.isToday).toBe(true);
    expect(slots[0]!.label).toBe("Tue");
  });
});

describe("schedule pattern", () => {
  it("needs three nights", () => {
    const two = summarizeNights([night("2026-10-23", "2026-10-22T22:30:00Z", "2026-10-23T06:00:00Z"), night("2026-10-22", "2026-10-21T22:30:00Z", "2026-10-22T06:00:00Z")]);
    expect(scheduleStats(two)).toMatchObject({ nights: 2, typicalBed: null, steadiness: null });
  });
  it("finds typical times around midnight and rates steadiness", () => {
    const nights = summarizeNights([
      night("2026-10-23", "2026-10-22T23:30:00Z", "2026-10-23T06:00:00Z"),
      night("2026-10-22", "2026-10-22T00:30:00Z", "2026-10-22T06:15:00Z"),
      night("2026-10-21", "2026-10-20T23:45:00Z", "2026-10-21T05:50:00Z"),
    ]);
    const s = scheduleStats(nights);
    expect(s.typicalBed).toBe(23 * 60 + 45);
    expect(s.typicalWake).toBe(6 * 60);
    expect(s.bedSpread).toBe(20);
    expect(s.wakeSpread).toBe(8);
    expect(s.steadiness).toBe("steady");
  });
  it("calls widely moving times irregular and reads clock times in the night's own zone", () => {
    const nights = summarizeNights([
      night("2026-10-23", "2026-10-22T21:00:00Z", "2026-10-23T05:00:00Z", "Europe/London"),
      night("2026-10-22", "2026-10-22T00:30:00Z", "2026-10-22T08:00:00Z", "Europe/London"),
      night("2026-10-21", "2026-10-20T22:00:00Z", "2026-10-21T04:30:00Z", "Europe/London"),
    ]);
    const s = scheduleStats(nights);
    // 10:00 PM, 1:30 AM and 11:00 PM British Summer Time.
    expect(s.typicalBed).toBe(23 * 60);
    expect(s.steadiness).toBe("irregular");
  });
});

describe("averages and goal", () => {
  it("averages time asleep and compares with the goal", () => {
    const nights = summarizeNights([night("2026-10-23", "2026-10-22T22:00:00Z", "2026-10-23T06:00:00Z"), night("2026-10-22", "2026-10-21T23:00:00Z", "2026-10-22T06:00:00Z")]);
    expect(averageAsleepMinutes(nights)).toBe(450);
    expect(averageAsleepMinutes([])).toBeNull();
    expect(goalPct(450, 480)).toBe(94);
    expect(goalPct(540, 480)).toBe(113);
    expect(goalPct(null, 480)).toBeNull();
  });
});
