import { mealForTime } from "@/lib/domain/meal-time";

const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m);

describe("mealForTime", () => {
  it("picks the meal for the time of day", () => {
    expect(mealForTime(at(6))).toBe("breakfast");
    expect(mealForTime(at(10, 29))).toBe("breakfast");
    expect(mealForTime(at(10, 30))).toBe("lunch");
    expect(mealForTime(at(13))).toBe("lunch");
    expect(mealForTime(at(15))).toBe("snack");
    expect(mealForTime(at(18, 45))).toBe("dinner");
    expect(mealForTime(at(22))).toBe("snack");
    expect(mealForTime(at(0, 30))).toBe("breakfast");
  });
});
