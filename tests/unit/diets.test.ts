import { COMMON_FOODS } from "@/data/foods";
import { DIET_TYPES, DIETS, fitsDiet, macroSplitForDiet } from "@/lib/domain/diets";
import { caloriesFromMacros, estimateNutritionTargets, mifflinStJeor } from "@/lib/domain/nutrition";

const food = (slug: string) => {
  const f = COMMON_FOODS.find((x) => x.slug === slug);
  if (!f) throw new Error(`missing ${slug}`);
  return f;
};

describe("diet styles", () => {
  it("defines complete content for every diet", () => {
    for (const id of DIET_TYPES) {
      const d = DIETS[id];
      expect(d.id).toBe(id);
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.eat.length).toBeGreaterThanOrEqual(3);
      expect(d.limit.length).toBeGreaterThanOrEqual(1);
      expect(d.sampleDay.length).toBeGreaterThanOrEqual(3);
    }
    expect(DIETS.intermittent_fasting.eatingWindow).toBeTruthy();
    for (const id of ["keto", "carnivore", "intermittent_fasting", "vegan", "daniel_fast"] as const) expect(DIETS[id].caution).toBeTruthy();
  });

  it("splits calories into macros that add back up", () => {
    for (const id of DIET_TYPES) {
      const m = macroSplitForDiet(2400, 80, id, 1.8);
      expect(m.protein_g).toBeGreaterThan(0);
      expect(m.fat_g).toBeGreaterThanOrEqual(48); // 0.6 g/kg floor
      expect(Math.abs(caloriesFromMacros(m) - 2400)).toBeLessThanOrEqual(25);
    }
    expect(macroSplitForDiet(2400, 80, "keto", 1.8).carbs_g).toBeLessThanOrEqual(25);
    expect(macroSplitForDiet(2400, 80, "carnivore", 1.8).carbs_g).toBeLessThanOrEqual(10);
    expect(macroSplitForDiet(2400, 80, "low_carb", 1.8).carbs_g).toBeLessThanOrEqual(100);
    expect(macroSplitForDiet(2400, 80, "high_protein", 1.8).protein_g).toBe(176);
  });

  it("marks which built-in foods fit", () => {
    expect(fitsDiet(food("chicken-breast-cooked"), "vegan")).toBe(false);
    expect(fitsDiet(food("egg-large"), "vegan")).toBe(false);
    expect(fitsDiet(food("honey"), "vegan")).toBe(false);
    expect(fitsDiet(food("tofu-firm"), "vegan")).toBe(true);
    expect(fitsDiet(food("black-beans"), "vegan")).toBe(true);
    expect(fitsDiet(food("egg-large"), "vegetarian")).toBe(true);
    expect(fitsDiet(food("salmon-cooked"), "vegetarian")).toBe(false);
    expect(fitsDiet(food("salmon-cooked"), "pescatarian")).toBe(true);
    expect(fitsDiet(food("banana"), "keto")).toBe(false);
    expect(fitsDiet(food("white-rice-cooked"), "keto")).toBe(false);
    expect(fitsDiet(food("salmon-cooked"), "keto")).toBe(true);
    expect(fitsDiet(food("butter"), "keto")).toBe(true);
    expect(fitsDiet(food("sirloin-steak-cooked"), "carnivore")).toBe(true);
    expect(fitsDiet(food("broccoli"), "carnivore")).toBe(false);
    expect(fitsDiet(food("lentils-cooked"), "daniel_fast")).toBe(true);
    expect(fitsDiet(food("brown-rice-cooked"), "daniel_fast")).toBe(true);
    expect(fitsDiet(food("coffee-black"), "daniel_fast")).toBe(false);
    expect(fitsDiet(food("bread-white"), "daniel_fast")).toBe(false);
    expect(fitsDiet(food("greek-yogurt-nonfat"), "paleo")).toBe(false);
    expect(fitsDiet(food("sweet-potato"), "paleo")).toBe(true);
    expect(fitsDiet(food("potato-chips"), "dash")).toBe(false);
    for (const id of DIET_TYPES) expect(COMMON_FOODS.filter((f) => fitsDiet(f, id)).length).toBeGreaterThanOrEqual(8);
  });
});

describe("calorie estimate with sex, age and height", () => {
  it("uses Mifflin-St Jeor", () => {
    expect(mifflinStJeor(80, 180, 30, "male")).toBe(1780);
    expect(mifflinStJeor(80, 180, 30, "female")).toBe(1614);
    expect(mifflinStJeor(80, 180, 30, "unspecified")).toBe(1697);
  });
  it("estimates more for men than women of the same size, and follows the diet", () => {
    const base = { weightKg: 80, trainingDaysPerWeek: 4, goal: "build_strength" as const, age: 30, heightCm: 180 };
    const m = estimateNutritionTargets({ ...base, sex: "male" });
    const f = estimateNutritionTargets({ ...base, sex: "female" });
    expect(m.calories).toBe(2850); // 1780 × 1.6, rounded to 10
    expect(f.calories).toBeLessThan(m.calories);
    const keto = estimateNutritionTargets({ ...base, sex: "male", diet: "keto" });
    expect(keto.calories).toBe(m.calories);
    expect(keto.carbs_g).toBeLessThanOrEqual(25);
  });
});
