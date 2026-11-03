/**
 * Checking an ingredient label the member typed, pasted or photographed (and corrected). Everything here is
 * deterministic and runs on the text the member confirmed: no AI judges ingredients. It reuses the app's own additive
 * list, evidence table, sugar and sodium terms (src/lib/food-quality.ts, src/lib/additive-evidence.ts).
 *
 * Limits, said on screen: matching is by English words and E/INS numbers; a missed word, a misspelling or another
 * language can hide an ingredient or allergen, so nothing found is never proof of absence.
 */
import { ingredientAlerts, type IngredientAlert } from "./additive-evidence";
import { ADDITIVES, ALLERGENS, type Nutrients, type QualityProduct } from "./food-quality";

export const LABEL_TEXT_MAX = 3000;

/** Spellings normalised before matching (US to UK, as the additive list is written). */
function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/sulf/g, "sulph").replace(/colors?\b/g, (m) => m.replace("color", "colour")).replace(/flavor/g, "flavour").replace(/[‐-―]/g, "-").replace(/\s+/g, " ")} `;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Label wordings for additives that aren't the app's own names (US colour names, common synonyms). */
const SYNONYMS: Record<string, string> = {
  "soy lecithin": "e322",
  "soya lecithin": "e322",
  "sunflower lecithin": "e322",
  lecithin: "e322",
  msg: "e621",
  "acesulfame potassium": "e950",
  "acesulfame-k": "e950",
  stevia: "e960",
  "sodium bicarbonate": "e500",
  "bicarbonate of soda": "e500",
  "baking soda": "e500",
  "sodium hydrogen carbonate": "e500",
  "red 40": "e129",
  "red no. 40": "e129",
  "yellow 5": "e102",
  "yellow no. 5": "e102",
  "yellow 6": "e110",
  "yellow no. 6": "e110",
  "blue 1": "e133",
  "blue no. 1": "e133",
  "red 3": "e127",
  "red no. 3": "e127",
  bha: "e320",
  cochineal: "e120",
  "cellulose gum": "e466",
  carboxymethylcellulose: "e466",
  "mono and diglycerides": "e471",
  "mono- and diglycerides": "e471",
  "acacia gum": "e414",
  "gum acacia": "e414",
  "disodium phosphate": "e339",
  "sodium phosphate": "e339",
  "sodium tripolyphosphate": "e451",
  "sodium hexametaphosphate": "e452",
  "steviol glycoside": "e960",
};

/** Every name the app knows for an additive, longest first (so "sodium benzoate" wins over shorter names). */
const NAMES: [string, string][] = (() => {
  const out = new Map<string, string>();
  for (const [code, info] of Object.entries(ADDITIVES)) {
    const base = info.name.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
    if (base.length >= 3) out.set(base, code);
    // "Lecithins", "Sodium citrates": also match the singular printed on most labels.
    if (/s$/.test(base) && base.length > 4) out.set(base.replace(/s$/, ""), code);
  }
  for (const [name, code] of Object.entries(SYNONYMS)) out.set(name, code);
  return [...out.entries()].sort((a, b) => b[0].length - a[0].length);
})();

const CLASS_WORDS = "emulsifiers?|preservatives?|colou?rs?|antioxidants?|stabili[sz]ers?|thickeners?|acidity regulators?|acids?|flavour enhancers?|sweeteners?|raising agents?|gelling agents?|firming agents?|anti-?caking agents?|humectants?|glazing agents?";

/** Additive codes (e.g. "e330") named in an ingredient list: E-numbers, INS numbers after a function word, and names. */
export function additivesInText(text: string): string[] {
  let t = normalise(text);
  const found = new Set<string>();
  const add = (num: string, letter = "") => {
    const n = Number(num);
    if (n >= 100 && n <= 1599) found.add(`e${n}${letter.toLowerCase()}`);
  };
  // "E 330", "E-330", "E150d", "E160a(ii)".
  t = t.replace(/\be[\s-]?(\d{3,4})([a-f])?(?:\s?\((?:i{1,3}|iv|v)\))?(?![\d])/g, (_, num: string, letter?: string) => {
    add(num, letter ?? "");
    return " ";
  });
  // "Emulsifier (322, 471)", "Colour (150d)": the numbering used in Australia, New Zealand and elsewhere.
  t = t.replace(new RegExp(`\\b(?:${CLASS_WORDS})\\s*[:(]\\s*((?:\\d{3,4}[a-f]?(?:\\s*\\((?:i{1,3}|iv|v)\\))?\\s*[,&]?\\s*(?:and\\s*)?)+)\\)?`, "g"), (whole, nums: string) => {
    for (const m of nums.matchAll(/(\d{3,4})([a-f])?/g)) add(m[1]!, m[2] ?? "");
    return " ";
  });
  for (const [name, code] of NAMES) {
    const re = new RegExp(`(?<![a-z])${escape(name)}(?![a-z])`, "g");
    if (re.test(t)) {
      found.add(code);
      t = t.replace(re, " ");
    }
  }
  return [...found].sort();
}

/** Allergen words (English) for the 14 allergens EU law requires on labels. */
const ALLERGEN_WORDS: [string, RegExp][] = [
  ["en:gluten", /\b(wheat|rye|barley|oats?|spelt|kamut|triticale|gluten|semolina|durum|bulgur|couscous|farro|malt)\b/],
  ["en:crustaceans", /\b(crustaceans?|shrimps?|prawns?|crabs?|lobsters?|crayfish|langoustines?|krill)\b/],
  ["en:eggs", /\b(eggs?|egg yolks?|albumen|ovalbumin|mayonnaise)\b/],
  ["en:fish", /\b(fish|anchov(?:y|ies)|tuna|salmon|cod|haddock|sardines?|mackerel|pollock|trout|tilapia|herring)\b/],
  ["en:peanuts", /\b(peanuts?|groundnuts?|arachis)\b/],
  ["en:soybeans", /\b(soy|soya|soybeans?|edamame|tofu|miso|tempeh)\b/],
  ["en:milk", /\b(milk|cream|butter|buttermilk|cheese|whey|caseins?|caseinates?|lactose|yog(?:h)?urts?|ghee|curds?|lactalbumin|lactoglobulin|skimmed milk powder)\b/],
  ["en:nuts", /\b(almonds?|hazelnuts?|walnuts?|cashews?|pecans?|brazil nuts?|pistachios?|macadamias?|tree nuts?|nuts)\b/],
  ["en:celery", /\b(celery|celeriac)\b/],
  ["en:mustard", /\bmustard\b/],
  ["en:sesame-seeds", /\b(sesame|tahini)\b/],
  ["en:sulphur-dioxide-and-sulphites", /\b(sulphites?|sulphur dioxide|metabisulphites?|bisulphites?|e22[0-8])\b/],
  ["en:lupin", /\blupine?\b/],
  ["en:molluscs", /\b(molluscs?|mussels?|oysters?|clams?|scallops?|squid|octopus|snails?|whelks?|cuttlefish)\b/],
];
/** Words that look like an allergen but aren't one (cocoa butter isn't milk; coconut and nutmeg aren't tree nuts). */
const NOT_ALLERGEN = /\b(cocoa butter|shea butter|peanut butter|nut butter|almond butter|cashew butter|coconut (?:milk|cream)|(?:almond|oat|soy|soya|rice|coconut|cashew|hazelnut) (?:milk|drink)|cream of tartar|butterbeans?|butter beans?)\b/g;
/** Wording that says an allergen is absent ("gluten-free", "free from milk", "no nuts"). */
const ABSENT = /\b[a-z]+[- ]free\b|\b(?:free from|no|without|does not contain|doesn't contain) [a-z ,]+?(?=[.;\n]|$)/g;
/** Where a "may contain" statement starts; it runs to the end of that sentence. */
const MAY_CONTAIN = /(may (?:also )?contain|traces? of|made in a (?:factory|facility|kitchen)[^.;\n]*|produced (?:in|on)[^.;\n]*(?:also|that)[^.;\n]*|manufactured (?:in|on)[^.;\n]*(?:also|that|shared)[^.;\n]*|not suitable for)/;

function allergensIn(text: string): string[] {
  const t = text.replace(NOT_ALLERGEN, " ").replace(ABSENT, " ");
  return ALLERGEN_WORDS.filter(([, re]) => re.test(t)).map(([tag]) => tag);
}

/**
 * The allergens named in the ingredients and the allergen statement, split into "contains" and "may contain".
 * Peanut butter counts as peanut (but not milk); "gluten-free" or "free from milk" doesn't count.
 */
export function allergensInLabel(ingredients: string, statement = ""): { contains: string[]; mayContain: string[] } {
  const sentences = normalise(`${ingredients}. ${statement}`)
    .split(/[.;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const contains = new Set<string>();
  const may = new Set<string>();
  for (const s of sentences) {
    const i = s.search(MAY_CONTAIN);
    for (const a of allergensIn(i >= 0 ? s.slice(0, i) : s)) contains.add(a);
    if (i >= 0) for (const a of allergensIn(s.slice(i))) may.add(a);
  }
  // Peanut butter is peanut even though it isn't milk.
  if (/\bpeanut butter\b/.test(normalise(ingredients))) contains.add("en:peanuts");
  const order = Object.keys(ALLERGENS);
  const sort = (s: Set<string>) => [...s].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { contains: sort(contains), mayContain: sort(may).filter((a) => !contains.has(a)) };
}

const ENGLISH_HINTS = /\b(water|sugar|salt|flour|oil|milk|and|wheat|starch|syrup|acid|extract|natural|flavourings?|vegetable|powder|contains?|ingredients)\b/;
/** A rough check that the text is English, which the word matching needs. */
export const looksEnglish = (text: string) => text.trim().length < 20 || ENGLISH_HINTS.test(normalise(text));

export interface LabelNutrition {
  /** What the values are for. */
  basis: "100g" | "100ml" | "serving";
  /** Weight of one serving in g (ml), when printed. */
  servingGrams: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  sugars_g: number | null;
  fat_g: number | null;
  sat_fat_g: number | null;
  fiber_g: number | null;
  salt_g: number | null;
}

export interface LabelAnalysis {
  additives: string[];
  alerts: IngredientAlert[];
  allergens: { contains: string[]; mayContain: string[] };
  likelyEnglish: boolean;
}

/** Per-100 nutrients from label values, when they can be worked out (per serving needs the serving weight). */
export function per100FromLabel(n: LabelNutrition | null): Nutrients {
  const blank: Nutrients = { calories: null, protein_g: null, carbs_g: null, fat_g: null, sat_fat_g: null, sugars_g: null, added_sugars_g: null, fiber_g: null, sodium_mg: null, salt_g: null };
  if (!n) return blank;
  const f = n.basis === "serving" ? (n.servingGrams ? 100 / n.servingGrams : null) : 1;
  if (f == null) return blank;
  const v = (x: number | null) => (x == null ? null : Math.round(x * f * 10) / 10);
  const salt = v(n.salt_g);
  return { ...blank, calories: v(n.calories), protein_g: v(n.protein_g), carbs_g: v(n.carbs_g), fat_g: v(n.fat_g), sat_fat_g: v(n.sat_fat_g), sugars_g: v(n.sugars_g), fiber_g: v(n.fiber_g), salt_g: salt, sodium_mg: salt == null ? null : Math.round(salt * 400) };
}

/**
 * Check a label: additives (with the app's reviewed evidence), forms of sugar and sodium sources (with the label's
 * own amounts when given), and allergens named in the text.
 */
export function analyzeLabel(input: { ingredients: string; allergenStatement?: string; nutrition?: LabelNutrition | null }): LabelAnalysis {
  const ingredients = input.ingredients.slice(0, LABEL_TEXT_MAX);
  const additives = additivesInText(ingredients);
  const unit = input.nutrition?.basis === "100ml" ? "ml" : "g";
  const product: QualityProduct = {
    code: "label",
    name: "Label",
    brand: null,
    quantity: null,
    imageUrl: null,
    unit,
    servingLabel: null,
    servingQuantity: input.nutrition?.servingGrams ?? null,
    per100: per100FromLabel(input.nutrition ?? null),
    perServing: null,
    nutriScore: { grade: null, status: "unknown" },
    nova: null,
    categories: [],
    category: null,
    labels: [],
    allergens: [],
    traces: [],
    additives,
    ingredientsText: ingredients || null,
    ingredientsLang: null,
    vegan: "unknown",
    vegetarian: "unknown",
    palmOil: "unknown",
    incomplete: [],
    fvlPercent: null,
  };
  return {
    additives,
    alerts: ingredientAlerts(product),
    allergens: allergensInLabel(ingredients, input.allergenStatement ?? ""),
    likelyEnglish: looksEnglish(ingredients),
  };
}
