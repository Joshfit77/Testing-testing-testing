import type { NightSummary } from "@/lib/domain/sleep";
import { clockShift, describeShift, isWeekendNight, trend, weekdayWeekend } from "@/lib/domain/sleep-analytics";

/** A night ending on `nightOf` in UTC with the given bed/wake clock times (bed the evening before) and time asleep. */
function night(nightOf: string, bed: string, wake: string, asleep: number): NightSummary {
  const prev = new Date(Date.parse(`${nightOf}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return { nightOf, sessions: [], bedAt: `${prev}T${bed}:00Z`, wakeAt: `${nightOf}T${wake}:00Z`, timezone: "UTC", inBedMinutes: asleep, asleepMinutes: asleep, asleepEstimated: true, latencyMinutes: null, efficiencyPct: null, awakenings: null, sources: ["manual"] };
}

describe("weekday and weekend nights", () => {
  it("counts Friday and Saturday nights (waking Saturday and Sunday) as the weekend", () => {
    expect(isWeekendNight("2026-10-17")).toBe(true); // Saturday
    expect(isWeekendNight("2026-10-18")).toBe(true); // Sunday
    expect(isWeekendNight("2026-10-19")).toBe(false); // Monday
  });

  it("compares typical times and time asleep, with signed shifts across midnight", () => {
    const nights = [
      night("2026-10-12", "23:00", "06:30", 440),
      night("2026-10-13", "23:10", "06:30", 430),
      night("2026-10-14", "22:50", "06:30", 450),
      night("2026-10-17", "00:15", "08:00", 460),
      night("2026-10-18", "00:30", "08:15", 470),
      night("2026-10-11", "00:00", "07:45", 480),
    ];
    const w = weekdayWeekend(nights, 450);
    expect(w.weekday).toMatchObject({ nights: 3, avgAsleep: 440, atGoal: 1, typicalBed: 23 * 60, typicalWake: 6 * 60 + 30 });
    expect(w.weekend).toMatchObject({ nights: 3, avgAsleep: 470, atGoal: 3, typicalBed: 15, typicalWake: 8 * 60 });
    expect(w.bedShift).toBe(75);
    expect(w.wakeShift).toBe(90);
    expect(w.asleepDiff).toBe(30);
    expect(clockShift(23 * 60 + 30, 30)).toBe(60);
    expect(clockShift(30, 23 * 60 + 30)).toBe(-60);
  });

  it("needs three nights a side before typical times, but averages from one", () => {
    const w = weekdayWeekend([night("2026-10-12", "23:00", "06:30", 440), night("2026-10-17", "00:15", "08:00", 460)], 450);
    expect(w.weekday.typicalBed).toBeNull();
    expect(w.bedShift).toBeNull();
    expect(w.asleepDiff).toBe(20);
    expect(describeShift(w.bedShift)).toBe("not enough nights");
    expect(describeShift(75)).toBe("1h 15m later");
    expect(describeShift(-45)).toBe("45 min earlier");
    expect(describeShift(5)).toBe("about the same");
    expect(describeShift(-30, "more", "less")).toBe("30 min less");
  });
});

describe("trend buckets", () => {
  const nights = [night("2026-10-01", "23:00", "07:00", 480), night("2026-10-02", "23:00", "06:00", 420), night("2026-10-20", "23:00", "07:30", 510)];

  it("makes consecutive 7-day blocks ending on the last day, oldest first, with empty weeks kept", () => {
    const t = trend(nights, "2026-09-25", "2026-10-22", "week", 450);
    expect(t.map((p) => [p.start, p.end, p.nights, p.avgAsleep, p.atGoal])).toEqual([
      ["2026-09-25", "2026-10-01", 1, 480, 1],
      ["2026-10-02", "2026-10-08", 1, 420, 0],
      ["2026-10-09", "2026-10-15", 0, null, 0],
      ["2026-10-16", "2026-10-22", 1, 510, 1],
    ]);
    expect(t[0]?.label).toBe("Sep 25");
  });

  it("makes calendar months clipped to the range", () => {
    const t = trend(nights, "2026-09-20", "2026-10-22", "month", 450);
    expect(t.map((p) => [p.label, p.start, p.end, p.nights, p.avgAsleep])).toEqual([
      ["Sep", "2026-09-20", "2026-09-30", 0, null],
      ["Oct", "2026-10-01", "2026-10-22", 3, 470],
    ]);
    // A range crossing the year end.
    expect(trend([], "2026-12-15", "2027-01-10", "month", 450).map((p) => p.label)).toEqual(["Dec", "Jan"]);
  });
});
