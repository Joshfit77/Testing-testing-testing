import {
  clampSteps,
  fillStepDays,
  isValidStepCount,
  isValidStepGoal,
  lastNDates,
  MAX_DAILY_STEPS,
  stepGoalPct,
  stepsByDay,
  syncPayload,
} from "@/lib/domain/steps";

describe("lastNDates", () => {
  it("returns n dates ending today, oldest first, across a month boundary", () => {
    expect(lastNDates("2026-10-03", 5)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
  });
  it("handles n = 1 and n = 0", () => {
    expect(lastNDates("2026-10-17", 1)).toEqual(["2026-10-17"]);
    expect(lastNDates("2026-10-17", 0)).toEqual([]);
  });
});

describe("clamp and validate", () => {
  it("rounds and clamps step counts", () => {
    expect(clampSteps(1234.6)).toBe(1235);
    expect(clampSteps(-5)).toBe(0);
    expect(clampSteps(10_000_000)).toBe(MAX_DAILY_STEPS);
    expect(clampSteps(Number.NaN)).toBe(0);
    expect(clampSteps(Number.POSITIVE_INFINITY)).toBe(0);
  });
  it("validates counts and goals", () => {
    expect(isValidStepCount(0)).toBe(true);
    expect(isValidStepCount(200_000)).toBe(true);
    expect(isValidStepCount(200_001)).toBe(false);
    expect(isValidStepCount(12.5)).toBe(false);
    expect(isValidStepGoal(999)).toBe(false);
    expect(isValidStepGoal(1000)).toBe(true);
    expect(isValidStepGoal(50_000)).toBe(true);
    expect(isValidStepGoal(50_001)).toBe(false);
  });
});

describe("stepGoalPct", () => {
  it("computes a capped whole percentage", () => {
    expect(stepGoalPct(4000, 8000)).toBe(50);
    expect(stepGoalPct(12_000, 8000)).toBe(100);
    expect(stepGoalPct(0, 8000)).toBe(0);
    expect(stepGoalPct(5000, 0)).toBe(0);
  });
});

describe("stepsByDay", () => {
  it("maps local-midnight buckets to the user's calendar day even when expressed in UTC", () => {
    // Chicago (UTC-5 in October): local midnight is 05:00Z.
    const samples = [
      { startDate: "2026-10-15T05:00:00.000Z", endDate: "2026-10-16T05:00:00.000Z", value: 6012 },
      { startDate: "2026-10-16T05:00:00.000Z", endDate: "2026-10-17T05:00:00.000Z", value: 10450.4 },
    ];
    expect(stepsByDay(samples, "America/Chicago")).toEqual({ "2026-10-15": 6012, "2026-10-16": 10450 });
  });

  it("handles offset timestamps and buckets without an end date", () => {
    const samples = [{ startDate: "2026-10-17T00:00:00+10:00", value: 300 }];
    expect(stepsByDay(samples, "Australia/Sydney")).toEqual({ "2026-10-17": 300 });
  });

  it("sums duplicates and skips invalid samples", () => {
    const samples = [
      { startDate: "2026-10-17T00:00:00Z", endDate: "2026-10-18T00:00:00Z", value: 100 },
      { startDate: "2026-10-17T00:00:00Z", endDate: "2026-10-18T00:00:00Z", value: 50 },
      { startDate: "garbage", value: 999 },
      { startDate: "2026-10-16T00:00:00Z", value: Number.NaN },
    ];
    expect(stepsByDay(samples, "UTC")).toEqual({ "2026-10-17": 150 });
  });
});

describe("fillStepDays and syncPayload", () => {
  it("fills missing days with zero in order", () => {
    expect(fillStepDays(["2026-10-15", "2026-10-16", "2026-10-17"], [{ day: "2026-10-16", steps: 500 }])).toEqual([
      { day: "2026-10-15", steps: 0 },
      { day: "2026-10-16", steps: 500 },
      { day: "2026-10-17", steps: 0 },
    ]);
  });
  it("only sends days that have steps, clamped", () => {
    expect(syncPayload(["2026-10-15", "2026-10-16", "2026-10-17"], { "2026-10-16": 999_999, "2026-10-17": 0 })).toEqual([
      { day: "2026-10-16", steps: MAX_DAILY_STEPS },
    ]);
  });
});
