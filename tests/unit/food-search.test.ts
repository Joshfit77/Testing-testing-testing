import { describe, expect, it } from "vitest";
import { prepareEntry, rankFoods, scoreEntry, tokenize } from "@/lib/domain/food-search";
import { browseCategory, getLocalFood, popularFoods, searchLocalFoods, searchUsda, usdaCategories } from "@/server/services/usda-local";

const names = (list: string[], q: string, limit = 30) => rankFoods(list, q, (n) => prepareEntry(n), limit);

describe("food search ranking (pure)", () => {
  it("tokenizes USDA names", () => {
    expect(tokenize("Beef, ground, 90% lean meat / 10% fat, raw")).toEqual(["beef", "ground", "90%", "lean", "meat", "10%", "fat", "raw"]);
    expect(tokenize("McDONALD'S, Big Mac")).toEqual(["mcdonalds", "big", "mac"]);
  });
  it("requires every query word to match the start of a word", () => {
    const e = prepareEntry("Chicken, broilers or fryers, breast, meat only, cooked, roasted");
    expect(scoreEntry(e, ["chick", "bre"])).not.toBeNull();
    expect(scoreEntry(e, ["icken"])).toBeNull();
    expect(scoreEntry(e, ["chicken", "thigh"])).toBeNull();
  });
  it("matches simple plurals both ways", () => {
    expect(names(["Egg, whole, raw, fresh"], "eggs")).toHaveLength(1);
    expect(names(["Bananas, raw"], "banana")).toHaveLength(1);
    expect(names(["Cherries, sweet, raw"], "cherry")).toHaveLength(1);
  });
  it("prefers matches in the first segment, plain forms and shorter names", () => {
    const list = ["Pie, banana cream, prepared from recipe", "Bananas, dehydrated, or banana powder", "Bananas, raw", "Pepper, banana, raw"];
    expect(names(list, "banana")[0]).toBe("Bananas, raw");
  });
  it("puts unasked-for processed forms after the plain food", () => {
    const list = ["Chicken breast tenders, breaded, cooked, microwaved", "Chicken, broilers or fryers, breast, meat only, cooked, roasted"];
    expect(names(list, "chicken breast")[0]).toBe("Chicken, broilers or fryers, breast, meat only, cooked, roasted");
  });
  it("applies category boosts", () => {
    const deli = { name: "Chicken breast, roll, oven-roasted", boost: -10 };
    const plain = { name: "Chicken, broilers or fryers, breast, meat only, cooked, roasted", boost: 0 };
    expect(rankFoods([deli, plain], "chicken breast", (f) => prepareEntry(f.name, f.boost))[0]).toBe(plain);
  });
  it("returns nothing for an empty query and respects the limit", () => {
    expect(names(["Bananas, raw"], "  ")).toEqual([]);
    expect(names(["Rice, white", "Rice, brown", "Rice flour"], "rice", 2)).toHaveLength(2);
  });
});

describe("USDA SR Legacy database search (server)", () => {
  it("loads the 24 USDA food groups", async () => {
    const cats = await usdaCategories();
    expect(cats).toHaveLength(24);
    expect(cats).toContain("Poultry Products");
  });
  it("finds the plain roasted chicken breast ahead of deli chicken", async () => {
    const all = await searchLocalFoods("chicken breast", { limit: 30 });
    const ids = all.map((f) => f.fdcId);
    expect(ids).toContain(171477);
    const deli = ids.indexOf(174608); // Chicken breast, roll, oven-roasted (luncheon meat)
    expect(deli === -1 || deli > ids.indexOf(171477)).toBe(true);
    expect(all[0]!.category).toBe("Poultry Products");
  });
  it("shows popular foods first with friendly names, without duplicates", async () => {
    const res = await searchUsda("chicken breast");
    expect(res[0]!.popular).toBe(true);
    expect(res.slice(0, 2).map((f) => f.name)).toEqual(expect.arrayContaining(["Chicken breast, cooked (roasted)"]));
    const ids = res.map((f) => f.fdcId);
    expect(new Set(ids).size).toBe(ids.length);
    const egg = await searchUsda("egg");
    expect(egg[0]!.fdcId).toBe(171287);
    expect(egg[0]!.usdaName).toBe("Egg, whole, raw, fresh");
    expect((await searchUsda("steak")).some((f) => f.popular && /sirloin/i.test(f.name))).toBe(true);
    expect((await popularFoods()).length).toBeGreaterThan(50);
  });
  it("returns per-100 g values and USDA portions", async () => {
    const f = await getLocalFood(171477);
    expect(f?.basis.per100).toMatchObject({ calories: 165, protein_g: 31, fat_g: 3.6 });
    expect(f?.basis.portions?.[0]).toEqual({ label: "1 cup, chopped or diced", grams: 140 });
    expect(await getLocalFood(1)).toBeNull();
  });
  it("browses a category alphabetically with pagination, optionally filtered", async () => {
    const cats = await usdaCategories();
    const fruits = cats.indexOf("Fruits and Fruit Juices");
    const page1 = await browseCategory(fruits, "", 0, 40);
    const page2 = await browseCategory(fruits, "", 40, 40);
    expect(page1.total).toBeGreaterThan(300);
    expect(page1.foods).toHaveLength(40);
    expect(page2.foods[0]!.fdcId).not.toBe(page1.foods[0]!.fdcId);
    expect(page1.foods.every((f) => f.category === "Fruits and Fruit Juices")).toBe(true);
    const apples = await browseCategory(fruits, "apple", 0, 40);
    expect(apples.foods.length).toBeGreaterThan(3);
    expect(apples.foods.every((f) => /apple/i.test(f.name))).toBe(true);
  });
});
