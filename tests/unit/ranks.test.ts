import { describe, expect, it } from "vitest";
import { BSB_PASSAGES } from "@/data/scripture";
import { RANKS, RANK_CATEGORIES, allRankProgress, categoryProgress, ranksEarnedOn } from "@/lib/domain/ranks";
import { BADGE_CATALOG } from "@/lib/domain/achievements";

const days = (n: number, start = "2026-01-01") => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

describe("27 rank badges", () => {
  it("has nine ranks per category with rising thresholds and the designed names", () => {
    for (const c of RANK_CATEGORIES) {
      const list = RANKS.filter((r) => r.category === c.id);
      expect(list.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (let i = 1; i < list.length; i++) expect(list[i]!.threshold).toBeGreaterThan(list[i - 1]!.threshold);
      expect(list[0]!.threshold).toBe(1);
    }
    expect(RANKS.filter((r) => r.category === "fitness").map((r) => r.name)).toEqual(["Foundation", "Faithful", "Endurance", "Disciplined", "Refined", "Steadfast", "Overcomer", "Mighty", "Conqueror"]);
    expect(RANKS.filter((r) => r.category === "food").map((r) => r.name)).toEqual(["Spark", "Ember", "Flame", "Torch", "Blaze", "Furnace", "Forge", "Inferno", "Phoenix"]);
    expect(RANKS.filter((r) => r.category === "faith").map((r) => r.name)).toEqual(["Seed", "Sprout", "Sapling", "Root", "Branch", "Vine", "Fruit", "Olive", "Cedar"]);
  });

  it("reuses the existing workout and food-logging badge thresholds", () => {
    const fitness = RANKS.filter((r) => r.category === "fitness").map((r) => r.threshold);
    const food = RANKS.filter((r) => r.category === "food").map((r) => r.threshold);
    for (const id of ["first-workout", "workouts-10", "workouts-25", "workouts-50", "workouts-100"]) expect(fitness).toContain(BADGE_CATALOG.find((b) => b.id === id)!.target);
    for (const id of ["food-7", "food-30", "food-100"]) expect(food).toContain(BADGE_CATALOG.find((b) => b.id === id)!.target);
  });

  it("has official BSB text for every rank's Scripture reference", () => {
    for (const r of RANKS) expect(BSB_PASSAGES[r.reference], r.reference).toBeTruthy();
  });

  it("counts workouts, but food and faith only once per day, so repeats never double-award", () => {
    const sameDay = Array(12).fill("2026-03-01");
    expect(categoryProgress("fitness", { workoutDates: sameDay, foodDays: [], faithDays: [] }).current?.name).toBe("Faithful");
    expect(categoryProgress("food", { workoutDates: [], foodDays: sameDay, faithDays: [] }).count).toBe(1);
    expect(categoryProgress("faith", { workoutDates: [], foodDays: [], faithDays: [...days(7), ...days(7)] }).current?.name).toBe("Sprout");
  });

  it("records the date each rank was reached and the progress to the next", () => {
    const p = categoryProgress("food", { workoutDates: [], foodDays: days(20), faithDays: [] });
    expect(p.current?.name).toBe("Flame");
    expect(p.ranks.find((r) => r.name === "Ember")?.earnedAt).toBe("2026-01-07");
    expect(p.ranks.find((r) => r.name === "Flame")?.earnedAt).toBe("2026-01-14");
    expect(p.next?.name).toBe("Torch");
    expect(p.percentToNext).toBe(Math.round(((20 - 14) / (30 - 14)) * 100));
    expect(ranksEarnedOn([p], "2026-01-14").map((r) => r.name)).toEqual(["Flame"]);
  });

  it("never takes a rank away for rest: gaps between days don't matter", () => {
    const spread = days(30).filter((_, i) => i % 3 === 0); // 10 days spread over a month
    expect(categoryProgress("faith", { workoutDates: [], foodDays: [], faithDays: spread }).current?.name).toBe("Sprout");
  });

  it("starts empty with progress toward the first rank, and reports full completion at rank nine", () => {
    const empty = allRankProgress({ workoutDates: [], foodDays: [], faithDays: [] });
    for (const p of empty) {
      expect(p.current).toBeNull();
      expect(p.next?.level).toBe(1);
      expect(p.percentToNext).toBe(0);
    }
    const all = categoryProgress("fitness", { workoutDates: days(700), foodDays: [], faithDays: [] });
    expect(all.current?.name).toBe("Conqueror");
    expect(all.next).toBeNull();
    expect(all.percentToNext).toBe(100);
  });
});
