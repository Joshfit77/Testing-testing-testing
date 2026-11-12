import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bestMatch,
  HIDDEN_EXTRAS,
  isLoggableDate,
  macroCalories,
  matchStrength,
  namesAdditive,
  normalizeFoodPhoto,
  perGram,
  scaleToGrams,
  sniffImageType,
  type FoodPhotoOutput,
  type MatchedEstimate,
} from "@/lib/domain/food-photo";
import { initialItems } from "@/components/nutrition/food-photo-flow";
import { derivedClientId, isRepeatOf } from "@/server/services/idempotency";
import { searchUsda } from "@/server/services/usda-local";

const item = (over: Partial<FoodPhotoOutput["items"][number]> = {}): FoodPhotoOutput["items"][number] => ({
  name: "Grilled chicken breast",
  visible_ingredients: ["chicken"],
  portion: "a palm-sized fillet",
  grams: 150,
  calories: 248,
  protein_g: 46,
  carbs_g: 0,
  fat_g: 5.4,
  confidence: "medium",
  search_term: "chicken breast grilled",
  ...over,
});

const base = { photo_quality: "clear" as const, packaged: false };

describe("food photo estimates", () => {
  it("keeps sensible items, clamps numbers and flags calories that don't match the macros", () => {
    const out = normalizeFoodPhoto({
      ...base,
      is_food: true,
      summary: "  Chicken with rice. ",
      items: [item(), item({ name: "  ", calories: 100 }), item({ name: "Rice", calories: 900, protein_g: 4, carbs_g: 45, fat_g: 0.5, grams: -3 }), item({ name: "Huge", calories: 99999, protein_g: 9999 })],
      questions: [],
    });
    expect(out.isFood).toBe(true);
    expect(out.summary).toBe("Chicken with rice.");
    expect(out.items.map((i) => i.name)).toEqual(["Grilled chicken breast", "Rice", "Huge"]);
    expect(out.items[0]!.inconsistent).toBe(false); // 46×4 + 5.4×9 = 232.6 ≈ 248
    expect(out.items[1]!).toMatchObject({ grams: null, inconsistent: true }); // 900 kcal vs ~200 from macros
    expect(out.items[2]!).toMatchObject({ calories: 4000, protein_g: 300 });
  });

  it("always asks about oil or butter and sauces or dressings, and about portions when unsure", () => {
    const out = normalizeFoodPhoto({ ...base, is_food: true, summary: "", items: [item({ grams: null, confidence: "low" })], questions: [{ topic: "sauce", question: "Was there any sauce?" }] });
    expect(out.questions.map((q) => q.topic)).toEqual(["sauce", "cooking_oil", "portion"]);
    const confident = normalizeFoodPhoto({ ...base, is_food: true, summary: "", items: [item({ confidence: "high" })], questions: [{ topic: "butter", question: "Butter?" }, { topic: "butter", question: "Again?" }] });
    expect(confident.questions.map((q) => q.topic)).toEqual(["butter", "sauce"]);
  });

  it("returns nothing to log when the photo isn't food", () => {
    const out = normalizeFoodPhoto({ ...base, is_food: false, summary: "A cat.", items: [item()], questions: [] });
    expect(out).toMatchObject({ isFood: false, items: [], questions: [] });
  });

  it("recognises real image types by their bytes, not their name", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });

  it("uses the app's own USDA records and household measures for the hidden-extra shortcuts", () => {
    const usda = JSON.parse(readFileSync("src/data/usda-foods.json", "utf8")) as { foods: [number, string, number, number, number, number, number, number | null, number | null, number, [string, number][]][] };
    for (const x of HIDDEN_EXTRAS) {
      const f = usda.foods.find((r) => String(r[0]) === x.fdcId);
      expect(f, x.label).toBeDefined();
      const portions = f![10].map(([, g]) => g);
      const tbsp = f![10].find(([label]) => /tbsp|tablespoon/i.test(label))?.[1];
      // Each shortcut is one of the record's own measures, or a whole multiple / third of its tablespoon.
      const ok = portions.includes(x.grams) || (tbsp != null && [tbsp / 3, tbsp * 2].some((g) => Math.abs(g - x.grams) < 0.15));
      expect(ok, `${x.label}: ${x.grams} g vs ${JSON.stringify(f![10])}`).toBe(true);
    }
    expect(macroCalories(10, 10, 10)).toBe(170);
  });

  it("never lists additives or chemicals as visible ingredients, and passes on photo quality and packaging", () => {
    const out = normalizeFoodPhoto({
      ...base,
      photo_quality: "blurry",
      packaged: true,
      is_food: true,
      summary: "",
      items: [item({ visible_ingredients: ["rice", "E211 preservative", "artificial colouring", "MSG", "broccoli", "sodium nitrite", "aspartame"] })],
      questions: [],
    });
    expect(out.items[0]!.ingredients).toEqual(["rice", "broccoli"]);
    expect(out).toMatchObject({ photoQuality: "blurry", packaged: true });
    expect(namesAdditive("Egg")).toBe(false);
    expect(namesAdditive("e330")).toBe(true);
  });

  it("matches photo items to the USDA database only when the food is really the same", () => {
    const f = (name: string, category = "Poultry Products", popular = false) => ({ name, usdaName: name, category, popular });
    // The main food word must be in the term: a caesar salad is never a caesar dressing.
    expect(matchStrength("caesar salad", f("Salad dressing, caesar dressing, regular", "Fats and Oils"))).toBeNull();
    // Brands and restaurant items are never generic matches.
    expect(matchStrength("cheeseburger", f("McDONALD'S, Cheeseburger", "Fast Foods"))).toBeNull();
    // Raw meat isn't what's on a plate; a cooked one is.
    expect(matchStrength("chicken breast", f("Chicken breast, raw", "Poultry Products", true))).toBe("weak");
    expect(matchStrength("chicken breast", f("Chicken breast, cooked (roasted)", "Poultry Products", true))).toBe("strong");
    // No extra identity words ("toast" isn't French toast), but a curated food may name its usual kind.
    expect(matchStrength("toast", f("French toast, frozen, ready-to-heat", "Baked Products"))).toBe("weak");
    expect(matchStrength("rice", f("White rice, cooked", "Cereal Grains and Pasta", true))).toBe("strong");
    expect(matchStrength("potato", f("Sweet potato, baked", "Vegetables and Vegetable Products", true))).toBe("weak");
    // Mixed dishes and low-fat variants are only offered.
    expect(matchStrength("lasagna", f("Lasagna, cheese, frozen, prepared", "Meals, Entrees, and Side Dishes"))).toBe("weak");
    expect(matchStrength("greek yogurt", f("Greek yogurt, plain, nonfat", "Dairy and Egg Products", true))).toBe("weak");
    // Dry or unprepared forms only when the name says it was cooked.
    expect(matchStrength("oats", f("Oats, dry", "Cereal Grains and Pasta"))).toBe("weak");
    expect(matchStrength("chocolate chip cookie", f("Cookies, chocolate chip, refrigerated dough, baked", "Baked Products"))).toBe("strong");
    // The most generic, curated match wins.
    const best = bestMatch("bacon", [f("Bacon, meatless", "Pork Products"), f("Bacon, pan-fried", "Pork Products", true)]);
    expect(best).toMatchObject({ food: { name: "Bacon, pan-fried" }, strong: true });
  });

  it("picks sensible USDA foods for common photo items from the bundled database", async () => {
    const expected: [string, RegExp | null, boolean][] = [
      ["chicken breast", /^Chicken breast, cooked/, true],
      ["rice", /^White rice, cooked/, true],
      ["broccoli", /^Broccoli, cooked/, true],
      ["baked potato", /^Potato, baked/, true],
      ["bacon", /^Bacon, pan-fried/, true],
      ["greek yogurt", /^Greek yogurt, plain, whole milk/, true],
      ["caesar salad", null, false],
      ["pepperoni pizza", /^Pizza/, false],
    ];
    for (const [term, name, strong] of expected) {
      const best = bestMatch(term, await searchUsda(term, 12));
      if (!name) expect(best, term).toBeNull();
      else expect(best, term).toMatchObject({ food: { name: expect.stringMatching(name) }, strong });
    }
  });

  it("rescales an estimate when its grams change", () => {
    const base = perGram({ grams: 150, calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4 })!;
    expect(scaleToGrams(base, 75)).toEqual({ calories: 124, protein_g: 23, carbs_g: 0, fat_g: 2.7 });
    expect(scaleToGrams(base, 300)).toEqual({ calories: 496, protein_g: 92, carbs_g: 0, fat_g: 10.8 });
    expect(perGram({ grams: null, calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 })).toBeNull();
  });

  it("starts review from a strong database match at the estimated weight, keeping the estimate for undo", () => {
    const choice = { key: "usda:1", kind: "usda" as const, ref: "1", name: "Chicken breast, cooked (roasted)", detail: "USDA", basis: { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } } };
    const est = (over: Partial<MatchedEstimate>): MatchedEstimate => ({ name: "Grilled chicken", ingredients: [], portion: "a fillet", grams: 150, calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, confidence: "medium", searchTerm: "chicken breast", inconsistent: false, match: null, ...over });
    const [strong, noGrams, weak, none] = initialItems([est({ match: { choice, strong: true } }), est({ grams: null, match: { choice, strong: true } }), est({ match: { choice, strong: false } }), est({})]);
    expect(strong).toMatchObject({ kind: "database", quantity: 150, unitId: "g", estimatedAmount: true, replaced: { kind: "estimate", name: "Grilled chicken" } });
    expect(noGrams).toMatchObject({ kind: "estimate", suggestion: { name: "Chicken breast, cooked (roasted)" } });
    expect(weak).toMatchObject({ kind: "estimate", suggestion: { name: "Chicken breast, cooked (roasted)" } });
    expect(none).toMatchObject({ kind: "estimate", suggestion: null });
  });

  it("logs a photo for today or earlier only, and gives each saved row a stable id", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(isLoggableDate("2026-11-03", now)).toBe(true);
    expect(isLoggableDate("2026-11-04", now)).toBe(true); // a member east of UTC is already on the 4th
    expect(isLoggableDate("2026-11-05", now)).toBe(false);
    expect(isLoggableDate("2026-02-30", now)).toBe(false);
    expect(isLoggableDate("1999-12-31", now)).toBe(false);
    const id = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
    expect(derivedClientId(id, 0)).toBe(derivedClientId(id, 0));
    expect(derivedClientId(id, 0)).not.toBe(derivedClientId(id, 1));
    expect(derivedClientId(id, 2)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("isRepeatOf", () => {
  it("is a repeat only for a unique-index refusal on a save that carried an id", () => {
    expect(isRepeatOf({ code: "23505" }, "6f9619ff-8b86-4011-b42d-00c04fc964ff")).toBe(true);
    expect(isRepeatOf({ code: "23505" }, null)).toBe(false);
    expect(isRepeatOf({ code: "23503" }, "id")).toBe(false);
    expect(isRepeatOf(null, "id")).toBe(false);
  });
});
