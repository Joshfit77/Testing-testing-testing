import "server-only";
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

function normalize(f: {
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
  return {
    fdcId: String(f.fdcId),
    name: f.description,
    brand: f.brandName ?? f.brandOwner ?? null,
    dataType: f.dataType ?? "",
    servingSize: 100,
    servingUnit: "g",
    calories: kcal,
    protein_g: nutrient(f.foodNutrients, "203") ?? 0,
    carbs_g: nutrient(f.foodNutrients, "205") ?? 0,
    fat_g: nutrient(f.foodNutrients, "204") ?? 0,
    fiber_g: nutrient(f.foodNutrients, "291"),
    householdServing: household,
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
  const json = (await res.json()) as { foods?: Parameters<typeof normalize>[0][] };
  return (json.foods ?? []).map(normalize).filter((f): f is ExternalFood => f !== null);
}

export async function getFood(fdcId: string): Promise<ExternalFood | null> {
  if (!serverEnv.usdaApiKey) throw new Error("Food search is not configured");
  if (!/^\d{1,10}$/.test(fdcId)) return null;
  const res = await fetch(`${BASE}/food/${fdcId}?api_key=${encodeURIComponent(serverEnv.usdaApiKey)}&format=abridged`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return normalize((await res.json()) as Parameters<typeof normalize>[0]);
}
