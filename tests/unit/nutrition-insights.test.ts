import { describe, expect, it } from "vitest";
import { pctOfTarget, summarizeDay, weeklyInsights, type InsightItem } from "@/lib/domain/nutrition-insights";

const item = (date: string, name: string, calories: number, protein_g: number, source: string | null = null, extra: Partial<InsightItem> = {}): InsightItem => ({
  date,
  name,
  source,
  calories,
  protein_g,
  carbs_g: 10,
  fat_g: 5,
  ...extra,
});

const DATES = ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"];

describe("weekly nutrition insights", () => {
  const items = [
    item("2026-10-15", "Chicken breast", 500, 60, "usda:171477"),
    item("2026-10-15", "Rice", 300, 6, "usda:168878"),
    item("2026-10-16", "Chicken breast", 400, 48, "usda:171477"),
    item("2026-10-16", "Oatmeal", 300, 10, "usda:173905"),
    item("2026-10-18", "Black coffee", 0, 0, "usda:171890"),
    item("2026-10-20", "Protein bar", 200, 20, "off:12345678", { missing: ["carbs_g"] }),
  ];
  const marks = new Map([
    ["2026-10-17", "fasted" as const],
    ["2026-10-16", "complete" as const],
  ]);
  const week = weeklyInsights(DATES, items, marks);

  it("tells not-logged days from days logged as zero", () => {
    const state = Object.fromEntries(week.days.map((d) => [d.date, d.state]));
    expect(state).toEqual({
      "2026-10-15": "logged",
      "2026-10-16": "logged",
      "2026-10-17": "logged_zero", // marked as a fast
      "2026-10-18": "logged_zero", // only a zero-calorie drink
      "2026-10-19": "not_logged",
      "2026-10-20": "logged",
      "2026-10-21": "not_logged",
    });
    expect(week.loggedDays).toBe(5);
    expect(week.notLoggedDays).toBe(2);
    expect(week.days.find((d) => d.date === "2026-10-16")!.markedComplete).toBe(true);
    expect(week.days.find((d) => d.date === "2026-10-15")!.markedComplete).toBe(false);
  });

  it("averages over logged days only, counting zero days as zero", () => {
    // (800 + 700 + 0 + 0 + 200) / 5 logged days; the two unlogged days are left out.
    expect(week.average?.calories).toBe(340);
    expect(week.average?.protein_g).toBe(Math.round((66 + 58 + 0 + 0 + 20) / 5));
  });

  it("flags totals that include missing values instead of treating them as zero", () => {
    expect(week.days.find((d) => d.date === "2026-10-20")!.incomplete).toEqual(["carbs_g"]);
    expect(week.averageIncomplete).toEqual(["carbs_g"]);
  });

  it("ranks the top protein and calorie sources", () => {
    expect(week.topProtein[0]).toMatchObject({ name: "Chicken breast", amount: 108, times: 2 });
    expect(week.topProtein.map((s) => s.name)).toEqual(["Chicken breast", "Protein bar", "Oatmeal", "Rice"]);
    expect(week.topProtein.reduce((s, x) => s + x.share, 0)).toBeGreaterThanOrEqual(99);
    expect(week.topCalories[0]).toMatchObject({ name: "Chicken breast", amount: 900 });
    // Zero-calorie items aren't "sources".
    expect(week.topCalories.map((s) => s.name)).not.toContain("Black coffee");
  });

  it("has no average when nothing was logged", () => {
    const empty = weeklyInsights(DATES, [], new Map());
    expect(empty.average).toBeNull();
    expect(empty.notLoggedDays).toBe(7);
    expect(empty.topProtein).toEqual([]);
  });

  it("a fasted mark doesn't hide food that was logged", () => {
    expect(summarizeDay("2026-10-17", [item("2026-10-17", "Apple", 95, 0)], "fasted").state).toBe("logged");
    expect(pctOfTarget(1500, 2000)).toBe(75);
    expect(pctOfTarget(1500, null)).toBeNull();
  });
});
