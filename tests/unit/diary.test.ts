import { describe, expect, it } from "vitest";
import { WEEKLY_RATES_KG } from "@/lib/domain/calorie-budget";
import {
  bmi,
  formatLongDate,
  goalDate,
  paceLabel,
  paceOptions,
  recentAndFrequent,
  weeklySummary,
  weightGoalProgress,
  workoutMinutes,
} from "@/lib/domain/diary";

describe("paceLabel", () => {
  it("shows MFP-style imperial half-pound steps", () => {
    expect(paceLabel(-0.5, "imperial")).toBe("Lose 1 lb per week");
    expect(paceLabel(-1, "imperial")).toBe("Lose 2 lb per week");
    expect(paceLabel(-0.75, "imperial")).toBe("Lose 1.5 lb per week");
    expect(paceLabel(0.25, "imperial")).toBe("Gain 0.5 lb per week");
    expect(paceLabel(-0.1, "imperial")).toBe("Lose 0.2 lb per week");
  });
  it("shows kilograms for metric and a maintain label for 0", () => {
    expect(paceLabel(-0.25, "metric")).toBe("Lose 0.25 kg per week");
    expect(paceLabel(0.5, "metric")).toBe("Gain 0.5 kg per week");
    expect(paceLabel(0, "metric")).toBe("Maintain my weight");
  });
});

describe("paceOptions", () => {
  it("offers every pace without a goal weight", () => {
    expect(paceOptions(WEEKLY_RATES_KG, 80, null)).toEqual([...WEEKLY_RATES_KG]);
  });
  it("only offers losing paces when the goal is lower", () => {
    expect(paceOptions(WEEKLY_RATES_KG, 90, 80)).toEqual([-1, -0.75, -0.5, -0.25]);
  });
  it("only offers gaining paces when the goal is higher", () => {
    expect(paceOptions(WEEKLY_RATES_KG, 70, 75)).toEqual([0.25, 0.5]);
  });
  it("only offers maintain when already at the goal", () => {
    expect(paceOptions(WEEKLY_RATES_KG, 70, 70.2)).toEqual([0]);
  });
});

describe("dates", () => {
  it("adds whole weeks", () => {
    expect(goalDate("2026-10-17", 2)).toBe("2026-10-31");
    expect(goalDate("2026-10-17", 0)).toBe("2026-10-17");
  });
  it("formats a long date", () => {
    expect(formatLongDate("2027-03-14")).toBe("Mar 14, 2027");
  });
});

describe("workoutMinutes", () => {
  it("subtracts pauses", () => {
    expect(workoutMinutes("2026-10-17T10:00:00Z", "2026-10-17T11:00:00Z", 600)).toBe(50);
  });
  it("is 0 for unfinished or invalid workouts", () => {
    expect(workoutMinutes("2026-10-17T10:00:00Z", null)).toBe(0);
    expect(workoutMinutes("2026-10-17T10:00:00Z", "2026-10-17T09:00:00Z")).toBe(0);
  });
  it("caps abandoned timers at 4 hours", () => {
    expect(workoutMinutes("2026-10-17T00:00:00Z", "2026-10-18T00:00:00Z")).toBe(240);
  });
});

describe("weeklySummary", () => {
  it("averages only logged days and counts under/over", () => {
    const s = weeklySummary([{ calories: 0 }, { calories: 1800 }, { calories: 2200 }, { calories: 2000 }], 2000);
    expect(s).toEqual({ daysLogged: 3, average: 2000, under: 2, over: 1, total: 6000 });
  });
  it("handles an empty week and no goal", () => {
    expect(weeklySummary([{ calories: 0 }], null)).toEqual({ daysLogged: 0, average: 0, under: 0, over: 0, total: 0 });
  });
});

describe("weightGoalProgress", () => {
  it("measures progress toward a lower goal", () => {
    expect(weightGoalProgress(90, 85, 80)).toBe(50);
  });
  it("measures progress toward a higher goal", () => {
    expect(weightGoalProgress(70, 72, 75)).toBe(40);
  });
  it("clamps going the wrong way and past the goal", () => {
    expect(weightGoalProgress(90, 92, 80)).toBe(0);
    expect(weightGoalProgress(90, 78, 80)).toBe(100);
  });
});

describe("recentAndFrequent", () => {
  const item = (id: string, name: string, calories: number, loggedAt: string) => ({ id, name, calories, protein_g: 0, carbs_g: 0, fat_g: 0, loggedAt });
  it("merges identical foods, orders recent newest-first and frequent by count", () => {
    const { recent, frequent } = recentAndFrequent([
      item("1", "Oatmeal", 300, "2026-10-15T08:00:00Z"),
      item("2", "Banana", 105, "2026-10-16T08:00:00Z"),
      item("3", "oatmeal ", 300, "2026-10-17T08:00:00Z"),
      item("4", "Oatmeal", 450, "2026-10-14T08:00:00Z"),
    ]);
    expect(recent.map((r) => [r.id, r.count])).toEqual([
      ["3", 2],
      ["2", 1],
      ["4", 1],
    ]);
    expect(frequent.map((f) => f.id)).toEqual(["3"]);
  });
  it("respects the limit", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(String(i), `Food ${i}`, 100, `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    expect(recentAndFrequent(items, 5).recent).toHaveLength(5);
  });
});

describe("bmi", () => {
  it("computes BMI", () => {
    expect(bmi(70, 175)).toBe(22.9);
  });
});
