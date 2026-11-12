/**
 * Amount and unit handling for the food log, MyFitnessPal style: every food carries nutrition per 100 g
 * (or 100 ml for drinks), and the person picks how much they ate in grams, ounces, pounds, the label
 * serving, or a household measure such as "1 cup, chopped" whose gram weight comes from USDA.
 */

export const GRAMS_PER_OZ = 28.349523125;
export const GRAMS_PER_LB = 453.59237;

export interface Per100 {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
}

export interface FoodUnit {
  /** Stable id: "g", "oz", "lb", "ml", "serving" or "p<index>" for a household portion. */
  id: string;
  label: string;
  /** Grams (or ml) in one of this unit. */
  grams: number;
}

export interface Portion {
  label: string;
  grams: number;
}

/**
 * Units offered for a food. Liquids measured per 100 ml get "ml" and fluid ounces instead of grams.
 * The label serving (for packaged foods) comes first when known, then household portions.
 */
export function unitOptions(opts: { portions?: Portion[]; servingGrams?: number | null; servingLabel?: string | null; liquid?: boolean }): FoodUnit[] {
  const units: FoodUnit[] = [];
  if (opts.servingGrams && opts.servingGrams > 0) {
    const lbl = opts.servingLabel?.trim();
    units.push({ id: "serving", label: lbl ? `serving (${lbl})` : `serving (${round1(opts.servingGrams)} ${opts.liquid ? "ml" : "g"})`, grams: opts.servingGrams });
  }
  (opts.portions ?? []).forEach((p, i) => {
    if (p.grams > 0) units.push({ id: `p${i}`, label: p.label, grams: p.grams });
  });
  if (opts.liquid) {
    units.push({ id: "ml", label: "ml", grams: 1 }, { id: "floz", label: "fl oz", grams: 29.5735 });
  } else {
    units.push({ id: "g", label: "g", grams: 1 }, { id: "oz", label: "oz", grams: GRAMS_PER_OZ }, { id: "lb", label: "lb", grams: GRAMS_PER_LB });
  }
  return units;
}

/** Grams for a quantity of a unit. */
export function toGrams(quantity: number, unit: FoodUnit): number {
  if (!(quantity > 0) || !(unit.grams > 0)) return 0;
  return quantity * unit.grams;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrition for an amount in grams, from per-100 g values. */
export function nutritionForGrams(per100: Per100, grams: number) {
  const k = grams > 0 ? grams / 100 : 0;
  const opt = (v: number | null | undefined) => (v == null ? null : round1(v * k));
  return {
    calories: Math.round(per100.calories * k),
    protein_g: round1(per100.protein_g * k),
    carbs_g: round1(per100.carbs_g * k),
    fat_g: round1(per100.fat_g * k),
    fiber_g: opt(per100.fiber_g),
    sugar_g: opt(per100.sugar_g),
    sodium_mg: per100.sodium_mg == null ? null : Math.round(per100.sodium_mg * k),
  };
}

/** Human text for a logged amount, e.g. "1.5 cup, chopped (210 g)" or "6 oz (170 g)". */
export function describeAmount(quantity: number, unit: FoodUnit, liquid = false): string {
  const q = Number.isInteger(quantity) ? String(quantity) : String(round1(quantity));
  const grams = Math.round(toGrams(quantity, unit));
  const u = liquid ? "ml" : "g";
  if (unit.id === "g" || unit.id === "ml") return `${q} ${unit.label}`;
  if (unit.id === "serving") {
    const inner = unit.label.match(/^serving \((.*)\)$/)?.[1] ?? "serving";
    const hasWeight = /\(\s*[\d.]+\s*(g|ml)\s*\)\s*$/i.test(inner) || /^[\d.]+\s*(g|ml)$/i.test(inner);
    if (quantity === 1) return hasWeight ? inner : `${inner} (${grams} ${u})`;
    return `${q} × ${inner}${hasWeight ? ` = ${grams} ${u}` : ` (${grams} ${u})`}`;
  }
  const label = unit.label.replace(/^1 /, "");
  return `${q} ${label} (${grams} ${u})`;
}

/** Parses a typed amount like "1.5", "1 1/2" or "3/4". Returns NaN when it isn't a number. */
export function parseQuantity(raw: string): number {
  const t = raw.trim().replace(",", ".");
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return /^\d*\.?\d+$/.test(t) ? Number(t) : NaN;
}
