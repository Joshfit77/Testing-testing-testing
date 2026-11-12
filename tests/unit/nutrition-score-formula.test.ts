import { describe, expect, it } from "vitest";
import { scoreFoodIq } from "@/lib/food-iq";
import { normalizeQualityProduct } from "@/lib/food-quality";

/**
 * The Nutrition Score formula as written in docs/FOOD_IQ_METHOD.md ("The formula", "Combining", "Details that decide
 * edge cases"), implemented here from the text alone, without using the app's scoring code. If the app and the
 * documentation ever disagree, this test fails: the documented formula is the one members are told about.
 */
const lin = (x: number, a: number, b: number) => (x <= a ? 0 : x >= b ? 10 : ((x - a) / (b - a)) * 10);
const r1 = (x: number) => Math.round(x * 10) / 10;

interface Input {
  kind: "general" | "beverage" | "fats" | "water";
  kcal: number;
  sugars: number;
  sat: number;
  salt: number;
  protein: number;
  fat: number;
  fibre: number | null;
  fvl: number | null;
  sweetener: boolean;
}

function documentedScore(i: Input): number {
  if (i.kind === "water" && i.kcal <= 1 && i.sugars <= 0.5 && !i.sweetener) return 100;
  const k = i.kind === "water" ? "beverage" : i.kind;
  const neg: number[] = [];
  if (k === "beverage") {
    neg.push(3 * lin(i.sugars, 0.5, 11.25), 0.5 * lin(i.kcal, 4, 60), lin(i.sat, 0.75, 2.5), lin(i.salt, 0.3, 0.75));
    if (i.sweetener) neg.push(10);
  } else {
    neg.push(lin(i.sugars, 5, 22.5));
    neg.push(k === "fats" ? lin(i.fat > 0 ? (i.sat / i.fat) * 100 : 0, 15, 60) : lin(i.sat, 1.5, 5));
    neg.push(lin(i.salt, 0.3, 1.5));
    if (k === "general") neg.push(0.5 * lin(i.kcal, 150, 400));
  }
  const N = neg.map(r1).reduce((a, b) => a + b, 0);
  const pos: number[] = [];
  if (i.kcal >= 4) pos.push(lin(((i.protein * 4) / i.kcal) * 100, 8, 20));
  if (i.fibre != null) pos.push(k === "beverage" ? lin(i.fibre, 0, 3) : lin(i.fibre, 0, 6));
  if (i.fvl != null && k !== "fats") pos.push(lin(i.fvl, 40, 80));
  const unsat = i.fat > 0 ? ((i.fat - i.sat) / i.fat) * 100 : null;
  if (k === "fats" && unsat != null) pos.push(lin(unsat, 50, 85));
  if (k === "general" && i.fat >= 10 && unsat != null) pos.push(0.5 * lin(unsat, 50, 85));
  const rawP = pos.map(r1).reduce((a, b) => a + b, 0);
  const P = Math.min(20, rawP) * (1 - 0.5 * Math.min(1, Math.max(0, (N - 5) / 10)));
  const base = k === "beverage" ? 80 + 2.5 * P - 2 * N : 50 + 2.5 * P - 1.5 * N;
  return Math.max(0, Math.min(100, Math.round(base)));
}

const CATEGORIES: Record<Input["kind"], string[]> = {
  general: ["en:foods", "en:breakfast-cereals"],
  beverage: ["en:beverages", "en:sodas"],
  fats: ["en:fats", "en:vegetable-oils"],
  water: ["en:beverages", "en:waters"],
};

describe("Nutrition Score: the app computes exactly the documented formula", () => {
  it("matches an independent implementation of FOOD_IQ_METHOD.md for 3,000 random valid products of every kind", () => {
    let seed = 20261103;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
    let checked = 0;
    for (let n = 0; n < 3000; n++) {
      const kind = pick<Input["kind"]>(["general", "beverage", "fats", "water"]);
      const scale = kind === "beverage" || kind === "water" ? 0.3 : 1;
      const fat = r1(rand() * (kind === "fats" ? 100 : 40) * scale);
      const carbs = r1(rand() * 80 * scale);
      const input: Input = {
        kind,
        kcal: kind === "water" && rand() < 0.5 ? Math.round(rand() * 1.4) : Math.round(rand() * (kind === "fats" ? 900 : 600) * scale),
        sugars: kind === "water" && rand() < 0.5 ? 0 : r1(rand() * carbs),
        sat: r1(rand() * fat),
        salt: r1(rand() * 3 * scale),
        protein: r1(rand() * 40 * scale),
        fat,
        fibre: rand() < 0.2 ? null : r1(rand() * 15 * scale),
        fvl: rand() < 0.5 ? null : Math.round(rand() * 100),
        sweetener: kind !== "fats" && rand() < 0.15,
      };
      const p = normalizeQualityProduct(
        {
          status: 1,
          product: {
            code: "5000000000012",
            product_name: "Random product",
            quantity: kind === "beverage" || kind === "water" ? "1 l" : "500 g",
            categories_tags: CATEGORIES[kind],
            additives_tags: input.sweetener ? ["en:e955"] : [],
            nutriments: {
              "energy-kcal_100g": input.kcal,
              sugars_100g: input.sugars,
              carbohydrates_100g: carbs,
              "saturated-fat_100g": input.sat,
              fat_100g: input.fat,
              salt_100g: input.salt,
              proteins_100g: input.protein,
              ...(input.fibre == null ? {} : { fiber_100g: input.fibre }),
              ...(input.fvl == null ? {} : { "fruits-vegetables-legumes_100g": input.fvl }),
            },
          },
        },
        "5000000000012",
      )!;
      const app = scoreFoodIq(p);
      expect(app.status, JSON.stringify(input)).toBe("scored");
      if (app.status !== "scored") continue;
      expect(app.score, JSON.stringify(input)).toBe(documentedScore(input));
      checked++;
    }
    expect(checked).toBe(3000);
  });
});
