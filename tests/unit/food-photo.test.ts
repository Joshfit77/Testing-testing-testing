import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HIDDEN_EXTRAS, macroCalories, normalizeFoodPhoto, sniffImageType, type FoodPhotoOutput } from "@/lib/domain/food-photo";

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

describe("food photo estimates", () => {
  it("keeps sensible items, clamps numbers and flags calories that don't match the macros", () => {
    const out = normalizeFoodPhoto({
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
    const out = normalizeFoodPhoto({ is_food: true, summary: "", items: [item({ grams: null, confidence: "low" })], questions: [{ topic: "sauce", question: "Was there any sauce?" }] });
    expect(out.questions.map((q) => q.topic)).toEqual(["sauce", "cooking_oil", "portion"]);
    const confident = normalizeFoodPhoto({ is_food: true, summary: "", items: [item({ confidence: "high" })], questions: [{ topic: "butter", question: "Butter?" }, { topic: "butter", question: "Again?" }] });
    expect(confident.questions.map((q) => q.topic)).toEqual(["butter", "sauce"]);
  });

  it("returns nothing to log when the photo isn't food", () => {
    const out = normalizeFoodPhoto({ is_food: false, summary: "A cat.", items: [item()], questions: [] });
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
});
