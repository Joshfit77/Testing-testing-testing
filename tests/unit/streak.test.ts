import { addDays, parseRange, rangeStart, startOfWeek } from "@/lib/domain/dates";
import { dailyStreak, lastSevenDays, weeklyFrequency, weeklyStreak } from "@/lib/domain/streak";

describe("dates", () => {
  it("computes Monday week starts", () => {
    expect(startOfWeek("2026-10-16")).toBe("2026-10-12"); // Friday → Monday
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12"); // Sunday
  });
  it("parses ranges with a safe default", () => {
    expect(parseRange("90d")).toBe("90d");
    expect(parseRange("bogus")).toBe("30d");
    expect(rangeStart("7d", "2026-10-16")).toBe("2026-10-10");
  });
});

describe("streaks", () => {
  const today = "2026-10-16";
  it("counts consecutive days including yesterday grace", () => {
    expect(dailyStreak([today, addDays(today, -1), addDays(today, -2)], today)).toBe(3);
    expect(dailyStreak([addDays(today, -1), addDays(today, -2)], today)).toBe(2);
    expect(dailyStreak([addDays(today, -2)], today)).toBe(0);
    expect(dailyStreak([], today)).toBe(0);
  });
  it("counts weekly streaks without breaking on an in-progress week", () => {
    const dates = ["2026-10-01", "2026-10-02", "2026-10-06", "2026-10-08"];
    expect(weeklyStreak(dates, today, 1)).toBe(2);
    expect(weeklyStreak(dates, today, 2)).toBe(2);
    expect(weeklyStreak([...dates, "2026-10-13"], today, 1)).toBe(3);
  });
  it("builds 7-day activity and weekly frequency", () => {
    const days = lastSevenDays([today, today, "2026-10-12"], today);
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toEqual({ date: today, count: 2 });
    const freq = weeklyFrequency(["2026-10-06", "2026-10-13", "2026-10-14"], "2026-10-01", today);
    expect(freq).toEqual([
      { week: "2026-09-28", count: 0 },
      { week: "2026-10-05", count: 1 },
      { week: "2026-10-12", count: 2 },
    ]);
  });
});
