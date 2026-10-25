/**
 * Narrow Gate Food IQ: an original, documented 0–100 nutritional-quality rating, plain-language nutrient
 * classifications, and a separate "fits your goals" analysis. Pure (no I/O).
 *
 * The full method, every weight and threshold, the reference foods it was checked against and its known biases are
 * in docs/FOOD_IQ_METHOD.md. The rating is EXPERIMENTAL: it's shown only when the FOOD_IQ_SCORE flag is on, labelled
 * as not yet independently reviewed, and never computed from missing data.
 *
 * What the number means: a nutritional-quality rating per 100 g (or 100 ml) for comparing products. 75/100 is not a
 * 75% chance that a food is healthy or safe, and it says nothing about allergens, additives or a person's needs.
 */
import { type DietType } from "@/lib/domain/diets";
import { allergenLabel, type FoodFilters, type Nutrients, type QualityProduct } from "./food-quality";

export const FOOD_IQ_VERSION = "FIQ-0.1";

/**
 * What members see this called. "Food IQ" is registered as a US trademark by another company (Reg. 4337059) and used
 * by several nutrition apps (docs/launch-audit/TRADEMARKS.md), so the public name is "Nutrition Score" until a
 * replacement name is cleared; the code, the FOOD_IQ_SCORE flag, the method version and the test ids keep their names
 * so nothing stored or integrated changes.
 */
export const NUTRITION_SCORE_LABEL = "Nutrition Score";
export const NUTRITION_FEATURE_TITLE = "Narrow Gate Nutrition Score";

/** The rating is shown only when this server-side flag is "on" (off by default, so production shows it only once reviewed). */
export function foodIqScoreEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.FOOD_IQ_SCORE === "on";
}

export type Band = "excellent" | "good" | "moderate" | "poor" | "very_poor";
export const BANDS: { id: Band; label: string; min: number }[] = [
  { id: "excellent", label: "Excellent", min: 85 },
  { id: "good", label: "Good", min: 70 },
  { id: "moderate", label: "Moderate", min: 50 },
  { id: "poor", label: "Poor", min: 30 },
  { id: "very_poor", label: "Very poor", min: 0 },
];
export function bandFor(score: number): { id: Band; label: string } {
  const b = BANDS.find((x) => score >= x.min) ?? BANDS.at(-1)!;
  return { id: b.id, label: b.label };
}

export const SCORE_MEANING =
  "A nutritional-quality rating per 100 g (or 100 ml), for comparing products. 75/100 doesn't mean a 75% chance a food is healthy or safe. It doesn't cover allergens, additives or your personal needs: see \"Fits your goals\" for those.";

export type FoodIqKind = "general" | "beverage" | "fats" | "water";
export const KIND_LABEL: Record<FoodIqKind, string> = {
  general: "Foods",
  beverage: "Drinks",
  fats: "Fats, oils, nuts and seeds",
  water: "Water",
};

/** Products the rating doesn't apply to, and why. */
const NOT_RATED: [string, string][] = [
  ["en:alcoholic-beverages", "Alcoholic drinks aren't rated: their main health effects come from the alcohol, which this rating doesn't measure."],
  ["en:baby-foods", "Foods for babies and young children have their own composition rules and aren't rated."],
  ["en:baby-milks", "Infant formulas have their own composition rules and aren't rated."],
  ["en:infant-formulas", "Infant formulas have their own composition rules and aren't rated."],
  ["en:dietary-supplements", "Dietary supplements aren't foods eaten for nutrition by the 100 g, so they aren't rated."],
  ["en:food-supplements", "Dietary supplements aren't foods eaten for nutrition by the 100 g, so they aren't rated."],
  ["en:herbs-and-spices", "Herbs and spices are used in small amounts, so values per 100 g would be misleading."],
  ["en:salts", "Salt is used in small amounts as an ingredient, so a rating per 100 g would be misleading."],
  ["en:table-top-sweeteners", "Table-top sweeteners are used in very small amounts, so a rating per 100 g would be misleading."],
];
const FAT_TAGS = ["en:fats", "en:vegetable-oils", "en:olive-oils", "en:vegetable-fats", "en:animal-fats", "en:butters", "en:spreadable-fats", "en:margarines", "en:nuts", "en:seeds", "en:nut-butters", "en:peanut-butters", "en:nuts-and-their-products"];
const WATER_TAGS = ["en:waters", "en:spring-waters", "en:mineral-waters", "en:natural-mineral-waters"];

/** Non-sugar sweeteners covered by the WHO 2023 guideline (polyols aren't). */
const NSS_CODES = new Set(["e950", "e951", "e952", "e954", "e955", "e957", "e959", "e960", "e960a", "e961", "e962", "e969"]);
const NSS_WORDS = /\b(sucralose|aspartame|acesulfame|saccharin|steviol|stevia|cyclamate|neotame|advantame|monk ?fruit|mogrosides?)\b/i;
export function hasNonSugarSweeteners(p: Pick<QualityProduct, "additives" | "ingredientsText">): boolean {
  return p.additives.some((a) => NSS_CODES.has(a) || NSS_CODES.has(a.replace(/(i{1,3}|iv|v)$/, ""))) || NSS_WORDS.test(p.ingredientsText ?? "");
}

export function foodIqKind(p: QualityProduct): FoodIqKind {
  const cats = p.categories;
  if (cats.some((c) => WATER_TAGS.includes(c))) return "water";
  if (cats.some((c) => FAT_TAGS.includes(c))) return "fats";
  // Milks and plant-based drinks are rated as foods (they're eaten for protein and other nutrients, not just fluid).
  const milkish = cats.some((c) => /milk|dairy-drink|yogurt-drink|kefir/.test(c));
  if (!milkish && (p.unit === "ml" || cats.includes("en:beverages"))) return "beverage";
  return "general";
}

/** 0 at or below `a`, 10 at or above `b`, linear in between. */
export function lin(x: number, a: number, b: number): number {
  if (x <= a) return 0;
  if (x >= b) return 10;
  return ((x - a) / (b - a)) * 10;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface ScoreComponent {
  key: string;
  label: string;
  kind: "negative" | "positive";
  /** The value it's based on, as shown ("12 g per 100 g", "21% of energy"). */
  value: string;
  points: number;
  max: number;
  /** How the points are worked out, in words, with the sources of the anchor values. */
  basis: string;
}

export type FoodIqScore =
  | { status: "not_applicable"; reason: string }
  | { status: "insufficient"; missing: string[] }
  | {
      status: "scored";
      version: string;
      kind: FoodIqKind;
      /** What the per-100 values are measured in (the product's own unit). */
      unit: "g" | "ml";
      score: number;
      band: { id: Band; label: string };
      components: ScoreComponent[];
      negativeTotal: number;
      positiveTotal: number;
      /** How much of the positive points counted (lower when there's a lot to watch). */
      positiveFactor: number;
      /** Assumptions made because of missing optional data (e.g. fibre not listed). */
      assumptions: string[];
      summary: string;
    };

const MISSING_LABEL: Partial<Record<keyof Nutrients, string>> = { calories: "energy", sugars_g: "sugars", sat_fat_g: "saturated fat", salt_g: "salt", protein_g: "protein", fat_g: "fat" };

/** Positive points count fully up to 5 points of concern, tapering to half at 15 or more. */
export function positiveFactor(negative: number): number {
  return 1 - 0.5 * Math.min(1, Math.max(0, (negative - 5) / 10));
}

/**
 * The Food IQ rating (method FIQ-0.1). Per 100 g, or per 100 ml for drinks.
 *
 *   foods and fats:  score = 50 + 2.5 × P − 1.5 × N
 *   drinks:          score = 80 + 2.5 × P − 2 × N
 *
 * N adds points for sugars, saturated fat (or, for fats and oils, the saturated share of the fat), salt and energy
 * density (drinks: also non-sugar sweeteners); P adds points for fibre, protein, fruit/vegetables/legumes/nuts and a
 * mostly unsaturated fat profile. P is capped at 20 and counts less as N grows. Clamped to 0–100.
 */
export function scoreFoodIq(p: QualityProduct): FoodIqScore {
  for (const [tag, reason] of NOT_RATED) if (p.categories.includes(tag)) return { status: "not_applicable", reason };
  const kind = foodIqKind(p);
  const v = p.per100;
  const sweet = hasNonSugarSweeteners(p);

  if (kind === "water" && v.calories != null && v.calories <= 1 && (v.sugars_g ?? 0) <= 0.5 && !sweet) {
    return {
      status: "scored",
      version: FOOD_IQ_VERSION,
      kind,
      unit: p.unit,
      score: 100,
      band: bandFor(100),
      components: [],
      negativeTotal: 0,
      positiveTotal: 0,
      positiveFactor: 1,
      assumptions: [],
      summary: "Plain water: the reference drink, rated 100.",
    };
  }
  const k: FoodIqKind = kind === "water" ? "beverage" : kind;
  const required: (keyof Nutrients)[] = k === "fats" ? ["calories", "fat_g", "sat_fat_g", "sugars_g", "salt_g", "protein_g"] : ["calories", "sugars_g", "sat_fat_g", "salt_g", "protein_g"];
  const missing = required.filter((key) => v[key] == null).map((key) => MISSING_LABEL[key] ?? key);
  if (missing.length) return { status: "insufficient", missing };

  const kcal = v.calories!;
  const sugars = v.sugars_g!;
  const sat = v.sat_fat_g!;
  const salt = v.salt_g!;
  const protein = v.protein_g!;
  const fat = v.fat_g;
  const u = p.unit;
  const per = `per 100 ${u}`;
  const assumptions: string[] = [];
  const comps: ScoreComponent[] = [];
  const add = (c: Omit<ScoreComponent, "points"> & { points: number }) => comps.push({ ...c, points: r1(c.points) });

  // ---- Points of concern (N)
  if (k === "beverage") {
    add({ key: "sugars", label: "Sugars", kind: "negative", value: `${sugars} g ${per}`, points: 3 * lin(sugars, 0.5, 11.25), max: 30, basis: "0 points at 0.5 g or less (the EU \"sugar-free\" level), rising to 30 at 11.25 g per 100 ml (the UK \"high\" level for drinks). Weighted 3× because sugary drinks are a leading source of free sugars." });
    add({ key: "energy", label: "Calories", kind: "negative", value: `${kcal} kcal ${per}`, points: 0.5 * lin(kcal, 4, 60), max: 5, basis: "0 points at 4 kcal or less (the EU \"energy-free\" level), up to 5 at 60 kcal per 100 ml. Half weight." });
    add({ key: "sat_fat", label: "Saturated fat", kind: "negative", value: `${sat} g ${per}`, points: lin(sat, 0.75, 2.5), max: 10, basis: "0 points at 0.75 g or less (EU \"low saturated fat\" for drinks), 10 at 2.5 g (UK \"high\" for drinks)." });
    add({ key: "salt", label: "Salt", kind: "negative", value: `${salt} g ${per}`, points: lin(salt, 0.3, 0.75), max: 10, basis: "0 points at 0.3 g or less (UK \"low\"), 10 at 0.75 g (UK \"high\" for drinks)." });
    if (sweet)
      add({ key: "sweeteners", label: "Non-sugar sweeteners", kind: "negative", value: "Present", points: 10, max: 10, basis: "10 points when a drink contains non-sugar sweeteners: the WHO (2023) advises against relying on them for weight control (a conditional recommendation). This is about diet patterns, not a safety finding." });
  } else {
    add({ key: "sugars", label: "Sugars", kind: "negative", value: `${sugars} g ${per}`, points: lin(sugars, 5, 22.5), max: 10, basis: "0 points at 5 g or less (the EU \"low sugars\" level), 10 at 22.5 g (the UK \"high\" level). Natural and added sugars are counted alike." });
    if (k === "fats") {
      const share = fat && fat > 0 ? (sat / fat) * 100 : 0;
      add({ key: "sat_share", label: "Saturated share of the fat", kind: "negative", value: `${Math.round(share)}% of the fat`, points: lin(share, 15, 60), max: 10, basis: "For fats, oils, nuts and seeds the type of fat matters more than the amount: 0 points when 15% or less of the fat is saturated (most vegetable oils), 10 at 60% or more (butter, coconut oil)." });
    } else {
      add({ key: "sat_fat", label: "Saturated fat", kind: "negative", value: `${sat} g ${per}`, points: lin(sat, 1.5, 5), max: 10, basis: "0 points at 1.5 g or less (EU \"low saturated fat\"), 10 at 5 g (UK \"high\")." });
    }
    add({ key: "salt", label: "Salt", kind: "negative", value: `${salt} g ${per}`, points: lin(salt, 0.3, 1.5), max: 10, basis: "0 points at 0.3 g or less (UK \"low\", equal to the EU \"low sodium\" level), 10 at 1.5 g (UK \"high\")." });
    if (k === "general")
      add({ key: "energy", label: "Calories", kind: "negative", value: `${kcal} kcal ${per}`, points: 0.5 * lin(kcal, 150, 400), max: 5, basis: "0 points at 150 kcal or less, up to 5 at 400 kcal per 100 g (20% of a 2,000 kcal reference intake in every 100 g). Half weight, so a high-calorie food isn't marked down much for calories alone." });
  }
  const N = comps.reduce((a, c) => a + c.points, 0);

  // ---- Positive points (P)
  const proteinShare = kcal > 0 ? ((protein * 4) / kcal) * 100 : 0;
  if (kcal >= 4)
    add({ key: "protein", label: "Protein", kind: "positive", value: `${Math.round(proteinShare)}% of energy`, points: lin(proteinShare, 8, 20), max: 10, basis: "Protein relative to energy, so a large serving isn't needed to score: 0 points at 8% of energy or less, 10 at 20% (the EU \"high protein\" level; 12% is the \"source of protein\" level)." });
  if (v.fiber_g != null) {
    add({ key: "fibre", label: "Fibre", kind: "positive", value: `${v.fiber_g} g ${per}`, points: k === "beverage" ? lin(v.fiber_g, 0, 3) : lin(v.fiber_g, 0, 6), max: 10, basis: k === "beverage" ? "0 to 10 points from 0 to 3 g per 100 ml." : "0 to 10 points from 0 to 6 g per 100 g (the EU \"high fibre\" level; 3 g is \"source of fibre\")." });
  } else if (k !== "beverage") {
    assumptions.push("Fibre isn't listed, so it counts as 0. If the product has fibre, this rating is too low, never too high.");
  }
  if (p.fvlPercent != null && k !== "fats") {
    add({ key: "fvl", label: "Fruit, vegetables, legumes and nuts", kind: "positive", value: `${p.fvlPercent}% of the product`, points: lin(p.fvlPercent, 40, 80), max: 10, basis: "0 points at 40% or less, 10 at 80% or more, from Open Food Facts' estimate from the ingredient list." });
  } else if (k !== "fats") {
    assumptions.push("The fruit, vegetable and legume share isn't known, so it isn't counted.");
  }
  const unsatShare = fat && fat > 0 ? ((fat - sat) / fat) * 100 : null;
  if (k === "fats" && unsatShare != null)
    add({ key: "fat_profile", label: "Mostly unsaturated fat", kind: "positive", value: `${Math.round(unsatShare)}% unsaturated`, points: lin(unsatShare, 50, 85), max: 10, basis: "0 points when half the fat or less is unsaturated, 10 at 85% or more (olive, rapeseed and most nut oils)." });
  if (k === "general" && fat != null && fat >= 10 && unsatShare != null)
    add({ key: "fat_profile", label: "Mostly unsaturated fat", kind: "positive", value: `${Math.round(unsatShare)}% unsaturated`, points: 0.5 * lin(unsatShare, 50, 85), max: 5, basis: "For foods with 10 g of fat or more per 100 g: up to 5 points when most of the fat is unsaturated (as in oily fish or avocado)." });

  const rawP = comps.filter((c) => c.kind === "positive").reduce((a, c) => a + c.points, 0);
  const factor = positiveFactor(N);
  const P = Math.min(20, rawP) * factor;
  const base = k === "beverage" ? 80 + 2.5 * P - 2 * N : 50 + 2.5 * P - 1.5 * N;
  const score = Math.max(0, Math.min(100, Math.round(base)));
  const band = bandFor(score);
  return {
    status: "scored",
    version: FOOD_IQ_VERSION,
    kind: k,
    unit: p.unit,
    score,
    band,
    components: comps,
    negativeTotal: r1(N),
    positiveTotal: r1(P),
    positiveFactor: r1(factor * 100) / 100,
    assumptions,
    summary: summarise(band.label, comps),
  };
}

function summarise(band: string, comps: ScoreComponent[]): string {
  const top = (kind: "positive" | "negative") =>
    comps
      .filter((c) => c.kind === kind && c.points >= (kind === "positive" ? 3 : 2.5))
      .sort((a, b) => b.points / b.max - a.points / a.max)
      .slice(0, 2)
      .map((c) => c.label.toLowerCase());
  const pos = top("positive");
  const neg = top("negative");
  const list = (xs: string[]) => xs.join(" and ");
  const verb = (xs: string[]) => (xs.length > 1 || /s$/.test(xs[0] ?? "") ? "help" : "helps");
  if (band === "Excellent" || band === "Good") return `Rated ${band}, mainly for its ${pos.length ? list(pos) : "low levels of sugars, saturated fat and salt"}.${neg.length ? ` Held back a little by its ${list(neg)}.` : ""}`;
  if (band === "Moderate") {
    if (pos.length && neg.length) return `Rated Moderate: its ${list(pos)} ${pos.length > 1 ? "are" : "is"} offset by its ${list(neg)}.`;
    if (neg.length) return `Rated Moderate, held back by its ${list(neg)}.`;
    if (pos.length) return `Rated Moderate: some ${list(pos)}, but not enough to rate higher.`;
    return "Rated Moderate: nothing stands out either way.";
  }
  return `Rated ${band}${neg.length ? `, mainly because of its ${list(neg)}` : ""}.${pos.length ? ` Its ${list(pos)} ${verb(pos)} a little.` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Nutrient classifications ("high in protein", "low in sugars", ...)
// ---------------------------------------------------------------------------------------------------------------

/** legal: an EU nutrition-claim threshold (Reg. 1924/2006). guidance: UK front-of-pack levels. informal: the app's own comparison, explained. */
export type ClassKind = "legal" | "guidance" | "informal";
export const CLASS_KIND_LABEL: Record<ClassKind, string> = {
  legal: "EU claim threshold",
  guidance: "UK front-of-pack level",
  informal: "Comparison, not a legal term",
};
export interface NutrientClass {
  id: string;
  label: string;
  tone: "positive" | "neutral" | "attention";
  kind: ClassKind;
  detail: string;
}

function servingNote(p: QualityProduct, key: keyof Nutrients, unit: string): string {
  const s = p.perServing?.[key];
  if (s == null) return "";
  const label = p.servingLabel ?? `${p.servingQuantity} ${p.unit}`;
  return ` A serving (${label}) has ${s} ${unit}.`;
}

/** What the product's numbers say about it, each labelled as a legal threshold, official guidance, or an informal comparison. */
export function nutrientClasses(p: QualityProduct): NutrientClass[] {
  const v = p.per100;
  const liquid = p.unit === "ml";
  const per = `per 100 ${p.unit}`;
  const out: NutrientClass[] = [];
  const kcal = v.calories;

  if (v.protein_g != null && kcal != null && kcal >= 20) {
    const share = Math.round(((v.protein_g * 4) / kcal) * 100);
    if (share >= 20)
      out.push({ id: "protein_high", label: "High in protein", tone: "positive", kind: "legal", detail: `This food provides a substantial amount of protein relative to its energy content: ${share}% of its calories come from protein (EU "high protein" is 20% or more). ${v.protein_g} g ${per}.${servingNote(p, "protein_g", "g")}` });
    else if (share >= 12)
      out.push({ id: "protein_source", label: "Source of protein", tone: "positive", kind: "legal", detail: `${share}% of its calories come from protein (EU "source of protein" is 12% or more). ${v.protein_g} g ${per}.${servingNote(p, "protein_g", "g")}` });
    else
      out.push({ id: "protein_low", label: "Lower in protein", tone: "neutral", kind: "informal", detail: `Only ${share}% of its calories come from protein, below the EU "source of protein" level of 12%. ${v.protein_g} g ${per}.${servingNote(p, "protein_g", "g")}` });
  }
  if (v.carbs_g != null && kcal != null && kcal >= 20) {
    const share = Math.round(((v.carbs_g * 4) / kcal) * 100);
    if (share > 65)
      out.push({ id: "carbs_high", label: "High in carbohydrates", tone: "neutral", kind: "informal", detail: `${share}% of its calories come from carbohydrates, above the 45–65% range recommended for a whole diet (US Acceptable Macronutrient Distribution Range). ${v.carbs_g} g ${per}.${servingNote(p, "carbs_g", "g")} Useful fuel around training; worth counting on a low-carb plan.` });
    else if (share < 45)
      out.push({ id: "carbs_low", label: "Lower in carbohydrates", tone: "neutral", kind: "informal", detail: `${share}% of its calories come from carbohydrates, below the 45–65% range recommended for a whole diet. ${v.carbs_g} g ${per}.${servingNote(p, "carbs_g", "g")}` });
  }
  if (v.fat_g != null) {
    if (v.fat_g > (liquid ? 8.75 : 17.5)) out.push({ id: "fat_high", label: "High in fat", tone: "attention", kind: "guidance", detail: `${v.fat_g} g ${per}, above the UK "high" level of ${liquid ? "8.75" : "17.5"} g. Fat is energy-dense (9 kcal per gram); the type of fat matters too (see saturated fat).${servingNote(p, "fat_g", "g")}` });
    else if (v.fat_g <= (liquid ? 1.5 : 3)) out.push({ id: "fat_low", label: "Low in fat", tone: "positive", kind: "legal", detail: `${v.fat_g} g ${per} (EU "low fat" is at most ${liquid ? "1.5 g per 100 ml" : "3 g per 100 g"}).${servingNote(p, "fat_g", "g")}` });
  }
  if (v.sat_fat_g != null) {
    if (v.sat_fat_g > (liquid ? 2.5 : 5)) out.push({ id: "sat_high", label: "High in saturated fat", tone: "attention", kind: "guidance", detail: `${v.sat_fat_g} g ${per}, above the UK "high" level of ${liquid ? "2.5" : "5"} g.${servingNote(p, "sat_fat_g", "g")}` });
    else if (v.sat_fat_g <= (liquid ? 0.75 : 1.5) && kcal != null && (kcal === 0 || (v.sat_fat_g * 9) / kcal <= 0.1)) out.push({ id: "sat_low", label: "Low in saturated fat", tone: "positive", kind: "legal", detail: `${v.sat_fat_g} g ${per} (EU "low saturated fat" level).${servingNote(p, "sat_fat_g", "g")}` });
  }
  if (v.sugars_g != null) {
    if (v.sugars_g > (liquid ? 11.25 : 22.5)) out.push({ id: "sugar_high", label: "High in sugars", tone: "attention", kind: "guidance", detail: `${v.sugars_g} g ${per}, above the UK "high" level of ${liquid ? "11.25" : "22.5"} g. This counts all sugars, including those naturally in fruit or milk.${servingNote(p, "sugars_g", "g")}` });
    else if (v.sugars_g <= 0.5) out.push({ id: "sugar_free", label: "Sugar-free level", tone: "positive", kind: "legal", detail: `${v.sugars_g} g ${per} (EU "sugar-free" is at most 0.5 g).${servingNote(p, "sugars_g", "g")}` });
    else if (v.sugars_g <= (liquid ? 2.5 : 5)) out.push({ id: "sugar_low", label: "Low in sugars", tone: "positive", kind: "legal", detail: `${v.sugars_g} g ${per} (EU "low sugars" is at most ${liquid ? "2.5 g per 100 ml" : "5 g per 100 g"}).${servingNote(p, "sugars_g", "g")}` });
  }
  if (v.fiber_g != null) {
    const per100kcal = kcal && kcal > 0 ? (v.fiber_g / kcal) * 100 : 0;
    if (v.fiber_g >= 6 || per100kcal >= 3) out.push({ id: "fibre_high", label: "High in fibre", tone: "positive", kind: "legal", detail: `${v.fiber_g} g ${per} (EU "high fibre" is at least 6 g per 100 g or 3 g per 100 kcal).${servingNote(p, "fiber_g", "g")}` });
    else if (v.fiber_g >= 3 || per100kcal >= 1.5) out.push({ id: "fibre_source", label: "Source of fibre", tone: "positive", kind: "legal", detail: `${v.fiber_g} g ${per} (EU "source of fibre" is at least 3 g per 100 g or 1.5 g per 100 kcal).${servingNote(p, "fiber_g", "g")}` });
  }
  if (v.salt_g != null || v.sodium_mg != null) {
    const sodium = v.sodium_mg ?? Math.round((v.salt_g ?? 0) * 400);
    const salt = v.salt_g ?? sodium / 400;
    if (salt > (liquid ? 0.75 : 1.5)) out.push({ id: "salt_high", label: "High in salt", tone: "attention", kind: "guidance", detail: `${r1(salt)} g salt (${sodium} mg sodium) ${per}, above the UK "high" level of ${liquid ? "0.75" : "1.5"} g salt.${servingNote(p, "sodium_mg", "mg sodium")}` });
    else if (sodium <= 40) out.push({ id: "sodium_very_low", label: "Very low in sodium", tone: "positive", kind: "legal", detail: `${sodium} mg sodium ${per} (EU "very low sodium" is at most 40 mg).${servingNote(p, "sodium_mg", "mg sodium")}` });
    else if (sodium <= 120) out.push({ id: "sodium_low", label: "Lower in sodium", tone: "positive", kind: "legal", detail: `${sodium} mg sodium ${per} (EU "low sodium" is at most 120 mg).${servingNote(p, "sodium_mg", "mg sodium")}` });
  }
  if (kcal != null) {
    if (kcal <= (liquid ? 20 : 40)) out.push({ id: "kcal_low", label: "Lower in calories", tone: "positive", kind: "legal", detail: `${kcal} kcal ${per} (EU "low energy" is at most ${liquid ? "20 kcal per 100 ml" : "40 kcal per 100 g"}).${servingNote(p, "calories", "kcal")}` });
    else if (!liquid && kcal >= 400) out.push({ id: "kcal_high", label: "High in calories", tone: "neutral", kind: "informal", detail: `${kcal} kcal ${per}: every 100 g gives 20% or more of a 2,000 kcal reference intake.${servingNote(p, "calories", "kcal")} Calorie-dense foods aren't unhealthy in themselves; the portion decides how they fit.` });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Fits your goals (Pro): the product against the member's own targets. Separate from the general rating.
// ---------------------------------------------------------------------------------------------------------------

export interface MemberTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
export interface MemberContext {
  targets: MemberTargets | null;
  goal: string | null;
  diet: DietType | null;
  filters: FoodFilters | null;
}

/** Fibre reference: 14 g per 1,000 kcal (Dietary Guidelines for Americans). Sodium: 2,300 mg a day for adults (same source). */
export const FIBRE_PER_1000_KCAL = 14;
export const SODIUM_LIMIT_MG = 2300;

export interface GoalRow {
  key: "calories" | "protein" | "carbs" | "fat" | "fibre" | "sodium";
  label: string;
  amount: number | null;
  unit: string;
  target: number | null;
  /** % of the target (or of the limit, for sodium). */
  pct: number | null;
  targetLabel: string;
}
export interface GoalFit {
  basis: string;
  rows: GoalRow[];
  notes: { tone: "positive" | "neutral" | "attention"; text: string }[];
  conflicts: string[];
}

const GOAL_LABEL: Record<string, string> = {
  build_strength: "building strength",
  build_muscle: "building muscle",
  lose_fat: "losing fat",
  improve_conditioning: "conditioning",
  athletic_performance: "athletic performance",
  combat_sports: "combat sports",
  general_health: "general health",
  mobility: "mobility",
};

export function fitsYourGoals(p: QualityProduct, m: MemberContext): GoalFit {
  const serving = p.perServing;
  const v = serving ?? p.per100;
  const basis = serving ? `one serving (${p.servingLabel ?? `${p.servingQuantity} ${p.unit}`})` : `100 ${p.unit} (no serving size in the data)`;
  const t = m.targets;
  const pct = (a: number | null, b: number | null) => (a == null || !b ? null : Math.round((a / b) * 100));
  const fibreTarget = t ? Math.round((t.calories / 1000) * FIBRE_PER_1000_KCAL) : null;
  const rows: GoalRow[] = [
    { key: "calories", label: "Calories", amount: v.calories, unit: "kcal", target: t?.calories ?? null, pct: pct(v.calories, t?.calories ?? null), targetLabel: "of your daily calories" },
    { key: "protein", label: "Protein", amount: v.protein_g, unit: "g", target: t?.protein_g ?? null, pct: pct(v.protein_g, t?.protein_g ?? null), targetLabel: "of your protein target" },
    { key: "carbs", label: "Carbohydrates", amount: v.carbs_g, unit: "g", target: t?.carbs_g ?? null, pct: pct(v.carbs_g, t?.carbs_g ?? null), targetLabel: "of your carb target" },
    { key: "fat", label: "Fat", amount: v.fat_g, unit: "g", target: t?.fat_g ?? null, pct: pct(v.fat_g, t?.fat_g ?? null), targetLabel: "of your fat target" },
    { key: "fibre", label: "Fibre", amount: v.fiber_g, unit: "g", target: fibreTarget, pct: pct(v.fiber_g, fibreTarget), targetLabel: "of a fibre target for your calories" },
    { key: "sodium", label: "Sodium", amount: v.sodium_mg, unit: "mg", target: SODIUM_LIMIT_MG, pct: pct(v.sodium_mg, SODIUM_LIMIT_MG), targetLabel: "of the 2,300 mg daily limit" },
  ];
  const notes: GoalFit["notes"] = [];
  const goal = m.goal ? GOAL_LABEL[m.goal] ?? null : null;
  const kcal = v.calories;
  const prot = v.protein_g;
  if (!t) notes.push({ tone: "neutral", text: "Set your calorie and macro targets in Food to see how this fits your day." });

  if (prot != null && kcal != null && kcal > 0) {
    const per100kcal = r1((prot / kcal) * 100);
    if (per100kcal >= 5) notes.push({ tone: "positive", text: `Protein-dense: ${per100kcal} g of protein per 100 kcal.${goal && /muscle|strength|fat/.test(goal) ? ` That suits ${goal}.` : ""}` });
    else if (per100kcal < 2.5 && (m.goal === "build_muscle" || m.goal === "build_strength" || m.goal === "lose_fat"))
      notes.push({ tone: "neutral", text: `Low in protein for its calories (${per100kcal} g per 100 kcal), so it adds little toward your protein target.` });
  }
  const calRow = rows[0]!;
  if (calRow.pct != null) {
    if (calRow.pct >= 25) notes.push({ tone: m.goal === "lose_fat" ? "attention" : "neutral", text: `${basis[0]!.toUpperCase() + basis.slice(1)} is ${calRow.pct}% of your daily calorie budget.${m.goal === "lose_fat" ? " Plan the rest of the day around it." : m.goal === "build_muscle" ? " Handy when you need to eat more." : ""}` });
    else if (calRow.pct <= 5 && kcal != null) notes.push({ tone: "neutral", text: `Light: ${kcal} kcal, ${calRow.pct}% of your daily calories.` });
  }
  const protRow = rows[1]!;
  if (protRow.pct != null && protRow.pct >= 20) notes.push({ tone: "positive", text: `Covers ${protRow.pct}% of your daily protein target in one go.` });
  if ((m.goal === "improve_conditioning" || m.goal === "athletic_performance" || m.goal === "combat_sports") && v.carbs_g != null && v.carbs_g >= 20)
    notes.push({ tone: "neutral", text: `${v.carbs_g} g of carbohydrates: usable fuel before or after hard sessions.` });
  const sodRow = rows[5]!;
  if (sodRow.pct != null && sodRow.pct >= 20) notes.push({ tone: "attention", text: `${sodRow.pct}% of the 2,300 mg daily sodium limit.` });

  const conflicts: string[] = [];
  const dietWord = m.diet === "vegan" ? "vegan" : m.diet === "vegetarian" ? "vegetarian" : null;
  if (dietWord) {
    const s = dietWord === "vegan" ? p.vegan : p.vegetarian;
    if (s === "no") conflicts.push(`Not ${dietWord}, based on its ingredients (your diet style is ${dietWord}).`);
    else if (s !== "yes") conflicts.push(`Can't confirm it's ${dietWord} from the data: check the label.`);
  }
  if ((m.diet === "keto" || m.diet === "carnivore" || m.diet === "low_carb") && v.carbs_g != null && t && t.carbs_g > 0) {
    const share = Math.round((v.carbs_g / t.carbs_g) * 100);
    if (share >= 25) conflicts.push(`${v.carbs_g} g of carbohydrates is ${share}% of your ${m.diet === "low_carb" ? "low-carb" : m.diet} daily carb target (${t.carbs_g} g).`);
  }
  for (const a of m.filters?.allergens ?? []) {
    if (p.allergens.includes(a)) conflicts.push(`Contains ${allergenLabel(a).toLowerCase()}, which you've chosen to avoid.`);
    else if (p.traces.includes(a)) conflicts.push(`May contain ${allergenLabel(a).toLowerCase()} (traces), which you've chosen to avoid.`);
  }
  return { basis, rows, notes, conflicts };
}

/** The 2–3 most useful points about a product, for the top of the page (from the nutrient classes, not the rating). */
export function keyPoints(classes: NutrientClass[]): { positives: NutrientClass[]; concerns: NutrientClass[] } {
  const order = ["protein_high", "fibre_high", "protein_source", "fibre_source", "sugar_free", "sugar_low", "sodium_very_low", "sodium_low", "sat_low", "fat_low", "kcal_low"];
  const positives = classes.filter((c) => c.tone === "positive").sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, 3);
  const concernOrder = ["sugar_high", "salt_high", "sat_high", "fat_high"];
  const concerns = classes.filter((c) => c.tone === "attention").sort((a, b) => concernOrder.indexOf(a.id) - concernOrder.indexOf(b.id)).slice(0, 3);
  return { positives, concerns };
}
