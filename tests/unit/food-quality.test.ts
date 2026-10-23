import { describe, expect, it } from "vitest";
import {
  ADDITIVES,
  addedSugarIngredients,
  alternativeReasons,
  checkFilters,
  comparable,
  describeAdditive,
  normalizeQualityProduct,
  nutrientLevels,
  percentOfReference,
  pickAlternatives,
  safeImageUrl,
  sanitizeFilters,
  thresholdsMet,
} from "@/lib/food-quality";
import { productFactsForAi } from "@/lib/food-quality-ai";

const off = (product: Record<string, unknown>, code = "3017620422003") => normalizeQualityProduct({ status: 1, code, product: { code, ...product } }, code)!;

const cereal = (over: Record<string, unknown> = {}, nutr: Record<string, number> = {}) =>
  off(
    {
      product_name: "Honey Crunch",
      brands: "Morning Co, Other",
      quantity: "500 g",
      serving_size: "40 g",
      serving_quantity: 40,
      nutriments: { "energy-kcal_100g": 400, proteins_100g: 8, carbohydrates_100g: 80, sugars_100g: 30, fat_100g: 5, "saturated-fat_100g": 1, fiber_100g: 4, salt_100g: 0.8, ...nutr },
      nutriscore_grade: "d",
      nova_group: 4,
      categories_tags: ["en:plant-based-foods", "en:cereals-and-potatoes", "en:breakfast-cereals"],
      ingredients_text: "Wheat flour, sugar, glucose syrup, honey (3%), salt, emulsifier: E322",
      allergens_tags: ["en:gluten"],
      traces_tags: ["en:nuts"],
      additives_tags: ["en:e322"],
      ingredients_analysis_tags: ["en:palm-oil-free", "en:non-vegan", "en:vegetarian"],
      labels_tags: ["en:no-artificial-colours"],
      image_front_small_url: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.200.jpg",
      ...over,
    },
    String(over.code ?? "3017620422003"),
  );

describe("food quality: product facts", () => {
  it("normalises an Open Food Facts product, keeping missing values as unavailable", () => {
    const p = cereal({}, { fiber_100g: undefined as unknown as number });
    expect(p).toMatchObject({ name: "Honey Crunch", brand: "Morning Co", unit: "g", servingQuantity: 40, nova: 4, category: "en:breakfast-cereals", vegan: "no", vegetarian: "yes", palmOil: "no" });
    expect(p.nutriScore).toEqual({ grade: "d", status: "graded" });
    expect(p.per100).toMatchObject({ calories: 400, sugars_g: 30, salt_g: 0.8, sodium_mg: 320, fiber_g: null, added_sugars_g: null });
    expect(p.perServing).toMatchObject({ calories: 160, sugars_g: 12, fiber_g: null });
    expect(p.additives).toEqual(["e322"]);
    expect(p.imageUrl).toContain("images.openfoodfacts.org");
  });

  it("handles not-applicable Nutri-Scores, drinks, missing data and unknown products", () => {
    expect(cereal({ nutriscore_grade: "not-applicable" }).nutriScore).toEqual({ grade: null, status: "not_applicable" });
    expect(cereal({ nutriscore_grade: "unknown" }).nutriScore.status).toBe("unknown");
    expect(off({ product_name: "Cola", quantity: "330 ml", nutriments: { "energy-kcal_100g": 42, sugars_100g: 10.6 } }).unit).toBe("ml");
    const bare = off({ product_name: "Mystery" });
    expect(bare.incomplete).toEqual(["ingredients", "nutrition", "categories"]);
    expect(bare.perServing).toBeNull();
    expect(normalizeQualityProduct({ status: 0 }, "123")).toBeNull();
  });

  it("only accepts https images from Open Food Facts", () => {
    expect(safeImageUrl("https://images.openfoodfacts.org/x.jpg")).toBeTruthy();
    expect(safeImageUrl("http://images.openfoodfacts.org/x.jpg")).toBeNull();
    expect(safeImageUrl("https://evil.example/openfoodfacts.org.jpg")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("food quality: indicators", () => {
  it("applies the UK front-of-pack thresholds per 100 g and 100 ml", () => {
    const levels = nutrientLevels(cereal().per100, "g");
    expect(Object.fromEntries(levels.map((l) => [l.key, l.level]))).toEqual({ fat_g: "medium", sat_fat_g: "low", sugars_g: "high", salt_g: "medium" });
    const drink = nutrientLevels({ ...cereal().per100, sugars_g: 10.6, fat_g: 0, sat_fat_g: 0, salt_g: 0 }, "ml");
    expect(drink.find((l) => l.key === "sugars_g")!.level).toBe("medium"); // 2.5 < 10.6 ≤ 11.25
    expect(nutrientLevels({ ...cereal().per100, salt_g: null }, "g").find((l) => l.key === "salt_g")!.level).toBeNull();
  });

  it("uses EU reference intakes and claim thresholds without inventing a score", () => {
    expect(percentOfReference("sugars_g", 12)).toBe(13);
    expect(percentOfReference("fiber_g", 4)).toBeNull(); // no EU reference intake for fibre
    expect(thresholdsMet({ ...cereal().per100, protein_g: 25, calories: 400, fiber_g: 7 }, "g")).toEqual(expect.arrayContaining([expect.stringMatching(/^High protein/), expect.stringMatching(/^High fibre/)]));
    // 1 g saturated fat per 100 g, about 2% of energy: meets "low saturated fat"; 30 g sugars doesn't meet "low sugars".
    expect(thresholdsMet(cereal().per100, "g")).toEqual(["Source of fibre (at least 3 g per 100 g)", "Low saturated fat"]);
  });

  it("finds forms of sugar in ingredients and ignores 'no added sugar' wording", () => {
    expect(addedSugarIngredients("Wheat flour, sugar, glucose syrup, honey (3%), salt")).toEqual(["glucose syrup", "honey", "sugar"]);
    expect(addedSugarIngredients("Oats. No added sugar.")).toEqual([]);
    expect(addedSugarIngredients(null)).toEqual([]);
  });

  it("describes additives neutrally, with regulatory notes only", () => {
    expect(describeAdditive("e951")).toMatchObject({ code: "E951", name: "Aspartame", note: expect.stringContaining("phenylketonuria") });
    expect(describeAdditive("e129").note).toContain("Regulation (EC) No 1333/2008");
    expect(describeAdditive("e9999")).toMatchObject({ code: "E9999", name: "No description in the app yet" });
    const all = JSON.stringify(Object.values(ADDITIVES));
    expect(all).not.toMatch(/\b(toxic|dangerous|harmful|causes? cancer|carcinogen|unhealthy)\b/i);
  });
});

describe("food quality: filters, comparisons, alternatives", () => {
  it("never treats missing allergen data as safe", () => {
    const f = sanitizeFilters({ allergens: ["en:gluten", "en:nuts", "en:milk", "bogus"], diet: "vegan", nutrition: ["low_sugar", "high_protein", "nope"] });
    expect(f).toEqual({ allergens: ["en:gluten", "en:nuts", "en:milk"], diet: "vegan", nutrition: ["low_sugar", "high_protein"] });
    const r = checkFilters(cereal(), f).map((x) => x.status);
    expect(r).toEqual(["conflict", "caution", "ok", "conflict", "conflict", "conflict"]);
    const unknown = checkFilters(off({ product_name: "Mystery" }), f).map((x) => x.status);
    expect(unknown).toEqual(["unknown", "unknown", "unknown", "unknown", "unknown", "unknown"]);
  });

  it("only compares products of the same kind", () => {
    const granola = cereal({ code: "0000000000017", product_name: "Plain Granola" });
    const cola = off({ product_name: "Cola", quantity: "330 ml", categories_tags: ["en:beverages", "en:sodas"] }, "5449000000996");
    const chips = off({ product_name: "Chips", categories_tags: ["en:snacks", "en:crisps"] }, "5000328000005");
    expect(comparable(cereal(), granola)).toMatchObject({ ok: true, reason: 'Both are in "Breakfast cereals".' });
    expect(comparable(cereal(), cola).ok).toBe(false);
    expect(comparable(cereal(), chips)).toMatchObject({ ok: false });
  });

  it("suggests an alternative only when it's clearly better, and explains why", () => {
    const base = cereal();
    const better = cereal({ code: "0000000000017", product_name: "Oat Hoops", nutriscore_grade: "b", nova_group: 3 }, { sugars_100g: 12, fiber_100g: 8 });
    const sideways = cereal({ code: "0000000000024", product_name: "Choco Puffs", nutriscore_grade: "d" }, { sugars_100g: 29 });
    const worse = cereal({ code: "0000000000031", product_name: "Frosted", nutriscore_grade: "e" }, { sugars_100g: 10 });
    expect(alternativeReasons(base, better)).toEqual(["Nutri-Score B instead of D", "Less processed (NOVA 3 instead of 4)", "Less sugar: 12 g vs 30 g per 100 g", "More fibre: 8 g vs 4 g per 100 g"]);
    expect(alternativeReasons(base, sideways)).toEqual([]);
    expect(alternativeReasons(base, worse)).toEqual([]); // less sugar, but a worse Nutri-Score
    const picked = pickAlternatives(base, [base, sideways, worse, better, better], null);
    expect(picked.map((x) => x.product.name)).toEqual(["Oat Hoops"]);
    // A member avoiding gluten isn't offered another gluten product.
    expect(pickAlternatives(base, [better], { allergens: ["en:gluten"], diet: "none", nutrition: [] })).toEqual([]);
  });

  it("gives the AI only known facts and marks the rest as not available", () => {
    const facts = productFactsForAi(cereal({}, { fiber_100g: undefined as unknown as number }));
    expect(facts).toContain("fibre (g): not available");
    expect(facts).toContain("Nutri-Score: D");
    expect(facts).toContain("Forms of sugar in the ingredient list: glucose syrup, honey, sugar");
    expect(facts).toContain("Declared allergens: Gluten (wheat, rye, barley, oats)");
  });
});
