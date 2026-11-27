import { describe, expect, it } from "vitest";
import {
  diaryDayLabel,
  entryAmount,
  loggedMessage,
  mealPhrase,
  monthDay,
  quickFoodSummary,
  recentAndFrequent,
  shortDate,
  waterLabel,
  waterLitres,
} from "@/lib/domain/diary";

describe("loggedMessage (the confirmation shown with Undo)", () => {
  it("names the food, its amount and the meal", () => {
    expect(loggedMessage({ name: "Banana", amount: "1 medium", mealType: "breakfast" })).toBe("Logged Banana (1 medium) to breakfast.");
    expect(loggedMessage({ name: "Quick add", mealType: "lunch" })).toBe("Logged Quick add to lunch.");
    expect(loggedMessage({ name: "Oats", amount: null, mealType: "snack" })).toBe("Logged Oats to snacks.");
  });

  it("says Planned … for … when the food is planned", () => {
    expect(loggedMessage({ name: "Chili", amount: "1 serving", mealType: "dinner", planned: true })).toBe("Planned Chili (1 serving) for dinner.");
  });

  it("reads naturally after 'to'", () => {
    expect(mealPhrase("snack")).toBe("snacks");
    expect(mealPhrase("dinner")).toBe("dinner");
  });
});

describe("recent foods show the amount one tap logs", () => {
  it("uses the saved amount, else the servings when not one", () => {
    expect(entryAmount("1.5 cup (237 g)", 1.5)).toBe("1.5 cup (237 g)");
    expect(entryAmount("  ", 2)).toBe("2 servings");
    expect(entryAmount(null, 0.5)).toBe("0.5 servings");
    expect(entryAmount(null, 1)).toBeNull();
    expect(entryAmount(null, null)).toBeNull();
  });

  it("summarises amount, calories and protein", () => {
    expect(quickFoodSummary({ amount: "1.5 cup", calories: 308.4, protein_g: 6.3 })).toBe("1.5 cup · 308 kcal · P 6 g");
    expect(quickFoodSummary({ amount: null, calories: 200, protein_g: 0 })).toBe("200 kcal · P 0 g");
  });

  it("keeps the newest entry's amount when identical foods merge", () => {
    const { recent } = recentAndFrequent([
      { id: "a", name: "Rice", calories: 308, protein_g: 6, carbs_g: 67, fat_g: 1, loggedAt: "2026-11-01T08:00:00Z", amount: "1 cup" },
      { id: "b", name: "Rice", calories: 308, protein_g: 6, carbs_g: 67, fat_g: 1, loggedAt: "2026-11-08T08:00:00Z", amount: "1.5 cup" },
    ]);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ id: "b", amount: "1.5 cup", count: 2 });
  });
});

describe("human dates instead of ISO", () => {
  it("says Today / Yesterday / Tomorrow, else a short weekday date", () => {
    expect(diaryDayLabel("2026-11-09", "2026-11-09")).toBe("Today");
    expect(diaryDayLabel("2026-11-08", "2026-11-09")).toBe("Yesterday");
    expect(diaryDayLabel("2026-11-10", "2026-11-09")).toBe("Tomorrow");
    expect(diaryDayLabel("2026-11-02", "2026-11-09")).toBe("Mon, Nov 2");
    expect(shortDate("2026-11-09")).toBe("Mon, Nov 9");
    expect(monthDay("2026-11-09")).toBe("Nov 9");
  });
});

describe("water reads as litres of the goal", () => {
  it("drops trailing zeros: '0 of 2.7 L'", () => {
    expect(waterLabel(0, 2700)).toBe("0 of 2.7 L");
    expect(waterLabel(1250, 2500)).toBe("1.25 of 2.5 L");
    expect(waterLabel(500, 3000)).toBe("0.5 of 3 L");
    expect(waterLitres(-10, 2000)).toEqual({ total: "0", goal: "2" });
  });
});
