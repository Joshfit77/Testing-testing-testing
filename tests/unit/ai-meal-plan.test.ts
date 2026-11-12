import { describe, expect, it } from "vitest";
import { buildDraftFromAi, dishCatalogForAi, focusTargets } from "@/lib/domain/ai-meal-plan";
import type { PlanCandidate, PlannerSettings } from "@/lib/domain/meal-planner";

const dish = (key: string, slots: PlanCandidate["slots"], kcal: number, protein: number, over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  key,
  name: key.replace(/^app:/, "").replace(/-/g, " "),
  origin: "app",
  slots,
  perServing: { calories: kcal, protein_g: protein, carbs_g: Math.round((kcal * 0.45) / 4), fat_g: Math.round((kcal * 0.3) / 9) },
  complete: true,
  ingredientNames: [key],
  tags: [],
  animalOnly: false,
  cost: "low",
  ...over,
});

const DISHES = [
  dish("app:oats", ["breakfast"], 350, 15),
  dish("app:eggs-toast", ["breakfast"], 420, 24),
  dish("app:chicken-rice", ["lunch", "dinner"], 600, 45),
  dish("app:bean-chili", ["lunch", "dinner"], 550, 28),
  dish("app:salmon-potato", ["lunch", "dinner"], 650, 40),
  dish("app:peanut-noodles", ["lunch", "dinner"], 640, 22, { ingredientNames: ["peanut butter", "noodles"], tags: [] }),
];
const settings: PlannerSettings = { calories: 2000, protein_g: 140, carbs_g: 220, fat_g: 62, diet: "balanced", allergies: ["peanut"], dislikes: [], mealsPerDay: 3, budget: "any" };

describe("focus targets", () => {
  const base = { calories: 2300, protein_g: 150, carbs_g: 260, fat_g: 70 };
  it("keeps the member's own targets for 'balanced'", () => {
    expect(focusTargets(base, "balanced", { maintenance: 2600, weightKg: 80, sex: "male" })).toMatchObject(base);
  });

  it("weight loss: ~20% under maintenance, never below the floor, protein 1.8 g/kg", () => {
    const t = focusTargets(base, "weight_loss", { maintenance: 2600, weightKg: 80, sex: "male" });
    expect(t.calories).toBe(2080);
    expect(t.protein_g).toBe(150);
    const light = focusTargets({ calories: 1600, protein_g: 90, carbs_g: 180, fat_g: 50 }, "weight_loss", { maintenance: 1700, weightKg: 55, sex: "female" });
    expect(light.calories).toBe(1360);
    expect(focusTargets({ calories: 1300, protein_g: 90, carbs_g: 130, fat_g: 40 }, "weight_loss", { maintenance: 1400, weightKg: 50, sex: "female" }).calories).toBe(1200);
    expect(t.explanation.join(" ")).toMatch(/never under the 1500 kcal floor/);
  });

  it("muscle gain and high protein raise protein within 2.4 g/kg and keep fat at 25%+ of calories", () => {
    const gain = focusTargets(base, "muscle_gain", { maintenance: 2600, weightKg: 80, sex: "male" });
    expect(gain.calories).toBe(2860);
    const hp = focusTargets(base, "high_protein", { maintenance: null, weightKg: 80, sex: "male" });
    expect(hp.protein_g).toBe(160);
    expect(hp.fat_g * 9).toBeGreaterThanOrEqual(hp.calories * 0.25 - 9);
    const capped = focusTargets({ ...base, protein_g: 250 }, "high_protein", { maintenance: null, weightKg: 80, sex: "male" });
    expect(capped.protein_g).toBe(192);
    // Macros add up to the calories (within rounding).
    for (const t of [gain, hp, capped]) expect(Math.abs(t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9 - t.calories)).toBeLessThanOrEqual(15);
  });
});

describe("AI draft validation", () => {
  const dates = ["2026-10-23", "2026-10-24"];

  it("keeps valid choices, computes nutrition from the database values, and fixes everything else", () => {
    const { days, corrections } = buildDraftFromAi(
      {
        summary: "Plan.",
        assumptions: [],
        days: [
          {
            day_index: 0,
            meals: [
              { slot_index: 0, dish_key: "app:oats", portion: 1.3 }, // rounded to 1.25
              { slot_index: 1, dish_key: "app:made-up-dish", portion: 1 }, // unknown: refilled
              { slot_index: 2, dish_key: "app:oats", portion: 1 }, // breakfast-only dish at dinner: refilled
            ],
          },
          { day_index: 1, meals: [{ slot_index: 1, dish_key: "app:peanut-noodles", portion: 1 }] }, // excluded by the peanut allergy
        ],
      },
      DISHES,
      settings,
      dates,
    );
    expect(corrections).toBe(6);
    const [d0, d1] = days as [(typeof days)[number], (typeof days)[number]];
    expect(d0.meals[0]).toMatchObject({ key: "app:oats", by: "ai" });
    expect(d0.meals[1]?.by).toBe("planner");
    expect(d0.meals[2]?.by).toBe("planner");
    expect(new Set(d0.meals.map((m) => m?.key)).size).toBe(3);
    expect(d1.meals.every((m) => m && m.key !== "app:peanut-noodles")).toBe(true);
    // Nutrition is the dish's own value × portion, never the AI's.
    const oats = d0.meals[0]!;
    expect(oats.nutrition.calories).toBe(Math.round(350 * oats.portion));
    for (const m of [...d0.meals, ...d1.meals]) expect(m!.portion * 4).toBe(Math.round(m!.portion * 4));
  });

  it("lists only allowed dishes for the AI, with the app's numbers", () => {
    const text = dishCatalogForAi(DISHES.slice(0, 2));
    expect(text).toBe("app:oats | oats | breakfast | 350 kcal P15 C39 F12\napp:eggs toast | eggs toast | breakfast | 420 kcal P24 C47 F14".replace("app:eggs toast", "app:eggs-toast"));
  });
});
