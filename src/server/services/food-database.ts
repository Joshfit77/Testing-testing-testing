import "server-only";
import type { FoodBasis, MacroKey } from "@/lib/domain/food-basis";
import { serverEnv } from "@/server/env";

/**
 * USDA FoodData Central client. Values come straight from the database — nothing is
 * estimated or invented. Search results report nutrients per 100 g.
 */
const BASE = "https://api.nal.usda.gov/fdc/v1";

export interface ExternalFood {
  fdcId: string;
  name: string;
  brand: string | null;
  dataType: string;
  servingSize: number; // grams for per-100g values
  servingUnit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  householdServing: string | null;
  /**
   * Macros FoodData Central doesn't list for this food. Their value above is 0 only as a placeholder: it is not a
   * known zero, and the basis carries them as `missing` so totals read "at least" (as Open Food Facts products do).
   */
  missing: MacroKey[];
}

/** The per-100 g nutrition basis of a FoodData Central food, with the macros it doesn't list marked as missing. */
export function externalFoodBasis(f: ExternalFood): FoodBasis {
  return {
    per100: { calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, fiber_g: f.fiber_g },
    ...(f.missing.length ? { missing: f.missing } : {}),
  };
}

interface FdcNutrient {
  nutrientNumber?: string;
  number?: string;
  value?: number;
  amount?: number;
  nutrient?: { number?: string };
}

function nutrient(list: FdcNutrient[] | undefined, number: string): number | null {
  const n = list?.find((x) => (x.nutrientNumber ?? x.number ?? x.nutrient?.number) === number);
  const v = n?.value ?? n?.amount;
  return typeof v === "number" ? Math.round(v * 10) / 10 : null;
}

export function normalizeFdcFood(f: {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}): ExternalFood | null {
  // Energy: 208 = kcal. Some Foundation foods only report 957/958 (Atwater) — use those if 208 is absent.
  const kcal = nutrient(f.foodNutrients, "208") ?? nutrient(f.foodNutrients, "958") ?? nutrient(f.foodNutrients, "957");
  if (kcal == null) return null;
  const household =
    f.servingSize && f.servingSizeUnit ? `${f.householdServingFullText ? `${f.householdServingFullText} = ` : ""}${f.servingSize} ${f.servingSizeUnit}` : null;
  const protein = nutrient(f.foodNutrients, "203");
  const carbs = nutrient(f.foodNutrients, "205");
  const fat = nutrient(f.foodNutrients, "204");
  const missing: MacroKey[] = [];
  if (protein == null) missing.push("protein_g");
  if (carbs == null) missing.push("carbs_g");
  if (fat == null) missing.push("fat_g");
  return {
    fdcId: String(f.fdcId),
    name: f.description,
    brand: f.brandName ?? f.brandOwner ?? null,
    dataType: f.dataType ?? "",
    servingSize: 100,
    servingUnit: "g",
    calories: kcal,
    protein_g: protein ?? 0,
    carbs_g: carbs ?? 0,
    fat_g: fat ?? 0,
    fiber_g: nutrient(f.foodNutrients, "291"),
    householdServing: household,
    missing,
  };
}

export async function searchFoods(query: string): Promise<ExternalFood[]> {
  if (!serverEnv.usdaApiKey) throw new Error("Food search is not configured");
  const url = new URL(`${BASE}/foods/search`);
  url.searchParams.set("api_key", serverEnv.usdaApiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded,Survey (FNDDS)");
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FoodData Central error ${res.status}`);
  const json = (await res.json()) as { foods?: Parameters<typeof normalizeFdcFood>[0][] };
  return (json.foods ?? []).map(normalizeFdcFood).filter((f): f is ExternalFood => f !== null);
}

export async function getFood(fdcId: string): Promise<ExternalFood | null> {
  if (!serverEnv.usdaApiKey) throw new Error("Food search is not configured");
  if (!/^\d{1,10}$/.test(fdcId)) return null;
  const res = await fetch(`${BASE}/food/${fdcId}?api_key=${encodeURIComponent(serverEnv.usdaApiKey)}&format=abridged`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return normalizeFdcFood((await res.json()) as Parameters<typeof normalizeFdcFood>[0]);
}
