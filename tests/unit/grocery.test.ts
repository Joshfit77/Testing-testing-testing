import { describe, expect, it } from "vitest";
import { classifyUnit, displayAmount, mergeGroceries } from "@/lib/domain/grocery";

describe("grocery unit classes", () => {
  it("knows weights, volumes and counted units", () => {
    expect(classifyUnit("g")).toEqual({ dim: "mass", factor: 1 });
    expect(classifyUnit("oz").dim).toBe("mass");
    expect(classifyUnit("lb").factor).toBeCloseTo(453.59, 1);
    expect(classifyUnit("3 oz")).toMatchObject({ dim: "mass" });
    expect(classifyUnit("3 oz").factor).toBeCloseTo(85.05, 1);
    expect(classifyUnit("1 oz (23 whole kernels)").dim).toBe("mass");
    expect(classifyUnit("ml")).toEqual({ dim: "volume", factor: 1 });
    expect(classifyUnit("fl oz").dim).toBe("volume");
    expect(classifyUnit("1 fl oz").dim).toBe("volume");
    expect(classifyUnit("1 cup, chopped")).toMatchObject({ dim: "volume" });
    expect(classifyUnit("0.5 cup, chopped").factor).toBeCloseTo(118.3, 1);
    expect(classifyUnit("2 tbsp").factor).toBeCloseTo(29.57, 1);
    expect(classifyUnit("1 tsp").dim).toBe("volume");
    expect(classifyUnit("1 large")).toEqual({ dim: "count", label: "large", factor: 1 });
    expect(classifyUnit('1 medium (7" to 7-7/8" long)')).toEqual({ dim: "count", label: "medium", factor: 1 });
    expect(classifyUnit("0.25 block")).toEqual({ dim: "count", label: "block", factor: 0.25 });
    expect(classifyUnit("serving (1 bar (60 g))")).toMatchObject({ dim: "count", label: "serving" });
  });

  it("shows amounts in the person's units", () => {
    expect(displayAmount("mass", 450, "metric")).toEqual({ quantity: 450, unit: "g" });
    expect(displayAmount("mass", 1500, "metric")).toEqual({ quantity: 1.5, unit: "kg" });
    expect(displayAmount("mass", 226.8, "imperial")).toEqual({ quantity: 8, unit: "oz" });
    expect(displayAmount("mass", 907.2, "imperial")).toEqual({ quantity: 2, unit: "lb" });
    expect(displayAmount("volume", 473.2, "imperial")).toEqual({ quantity: 2, unit: "cups" });
    expect(displayAmount("volume", 29.6, "imperial")).toEqual({ quantity: 2, unit: "tbsp" });
    expect(displayAmount("volume", 250, "metric")).toEqual({ quantity: 250, unit: "ml" });
  });
});

describe("grocery merging", () => {
  it("combines the same ingredient across meals when the units convert", () => {
    const lines = mergeGroceries(
      [
        { key: "usda:171477", name: "Chicken breast", quantity: 120, unitLabel: "g" },
        { key: "usda:171477", name: "Chicken breast", quantity: 4, unitLabel: "oz" },
        { key: "usda:171477", name: "Chicken breast", quantity: 1, unitLabel: "lb" },
      ],
      "metric",
    );
    expect(lines).toEqual([{ key: "usda:171477", name: "Chicken breast", quantity: 687, unit: "g", note: null }]);
  });

  it("adds volumes in different household units", () => {
    const lines = mergeGroceries(
      [
        { key: "usda:168878", name: "White rice", quantity: 1, unitLabel: "1 cup" },
        { key: "usda:168878", name: "White rice", quantity: 0.75, unitLabel: "1 cup" },
        { key: "usda:168878", name: "White rice", quantity: 4, unitLabel: "1 tbsp" },
      ],
      "imperial",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 2, unit: "cups", note: null });
  });

  it("keeps amounts that can't be converted on separate lines, with a note", () => {
    const lines = mergeGroceries(
      [
        { key: "usda:171287", name: "Egg", quantity: 2, unitLabel: "1 large" },
        { key: "usda:171287", name: "Egg", quantity: 3, unitLabel: "1 large" },
        { key: "usda:171287", name: "Egg", quantity: 100, unitLabel: "g" },
      ],
      "metric",
    );
    expect(lines).toHaveLength(2);
    const count = lines.find((l) => l.unit === "large")!;
    const mass = lines.find((l) => l.unit === "g")!;
    expect(count.quantity).toBe(5);
    expect(mass.quantity).toBe(100);
    expect(count.note).toMatch(/Also on the list as 100 g/);
    expect(count.note).toMatch(/can't be combined/);
    expect(mass.note).toMatch(/5 large/);
  });

  it("only combines counted units with the same unit", () => {
    const lines = mergeGroceries(
      [
        { key: "usda:173944", name: "Banana", quantity: 1, unitLabel: '1 medium (7" to 7-7/8" long)' },
        { key: "usda:173944", name: "Banana", quantity: 2, unitLabel: '1 large (8" to 8-7/8" long)' },
      ],
      "imperial",
    );
    expect(lines.map((l) => `${l.quantity} ${l.unit}`).sort()).toEqual(["1 medium", "2 large"]);
    expect(lines.every((l) => l.note)).toBe(true);
  });

  it("keeps different ingredients apart and ignores zero amounts", () => {
    const lines = mergeGroceries(
      [
        { key: "usda:1", name: "Spinach", quantity: 30, unitLabel: "g" },
        { key: "usda:2", name: "Apple", quantity: 1, unitLabel: "1 medium" },
        { key: "usda:3", name: "Olive oil", quantity: 0, unitLabel: "1 tsp" },
      ],
      "metric",
    );
    expect(lines.map((l) => l.name)).toEqual(["Apple", "Spinach"]);
  });
});
