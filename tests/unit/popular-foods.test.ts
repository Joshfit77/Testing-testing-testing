import { describe, expect, it } from "vitest";
import { POPULAR_FOODS } from "@/data/popular-foods";
import db from "@/data/usda-foods.json";

const ids = new Map((db as unknown as { foods: [number, string, ...unknown[]][] }).foods.map((f) => [f[0], f[1]]));

describe("popular foods", () => {
  it("every entry points at a USDA record", () => {
    const missing = POPULAR_FOODS.filter((p) => !ids.has(p.fdcId));
    expect(missing).toEqual([]);
  });
  it("has unique names and ids", () => {
    expect(new Set(POPULAR_FOODS.map((p) => p.name)).size).toBe(POPULAR_FOODS.length);
    expect(new Set(POPULAR_FOODS.map((p) => p.fdcId)).size).toBe(POPULAR_FOODS.length);
  });
});
