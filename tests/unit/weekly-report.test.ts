import { describe, expect, it } from "vitest";
import {
  buildWeeklyMetrics,
  isValidWeekStart,
  latestDuePeriod,
  localWeekdayHour,
  reportAnalysisSchema,
  ruleBasedAnalysis,
  shareText,
  type WeeklyReportInput,
  formatDistance,
  formatPace,
  metricsForAi,
  REPORT_AI_INSTRUCTIONS,
} from "@/lib/domain/weekly-report";

const period = { weekStart: "2026-11-02", weekEnd: "2026-11-08" };
const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
const zeroFood = days.map((date) => ({ date, calories: 0, protein: 0, carbs: 0, fat: 0 }));

function input(over: Partial<WeeklyReportInput> = {}): WeeklyReportInput {
  return {
    period,
    workouts: [],
    priorWeekWorkouts: [0, 0, 0, 0],
    plannedPerWeek: null,
    prs: [],
    nutrition: zeroFood,
    nutritionTargets: null,
    runs: [],
    priorRunDistanceM: null,
    sleep: [],
    sleepGoalMinutes: 480,
    sleepSteadiness: null,
    weights: [],
    ...over,
  };
}

describe("report period: Sunday 18:00 in the member's own time zone", () => {
  it("before Sunday 18:00 the due report is last week's; from 18:00 it is this week's", () => {
    // Sunday 2026-11-08 17:59 and 18:00 in Los Angeles (PST, UTC−8).
    expect(latestDuePeriod(new Date("2026-11-09T01:59:00Z"), "America/Los_Angeles")).toEqual({ weekStart: "2026-10-26", weekEnd: "2026-11-01" });
    expect(latestDuePeriod(new Date("2026-11-09T02:00:00Z"), "America/Los_Angeles")).toEqual(period);
    // Monday just after midnight: the week that just ended.
    expect(latestDuePeriod(new Date("2026-11-09T08:30:00Z"), "America/Los_Angeles")).toEqual(period);
  });

  it("the same instant is a different local day and week in different time zones", () => {
    const instant = new Date("2026-11-08T06:00:00Z");
    // Auckland: Sunday 19:00 → this week is due.  Los Angeles: Saturday 22:00 → last week.
    expect(localWeekdayHour(instant, "Pacific/Auckland")).toEqual({ weekday: 0, hour: 19 });
    expect(latestDuePeriod(instant, "Pacific/Auckland")).toEqual(period);
    expect(latestDuePeriod(instant, "America/Los_Angeles")).toEqual({ weekStart: "2026-10-26", weekEnd: "2026-11-01" });
  });

  it("is not moved by a daylight-saving change on the Sunday itself", () => {
    // US clocks fall back on Sunday 2026-11-01. 18:30 EST that day = 23:30 UTC.
    expect(localWeekdayHour(new Date("2026-11-01T23:30:00Z"), "America/New_York")).toEqual({ weekday: 0, hour: 18 });
    expect(latestDuePeriod(new Date("2026-11-01T23:30:00Z"), "America/New_York")).toEqual({ weekStart: "2026-10-26", weekEnd: "2026-11-01" });
    // EU clocks went back on Sunday 2026-10-25: 18:05 CET (17:05 UTC) is due, 17:55 CET is not.
    expect(latestDuePeriod(new Date("2026-10-25T17:05:00Z"), "Europe/Berlin")).toEqual({ weekStart: "2026-10-19", weekEnd: "2026-10-25" });
    expect(latestDuePeriod(new Date("2026-10-25T16:55:00Z"), "Europe/Berlin")).toEqual({ weekStart: "2026-10-12", weekEnd: "2026-10-18" });
  });

  it("only Mondays are valid week starts", () => {
    expect(isValidWeekStart("2026-11-02")).toBe(true);
    expect(isValidWeekStart("2026-11-03")).toBe(false);
    expect(isValidWeekStart("../x")).toBe(false);
  });
});

describe("weekly metrics come only from records", () => {
  it("an empty week reports no records anywhere and invents nothing", () => {
    const m = buildWeeklyMetrics(input());
    expect(m.training).toMatchObject({ coverage: "none", workouts: 0, volumeKg: 0 });
    expect(m.nutrition).toMatchObject({ coverage: "none", loggedDays: 0, avgCalories: null, avgProtein: null, daysOnTarget: null });
    expect(m.running).toMatchObject({ coverage: "none", runs: 0, avgPaceSecPerKm: null });
    expect(m.sleep).toMatchObject({ coverage: "none", nights: 0, avgAsleepMinutes: null, stages: null });
    expect(m.body).toMatchObject({ coverage: "none", changeKg: null });
    const a = ruleBasedAnalysis(m);
    expect(reportAnalysisSchema.safeParse(a).success).toBe(true);
    expect(a.recommendations).toHaveLength(3);
    // No praise for things that didn't happen.
    expect(a.wentWell).toEqual([]);
  });

  it("training: counts, volume, plan comparison and records; workouts outside the week are ignored", () => {
    const m = buildWeeklyMetrics(
      input({
        workouts: [
          { date: "2026-11-02", volumeKg: 5000.4 },
          { date: "2026-11-04", volumeKg: 6000 },
          { date: "2026-11-04", volumeKg: 1000 },
          { date: "2026-11-09", volumeKg: 9999 },
        ],
        plannedPerWeek: 4,
        priorWeekWorkouts: [3, 4, 4, 3],
        prs: [{ exercise: "Barbell Back Squat", recordType: "estimated_1rm" }],
      }),
    );
    expect(m.training).toMatchObject({ workouts: 3, trainingDays: 2, volumeKg: 12000, plannedPerWeek: 4, priorAverage: 3.5 });
    const a = ruleBasedAnalysis(m);
    expect(a.toImprove.join(" ")).toContain("3 of the 4 your program plans");
    expect(a.wentWell.join(" ")).toContain("Barbell Back Squat");
    expect(a.recommendations[0]).toMatch(/continues where you left off/);
  });

  it("nutrition: averages over logged days only, marked partial, with target adherence", () => {
    const food = zeroFood.map((d, i) => (i < 3 ? { ...d, calories: [2000, 2400, 1500][i]!, protein: [150, 90, 140][i]!, carbs: 200, fat: 70 } : d));
    const m = buildWeeklyMetrics(input({ nutrition: food, nutritionTargets: { calories: 2200, protein: 150 } }));
    expect(m.nutrition).toMatchObject({ coverage: "partial", loggedDays: 3, avgCalories: 1967, avgProtein: 127, daysOnTarget: 2, proteinDays: 2 });
    expect(ruleBasedAnalysis(m).toImprove.join(" ")).toContain("3 of 7 days");
  });

  it("running: total distance and moving pace; very short entries don't distort pace", () => {
    const m = buildWeeklyMetrics(input({ runs: [{ distanceM: 5000, movingS: 1500 }, { distanceM: 10000, movingS: 3300 }, { distanceM: 50, movingS: 600 }], priorRunDistanceM: 8000 }));
    expect(m.running).toMatchObject({ runs: 3, distanceKm: 15.1, avgPaceSecPerKm: 320, priorDistanceKm: 8 });
    expect(ruleBasedAnalysis(m).recovery.join(" ")).toMatch(/more than 30%/);
  });

  it("sleep: stage averages only from nights a device recorded stages; manual nights never get stages", () => {
    const m = buildWeeklyMetrics(
      input({
        sleep: [
          { asleepMinutes: 420, estimated: false, recorded: true, stages: { rem: 90, deep: 60, light: 270, awake: 20 } },
          { asleepMinutes: 480, estimated: false, recorded: true, stages: { rem: 110, deep: 80, light: 290, awake: 30 } },
          { asleepMinutes: 360, estimated: true, recorded: false, stages: null },
        ],
        sleepSteadiness: "variable",
      }),
    );
    expect(m.sleep).toMatchObject({ nights: 3, avgAsleepMinutes: 420, nightsAtGoal: 1, anyEstimated: true, coverage: "partial" });
    expect(m.sleep.stages).toEqual({ nights: 2, rem: 100, deep: 70, light: 280, awake: 25 });
  });

  it("body weight: change from the last weigh-in before the week; one weigh-in alone shows no change", () => {
    expect(buildWeeklyMetrics(input({ weights: [{ date: "2026-10-30", kg: 82 }, { date: "2026-11-05", kg: 81.4 }] })).body).toMatchObject({ entries: 1, startKg: 82, endKg: 81.4, changeKg: -0.6 });
    expect(buildWeeklyMetrics(input({ weights: [{ date: "2026-11-05", kg: 81.4 }] })).body).toMatchObject({ entries: 1, changeKg: null });
  });

  it("the shareable summary holds headline numbers only", () => {
    const m = buildWeeklyMetrics(input({ workouts: [{ date: "2026-11-02", volumeKg: 100 }], runs: [{ distanceM: 5000, movingS: 1500 }] }));
    const text = shareText(m);
    expect(text).toContain("Workouts: 1");
    expect(text).toContain("Running: 5 km in 1 run");
    expect(text).not.toMatch(/kg|calorie|protein|weight/i);
  });
});

describe("weekly report distances follow the member's units", () => {
  it("a miles member reads miles everywhere: analysis, share text and the AI's instructions", () => {
    const m = buildWeeklyMetrics(input({ runs: [{ distanceM: 5000, movingS: 1500 }, { distanceM: 1400, movingS: 480 }] }));
    expect(m.running.distanceKm).toBe(6.4);
    const text = ruleBasedAnalysis(m, "mi").wentWell.join(" ");
    expect(text).toContain("4 mi in total");
    expect(text).not.toMatch(/\bkm\b/);
    expect(shareText(m, "mi")).toContain("Running: 4 mi in 2 runs");
    expect(JSON.parse(metricsForAi(m, "mi")).writeDistancesIn).toBe("miles");
    expect(REPORT_AI_INSTRUCTIONS).toContain("writeDistancesIn");
  });

  it("kilometres stay the default, and pace converts per unit", () => {
    expect(formatDistance(6.4)).toBe("6.4 km");
    expect(formatDistance(6.4, "mi")).toBe("4 mi");
    expect(formatPace(300)).toBe("5:00 /km");
    expect(formatPace(300, "mi")).toBe("8:03 /mi");
  });
});
