import { describeAmount, nutritionForGrams, toGrams, unitOptions, type FoodUnit, type Per100, type Portion } from "./food-units";

/**
 * What a food's nutrition is measured against, so an amount in any unit can be turned into calories and
 * macros — on the client for the live preview and again on the server when the entry is saved. It is
 * stored with each logged item (meal_items.basis) so the entry can be edited later.
 *
 * Normally `per100` is per 100 g (or 100 ml for drinks). When a food has no known weight (a saved food
 * measured in "sandwiches", or an entry logged before amounts were stored) `servingOnly` is set and
 * `per100` holds the values for ONE serving; the only unit is then "serving".
 */
export interface FoodBasis {
  per100: Per100;
  servingOnly?: boolean;
  /** Label serving weight in g (ml for liquids), for packaged foods. */
  servingGrams?: number | null;
  /** Serving as printed on the label, e.g. "1 bar (60 g)". */
  servingLabel?: string | null;
  liquid?: boolean;
  portions?: Portion[];
}

export interface AmountResult {
  unit: FoodUnit;
  quantity: number;
  /** Grams (ml) eaten, or null when the weight isn't known (serving-only foods). */
  grams: number | null;
  amountLabel: string;
  nutrition: ReturnType<typeof nutritionForGrams>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

/** Units offered for a food, in dropdown order. */
export function basisUnits(b: FoodBasis): FoodUnit[] {
  if (b.servingOnly) {
    const lbl = b.servingLabel?.trim();
    return [{ id: "serving", label: lbl ? `serving (${lbl})` : "serving", grams: 100 }];
  }
  return unitOptions({ portions: b.portions, servingGrams: b.servingGrams, servingLabel: b.servingLabel, liquid: b.liquid });
}

/** Unit picked when a food is first opened: the label serving, else the first household measure, else grams. */
export function defaultUnit(b: FoodBasis): { unitId: string; quantity: number } {
  const units = basisUnits(b);
  const first = units[0]!;
  if (first.id === "serving" || first.id.startsWith("p")) return { unitId: first.id, quantity: 1 };
  return { unitId: first.id, quantity: 100 };
}

/** Nutrition and readable amount for `quantity` of unit `unitId`, or null for an unknown unit / bad quantity. */
export function computeAmount(b: FoodBasis, quantity: number, unitId: string): AmountResult | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = basisUnits(b).find((u) => u.id === unitId);
  if (!unit) return null;
  if (b.servingOnly) {
    const lbl = b.servingLabel?.trim();
    const amountLabel = `${fmtQty(quantity)} serving${quantity === 1 ? "" : "s"}${lbl ? ` (${lbl})` : ""}`;
    return { unit, quantity, grams: null, amountLabel, nutrition: nutritionForGrams(b.per100, quantity * 100) };
  }
  const grams = toGrams(quantity, unit);
  return { unit, quantity, grams: round1(grams), amountLabel: describeAmount(quantity, unit, b.liquid), nutrition: nutritionForGrams(b.per100, grams) };
}

/** Finds the unit a saved entry used (by its label), falling back to the default unit. */
export function unitIdForLabel(b: FoodBasis, label: string | null | undefined): string | null {
  if (!label) return null;
  return basisUnits(b).find((u) => u.label === label)?.id ?? null;
}

/** Weight in a serving-unit text such as "oz (113 g)", "cup (248 ml)" or "g". */
export function parseServingWeight(size: number, unitText: string): { grams: number; liquid: boolean } | null {
  const u = unitText.trim().toLowerCase();
  if (u === "g" || u === "gram" || u === "grams") return { grams: size, liquid: false };
  if (u === "ml") return { grams: size, liquid: true };
  const m = u.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)\s*$/);
  if (m) return { grams: Number(m[1]), liquid: m[2] === "ml" };
  return null;
}

/**
 * Basis for a row of the `foods` table (a saved / built-in / cached food), whose values are for one
 * serving of `serving_size` `serving_unit`.
 */
export function basisFromFoodRow(f: {
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
}): FoodBasis {
  const size = Number(f.serving_size);
  const values: Per100 = {
    calories: Number(f.calories),
    protein_g: Number(f.protein_g),
    carbs_g: Number(f.carbs_g),
    fat_g: Number(f.fat_g),
    fiber_g: f.fiber_g == null ? null : Number(f.fiber_g),
  };
  const label = /^(g|ml|servings?)$/i.test(f.serving_unit.trim()) ? null : `${fmtQty(size)} ${f.serving_unit}`;
  const w = parseServingWeight(size, f.serving_unit);
  if (!w || !(w.grams > 0)) return { per100: values, servingOnly: true, servingLabel: label };
  const k = 100 / w.grams;
  const scale = (v: number | null | undefined) => (v == null ? null : Math.round(v * k * 100) / 100);
  return {
    per100: {
      calories: Math.round(values.calories * k * 100) / 100,
      protein_g: scale(values.protein_g)!,
      carbs_g: scale(values.carbs_g)!,
      fat_g: scale(values.fat_g)!,
      fiber_g: scale(values.fiber_g),
    },
    // Foods stored per 100 g (cached USDA / Open Food Facts rows) don't need a "serving" unit.
    servingGrams: label ? w.grams : null,
    servingLabel: label,
    liquid: w.liquid,
  };
}

/** Basis for an entry logged before amounts were stored: its own values, scalable by servings. */
export function basisFromLegacyItem(i: { servings: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }): FoodBasis {
  const s = Number(i.servings) > 0 ? Number(i.servings) : 1;
  return {
    per100: { calories: Number(i.calories) / s, protein_g: Number(i.protein_g) / s, carbs_g: Number(i.carbs_g) / s, fat_g: Number(i.fat_g) / s },
    servingOnly: true,
    servingLabel: null,
  };
}

/** Keeps only the fields of a basis we store, with sane bounds; null if it isn't a usable basis. */
export function sanitizeBasis(raw: unknown): FoodBasis | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const p = b.per100 as Record<string, unknown> | undefined;
  const n = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  if (!p) return null;
  const calories = n(p.calories, 100_000);
  if (calories == null) return null;
  const portions = Array.isArray(b.portions)
    ? (b.portions as unknown[])
        .flatMap((x) => {
          const o = x as { label?: unknown; grams?: unknown };
          const g = n(o?.grams, 10_000);
          return typeof o?.label === "string" && g && g > 0 ? [{ label: o.label.slice(0, 80), grams: g }] : [];
        })
        .slice(0, 20)
    : undefined;
  const servingGrams = n(b.servingGrams, 10_000);
  return {
    per100: {
      calories,
      protein_g: n(p.protein_g, 10_000) ?? 0,
      carbs_g: n(p.carbs_g, 10_000) ?? 0,
      fat_g: n(p.fat_g, 10_000) ?? 0,
      fiber_g: n(p.fiber_g, 10_000),
      sugar_g: n(p.sugar_g, 10_000),
      sodium_mg: n(p.sodium_mg, 1_000_000),
    },
    ...(b.servingOnly === true ? { servingOnly: true } : {}),
    ...(servingGrams && servingGrams > 0 ? { servingGrams } : {}),
    ...(typeof b.servingLabel === "string" && b.servingLabel.trim() ? { servingLabel: b.servingLabel.trim().slice(0, 80) } : {}),
    ...(b.liquid === true ? { liquid: true } : {}),
    ...(portions?.length ? { portions } : {}),
  };
}

/** A food the person can pick in the add-food dialog, with everything the amount step needs. */
export interface FoodChoice {
  /** Unique key, e.g. "usda:171477", "off:3017620422003", "food:<uuid>". */
  key: string;
  kind: "usda" | "off" | "food";
  /** fdcId, barcode or foods.id. */
  ref: string;
  name: string;
  /** Second line: source / brand / category. */
  detail?: string;
  basis: FoodBasis;
  /** Typical values rather than a label or database entry. */
  isEstimate?: boolean;
  /** Extra honesty note shown in the amount step (e.g. Open Food Facts attribution). */
  note?: string;
  /** Barcode format, for Open Food Facts lookups. */
  format?: "ean13" | "upca" | "upce" | "ean8";
}
