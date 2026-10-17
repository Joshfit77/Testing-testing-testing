/**
 * Normalization of Open Food Facts (OFF) API v2 product responses. Pure, so it can be unit-tested
 * and shared by the lookup route and the logging action. OFF is a crowd-sourced database: values are
 * transcribed from labels by volunteers and are not verified by us.
 *
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/ (GET /api/v2/product/{barcode})
 */

export const OFF_ATTRIBUTION = "Open Food Facts (community data) — check the label";
export const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "quantity",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "nutriments",
] as const;

export interface NutritionValues {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
}

export interface BarcodeProduct {
  code: string;
  name: string;
  brand: string | null;
  /** Package quantity text, e.g. "400 g". */
  quantity: string | null;
  /** Serving as printed, e.g. "15 g" or "1 bar (40 g)". */
  servingLabel: string | null;
  /** Serving weight/volume in `unit`, when known. */
  servingQuantity: number | null;
  /** "g" or "ml" — what the per-100 values are measured in. */
  unit: "g" | "ml";
  per100: NutritionValues | null;
  perServing: NutritionValues | null;
  /** Nutrients that were absent and are shown as 0. */
  missing: ("protein" | "carbs" | "fat")[];
}

export type BarcodeLookup =
  | { status: "found"; product: BarcodeProduct }
  | { status: "no_nutrition"; product: Pick<BarcodeProduct, "code" | "name" | "brand"> }
  | { status: "not_found"; code: string };

/** Shape of the parts of the OFF v2 response we read. Everything is optional — the data is crowd-sourced. */
export interface OffProductResponse {
  code?: string;
  status?: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    generic_name?: string;
    brands?: string;
    quantity?: string;
    serving_size?: string;
    serving_quantity?: number | string;
    serving_quantity_unit?: string;
    nutriments?: Record<string, number | string | undefined>;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function num(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

function text(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, maxLen) : null;
}

/** Reads one basis ("100g" or "serving") of nutriments. Returns null without an energy value. */
function readBasis(n: Record<string, unknown>, basis: "100g" | "serving", perHundred: boolean): { values: NutritionValues; missing: BarcodeProduct["missing"] } | null {
  const cap = perHundred ? 1 : 50; // per-serving values may legitimately exceed per-100 caps
  const kcal = num(n[`energy-kcal_${basis}`], 1000 * cap);
  // OFF always normalizes the generic `energy_*` fields to kJ.
  const kj = num(n[`energy-kj_${basis}`], 4200 * cap) ?? num(n[`energy_${basis}`], 4200 * cap);
  const calories = kcal ?? (kj != null ? kj / 4.184 : null);
  if (calories == null) return null;
  const protein = num(n[`proteins_${basis}`], 100 * cap);
  const carbs = num(n[`carbohydrates_${basis}`], 100 * cap);
  const fat = num(n[`fat_${basis}`], 100 * cap);
  const fiber = num(n[`fiber_${basis}`], 100 * cap);
  const missing: BarcodeProduct["missing"] = [];
  if (protein == null) missing.push("protein");
  if (carbs == null) missing.push("carbs");
  if (fat == null) missing.push("fat");
  return {
    values: { calories: round1(calories), protein_g: round1(protein ?? 0), carbs_g: round1(carbs ?? 0), fat_g: round1(fat ?? 0), fiber_g: fiber == null ? null : round1(fiber) },
    missing,
  };
}

/** Scales nutrition values by a factor, rounding to one decimal. */
export function scaleNutrition(v: NutritionValues, factor: number): NutritionValues {
  return {
    calories: round1(v.calories * factor),
    protein_g: round1(v.protein_g * factor),
    carbs_g: round1(v.carbs_g * factor),
    fat_g: round1(v.fat_g * factor),
    fiber_g: v.fiber_g == null ? null : round1(v.fiber_g * factor),
  };
}

/**
 * Turns an OFF v2 product response into our product shape.
 * `requestedCode` is used when the response omits the code.
 */
export function normalizeOffProduct(json: OffProductResponse | null | undefined, requestedCode: string): BarcodeLookup {
  const p = json?.product;
  if (!json || json.status !== 1 || !p) return { status: "not_found", code: requestedCode };
  const code = text(p.code ?? json.code, 20) ?? requestedCode;
  const brand = text(p.brands?.split(",")[0], 120);
  const name = text(p.product_name, 160) ?? text(p.product_name_en, 160) ?? text(p.generic_name, 160) ?? (brand ? `${brand} product` : `Product ${code}`);
  const nutriments = (p.nutriments ?? {}) as Record<string, unknown>;

  const unit: "g" | "ml" = p.serving_quantity_unit?.toLowerCase() === "ml" ? "ml" : "g";
  const servingQuantity = num(p.serving_quantity, 5000);
  const serving = servingQuantity && servingQuantity > 0 ? round1(servingQuantity) : null;

  const hundred = readBasis(nutriments, "100g", true);
  const perServingRaw = readBasis(nutriments, "serving", false);

  let per100 = hundred?.values ?? null;
  let perServing: NutritionValues | null = null;
  if (per100 && serving) perServing = scaleNutrition(per100, serving / 100);
  else if (perServingRaw) {
    perServing = perServingRaw.values;
    if (!per100 && serving) per100 = scaleNutrition(perServingRaw.values, 100 / serving);
  }
  if (!per100 && !perServing) return { status: "no_nutrition", product: { code, name, brand } };

  return {
    status: "found",
    product: {
      code,
      name,
      brand,
      quantity: text(p.quantity, 60),
      servingLabel: text(p.serving_size, 60),
      servingQuantity: serving,
      unit,
      per100,
      perServing,
      missing: (hundred ?? perServingRaw)?.missing ?? [],
    },
  };
}

/** Nutrition for an amount: either a number of label servings or grams (ml). Null if the product lacks that basis. */
export function nutritionForAmount(product: BarcodeProduct, amount: { servings: number } | { grams: number }): NutritionValues | null {
  if ("grams" in amount) return product.per100 ? scaleNutrition(product.per100, amount.grams / 100) : null;
  return product.perServing ? scaleNutrition(product.perServing, amount.servings) : null;
}
