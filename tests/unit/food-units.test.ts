import { describe, expect, it } from "vitest";
import { GRAMS_PER_OZ, describeAmount, nutritionForGrams, parseQuantity, toGrams, unitOptions } from "@/lib/domain/food-units";

const chicken = { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74 };

describe("food units", () => {
  it("offers grams, ounces and pounds plus USDA portions and the label serving", () => {
    const u = unitOptions({ portions: [{ label: "1 cup, chopped or diced", grams: 140 }], servingGrams: 60, servingLabel: "1 bar (60 g)" });
    expect(u.map((x) => x.id)).toEqual(["serving", "p0", "g", "oz", "lb"]);
    expect(u[0]!.label).toBe("serving (1 bar (60 g))");
  });
  it("offers ml and fl oz for drinks", () => {
    expect(unitOptions({ liquid: true }).map((x) => x.id)).toEqual(["ml", "floz"]);
  });
  it("converts ounces to grams and scales nutrition", () => {
    const oz = unitOptions({}).find((x) => x.id === "oz")!;
    const g = toGrams(6, oz);
    expect(g).toBeCloseTo(6 * GRAMS_PER_OZ, 5);
    const n = nutritionForGrams(chicken, g);
    expect(n.calories).toBe(281);
    expect(n.protein_g).toBeCloseTo(52.7, 1);
    expect(n.sodium_mg).toBe(126);
  });
  it("describes amounts", () => {
    const [cup] = unitOptions({ portions: [{ label: "1 cup, chopped", grams: 140 }] });
    expect(describeAmount(1.5, cup!)).toBe("1.5 cup, chopped (210 g)");
    expect(describeAmount(150, { id: "g", label: "g", grams: 1 })).toBe("150 g");
    const [bar] = unitOptions({ servingGrams: 68, servingLabel: "1 bar (68 g)" });
    expect(describeAmount(1, bar!)).toBe("1 bar (68 g)");
    expect(describeAmount(2, bar!)).toBe("2 × 1 bar (68 g) = 136 g");
    const [cupServing] = unitOptions({ servingGrams: 240, servingLabel: "1 cup" });
    expect(describeAmount(1, cupServing!)).toBe("1 cup (240 g)");
  });
  it("parses fractions", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("3/4")).toBe(0.75);
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity("abc")).toBeNaN();
  });
  it("treats zero or negative amounts as nothing", () => {
    expect(toGrams(-1, { id: "g", label: "g", grams: 1 })).toBe(0);
    expect(nutritionForGrams(chicken, 0).calories).toBe(0);
  });
});
