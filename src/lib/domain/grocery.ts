import { GRAMS_PER_LB, GRAMS_PER_OZ } from "./food-units";
import type { UnitSystem } from "./types";

/**
 * Grocery list from planned meals. The same ingredient used in several meals becomes one line when its
 * amounts can be converted to a common unit:
 *
 * - weights (g, oz, lb, "4 oz") add up as grams;
 * - volumes (ml, fl oz, cup, tbsp, tsp, quart, pint) add up as millilitres;
 * - counted units ("1 large", "1 slice", "1 tortilla", a label serving) add up only with the same unit.
 *
 * Amounts that can't be converted into each other ("2 large eggs" and "100 g egg") stay as separate lines
 * with a note saying so, instead of guessing a conversion.
 */

export interface GroceryInput {
  /** Ingredient identity, e.g. "usda:171287" or "name:egg". */
  key: string;
  name: string;
  quantity: number;
  /** The unit as picked, e.g. "g", "oz", "1 cup, chopped", "1 large". */
  unitLabel: string;
  /** Weight of one unit, when known. Used to list label-style units ("NLEA serving", "pat") by weight. */
  gramsPerUnit?: number | null;
}

/** Counted units nobody shops by; listed by weight instead when the weight is known. */
const UNSHOPPABLE = /\b(serving|nlea|pat|portion|packet|scoop|container|order)\b/i;

export type UnitClass = { dim: "mass"; factor: number } | { dim: "volume"; factor: number } | { dim: "count"; label: string; factor: number };

const ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  "fl oz": 29.5735,
  floz: 29.5735,
  cup: 236.588,
  cups: 236.588,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  quart: 946.353,
  pint: 473.176,
  gallon: 3785.41,
};
const GRAMS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, oz: GRAMS_PER_OZ, ounce: GRAMS_PER_OZ, lb: GRAMS_PER_LB, pound: GRAMS_PER_LB };

function parseLeadingNumber(s: string): { n: number; rest: string } {
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(.*)$/);
  if (!m) return { n: 1, rest: s };
  const n = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
  return { n: n > 0 ? n : 1, rest: m[3] ?? "" };
}

/** What a unit label measures, and how much of the base unit (g, ml, or one counted item) it is. */
export function classifyUnit(label: string): UnitClass {
  const raw = label.trim().toLowerCase();
  if (raw in GRAMS) return { dim: "mass", factor: GRAMS[raw]! };
  if (raw in ML) return { dim: "volume", factor: ML[raw]! };
  const { n, rest } = parseLeadingNumber(raw);
  // "fl oz" before "oz": fluid ounces are a volume.
  const head = rest.replace(/\(.*$/, "").split(",")[0]!.trim();
  if (/^fl\.? ?oz\b/.test(head)) return { dim: "volume", factor: n * ML["fl oz"]! };
  const word = head.split(/\s+/)[0] ?? "";
  if (word in GRAMS && head === word) return { dim: "mass", factor: n * GRAMS[word]! };
  if (word in ML) return { dim: "volume", factor: n * ML[word]! };
  // Counted units: "1 large", "1 medium (7" to 7-7/8" long)", "serving (1 bar (60 g))", "1 slice".
  // The label keeps its original case ("NLEA serving"); grouping ignores case.
  const original = parseLeadingNumber(label.trim()).rest.replace(/\(.*$/, "").split(",")[0]!.trim();
  const countLabel = (raw.startsWith("serving") ? "serving" : original || label.trim()).replace(/\s+/g, " ").trim() || "item";
  return { dim: "count", label: countLabel, factor: n };
}

export interface GroceryLine {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  /** Explains lines for the same ingredient that couldn't be combined. */
  note: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const quarter = (n: number) => Math.max(0.25, Math.round(n * 4) / 4);

/** A combined amount in a readable unit for the person's unit system. */
export function displayAmount(dim: UnitClass["dim"], base: number, units: UnitSystem, countLabel = "item"): { quantity: number; unit: string } {
  if (dim === "mass") {
    if (units === "imperial") {
      const oz = base / GRAMS_PER_OZ;
      return oz >= 16 ? { quantity: r1(base / GRAMS_PER_LB), unit: "lb" } : { quantity: r1(oz), unit: "oz" };
    }
    return base >= 1000 ? { quantity: r1(base / 1000), unit: "kg" } : { quantity: Math.round(base), unit: "g" };
  }
  if (dim === "volume") {
    if (units === "imperial") {
      const cups = base / ML.cup!;
      if (cups >= 0.25) return { quantity: quarter(cups), unit: cups > 1.125 ? "cups" : "cup" };
      const tbsp = base / ML.tbsp!;
      return tbsp >= 1 ? { quantity: Math.round(tbsp * 2) / 2, unit: "tbsp" } : { quantity: Math.max(0.25, quarter(base / ML.tsp!)), unit: "tsp" };
    }
    return base >= 1000 ? { quantity: r1(base / 1000), unit: "l" } : { quantity: Math.round(base), unit: "ml" };
  }
  // Counted items in quarter steps ("1.75 medium"), never below a quarter.
  return { quantity: quarter(base), unit: countLabel };
}

const DIM_TEXT = { mass: "by weight", volume: "by volume", count: "by count" } as const;

/** Combines ingredient amounts into grocery lines (sorted by name, then unit). */
export function mergeGroceries(items: GroceryInput[], units: UnitSystem): GroceryLine[] {
  interface Acc {
    key: string;
    name: string;
    dim: UnitClass["dim"];
    countLabel: string;
    base: number;
  }
  const groups = new Map<string, Acc>();
  for (const i of items) {
    if (!(i.quantity > 0)) continue;
    let u = classifyUnit(i.unitLabel);
    if (u.dim === "count" && i.gramsPerUnit && i.gramsPerUnit > 0 && UNSHOPPABLE.test(u.label)) u = { dim: "mass", factor: i.gramsPerUnit };
    const label = u.dim === "count" ? u.label.toLowerCase() : "";
    const gk = `${i.key}|${u.dim}|${label}`;
    const acc = groups.get(gk) ?? { key: i.key, name: i.name, dim: u.dim, countLabel: u.dim === "count" ? u.label : "", base: 0 };
    acc.base += i.quantity * u.factor;
    groups.set(gk, acc);
  }
  const byKey = new Map<string, Acc[]>();
  for (const a of groups.values()) byKey.set(a.key, [...(byKey.get(a.key) ?? []), a]);
  const lines: GroceryLine[] = [];
  for (const accs of byKey.values()) {
    const shown = accs.map((a) => ({ a, ...displayAmount(a.dim, a.base, units, a.countLabel) }));
    for (const s of shown) {
      const others = shown.filter((o) => o !== s);
      lines.push({
        key: s.a.key,
        name: s.a.name,
        quantity: s.quantity,
        unit: s.unit,
        note: others.length
          ? `Also on the list as ${others.map((o) => `${o.quantity} ${o.unit}`).join(" and ")}: amounts ${DIM_TEXT[s.a.dim]} and ${others.map((o) => (o.a.dim === s.a.dim ? `"${o.unit}"` : DIM_TEXT[o.a.dim])).join(" and ")} can't be combined.`
          : null,
      });
    }
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}
