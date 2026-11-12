import { AXIS_EDGE_PCT, AXIS_MIN_GAP_PCT, shortHourLabel, stageAxisTicks } from "@/lib/domain/sleep-axis";

const gaps = (ticks: { left: number }[]) => ticks.slice(1).map((t, i) => t.left - ticks[i]!.left);

describe("stage chart time axis", () => {
  it("labels an ordinary night every two hours, in short form, on local hours", () => {
    // 11:10 PM to 6:50 AM UTC: the night from the watch test.
    const ticks = stageAxisTicks("2026-10-22T23:10:00Z", "2026-10-23T06:50:00Z", "UTC");
    expect(ticks.map((t) => t.label)).toEqual(["12 AM", "2 AM", "4 AM", "6 AM"]);
    expect(ticks.every((t) => /^\d{1,2} (AM|PM)$/.test(t.label))).toBe(true);
  });

  it("keeps labels apart and away from both ends, so nothing overlaps on a 393px phone", () => {
    for (const [bed, wake] of [
      ["2026-10-22T22:00:00Z", "2026-10-23T06:13:00Z"],
      ["2026-10-22T21:05:00Z", "2026-10-23T09:55:00Z"],
      ["2026-10-22T23:58:00Z", "2026-10-23T06:02:00Z"],
      ["2026-10-22T12:00:00Z", "2026-10-23T11:00:00Z"],
    ] as const) {
      const ticks = stageAxisTicks(bed, wake, "UTC");
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.every((t) => t.left >= AXIS_EDGE_PCT && t.left <= 100 - AXIS_EDGE_PCT)).toBe(true);
      expect(gaps(ticks).every((g) => g >= AXIS_MIN_GAP_PCT)).toBe(true);
    }
  });

  it("drops a tick that would sit on top of the bed or wake time", () => {
    // 2:00 AM is 3% from the end of a night ending at 2:15 AM.
    const ticks = stageAxisTicks("2026-10-22T18:15:00Z", "2026-10-23T02:15:00Z", "UTC");
    expect(ticks.map((t) => t.label)).not.toContain("2 AM");
  });

  it("puts ticks on the local hour in a half-hour zone, not on the UTC hour", () => {
    // India is UTC+5:30: 17:40 UTC is 11:10 PM local.
    const ticks = stageAxisTicks("2026-10-22T17:40:00Z", "2026-10-23T01:20:00Z", "Asia/Kolkata");
    expect(ticks.map((t) => t.label)).toEqual(["12 AM", "2 AM", "4 AM", "6 AM"]);
    // 12 AM local is 18:30 UTC: 50 of 460 minutes in.
    expect(ticks[0]!.left).toBeCloseTo((50 / 460) * 100, 5);
  });

  it("follows the night's own zone across a clock change without repeating a label", () => {
    // Clocks go back at 2 AM in New York on Nov 1 2026; 10 PM EDT to 7 AM EST is ten hours.
    const ticks = stageAxisTicks("2026-11-01T02:00:00Z", "2026-11-01T12:00:00Z", "America/New_York");
    const labels = ticks.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(gaps(ticks).every((g) => g >= AXIS_MIN_GAP_PCT)).toBe(true);
    expect(labels[0]).toBe("12 AM");
  });

  it("widens the step for a very long sleep and returns nothing for a bad span", () => {
    const long = stageAxisTicks("2026-10-22T08:00:00Z", "2026-10-23T08:00:00Z", "UTC");
    expect(gaps(long).every((g) => g >= AXIS_MIN_GAP_PCT)).toBe(true);
    expect(long.length).toBeLessThanOrEqual(6);
    expect(stageAxisTicks("2026-10-23T06:00:00Z", "2026-10-22T22:00:00Z", "UTC")).toEqual([]);
    expect(stageAxisTicks("nope", "2026-10-22T22:00:00Z", "UTC")).toEqual([]);
  });

  it("writes hours short", () => {
    expect(shortHourLabel(0)).toBe("12 AM");
    expect(shortHourLabel(23 * 60)).toBe("11 PM");
    expect(shortHourLabel(12 * 60)).toBe("12 PM");
    expect(shortHourLabel(13 * 60 + 30)).toBe("1 PM");
  });
});
