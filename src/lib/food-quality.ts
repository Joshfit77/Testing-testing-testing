/**
 * Food Quality Scanner: product facts from Open Food Facts (OFF) and the app's own, documented analysis of them.
 * Pure (no I/O), so it can be unit-tested and used on the server and the client.
 *
 * Principles:
 *   - Nothing is invented. A value OFF doesn't have is `null` and shown as "Not available", never as 0.
 *   - No proprietary 0–100 health score. Only recognised indicators (Nutri-Score and NOVA, as computed by OFF) and
 *     transparent comparisons with published thresholds:
 *       · UK front-of-pack "traffic light" levels (Department of Health / FSA guidance, 2016), per 100 g or 100 ml;
 *       · EU reference intakes for an average adult (Regulation (EU) No 1169/2011, Annex XIII);
 *       · EU nutrition-claim thresholds (Regulation (EC) No 1924/2006, Annex), e.g. "high fibre".
 *   - No food is called healthy or unhealthy for everyone, and no additive is said to cause harm.
 *   - Missing ingredient or allergen data is never treated as proof that a product is free of anything.
 *
 * OFF field names follow its API v2 product format. OFF data is crowd-sourced and unverified: always check the label.
 */

export const OFF_QUALITY_FIELDS = [
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
  "image_front_small_url",
  "image_front_url",
  "image_small_url",
  "image_url",
  "ingredients_text",
  "ingredients_text_en",
  "lang",
  "allergens_tags",
  "traces_tags",
  "additives_tags",
  "nutriscore_grade",
  "nutrition_grades",
  "nova_group",
  "categories",
  "categories_tags",
  "compared_to_category",
  "labels_tags",
  "ingredients_analysis_tags",
  "states_tags",
] as const;

export const OFF_DATA_NOTICE =
  "Product data and images: Open Food Facts, a free database built by volunteers (database under the Open Database License, images under CC BY-SA). Data may be incomplete or out of date: always check the package.";

export type Grade = "a" | "b" | "c" | "d" | "e";
export type Tri = "yes" | "no" | "maybe" | "unknown";

export interface Nutrients {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sat_fat_g: number | null;
  sugars_g: number | null;
  added_sugars_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  salt_g: number | null;
}
export const NUTRIENT_KEYS: (keyof Nutrients)[] = ["calories", "protein_g", "carbs_g", "fat_g", "sat_fat_g", "sugars_g", "added_sugars_g", "fiber_g", "sodium_mg", "salt_g"];

export interface QualityProduct {
  code: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
  /** "g" for foods, "ml" for drinks: what the per-100 values are measured in. */
  unit: "g" | "ml";
  servingLabel: string | null;
  servingQuantity: number | null;
  per100: Nutrients;
  perServing: Nutrients | null;
  nutriScore: { grade: Grade | null; status: "graded" | "unknown" | "not_applicable" };
  nova: 1 | 2 | 3 | 4 | null;
  /** Category tags, general to specific (e.g. "en:breakfast-cereals"). */
  categories: string[];
  /** The most specific category, used for comparisons. */
  category: string | null;
  labels: string[];
  allergens: string[];
  traces: string[];
  additives: string[];
  ingredientsText: string | null;
  /** The ingredient text isn't in English (shown as printed). */
  ingredientsLang: string | null;
  vegan: Tri;
  vegetarian: Tri;
  palmOil: Tri;
  /** What OFF itself marks as still to be completed. */
  incomplete: ("ingredients" | "nutrition" | "categories")[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function num(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}
function tags(v: unknown, max = 60): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((t): t is string => typeof t === "string" && /^[a-z]{2,3}:[\w\-'.]{1,80}$/.test(t)))].slice(0, max) : [];
}

/** Only OFF's own image hosts over https, so a bad record can't point the app at another site. */
export function safeImageUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && /(^|\.)openfoodfacts\.org$/.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

function readNutrients(n: Record<string, unknown>, basis: "100g" | "serving"): Nutrients {
  const cap = basis === "100g" ? 1 : 50;
  const kcal = num(n[`energy-kcal_${basis}`], 1000 * cap);
  const kj = num(n[`energy-kj_${basis}`], 4200 * cap) ?? num(n[`energy_${basis}`], 4200 * cap);
  const calories = kcal ?? (kj != null ? kj / 4.184 : null);
  const g = (key: string) => {
    const v = num(n[`${key}_${basis}`], 100 * cap);
    return v == null ? null : round1(v);
  };
  const salt = num(n[`salt_${basis}`], 100 * cap);
  const sodium = num(n[`sodium_${basis}`], 100 * cap) ?? (salt == null ? null : salt / 2.5);
  return {
    calories: calories == null ? null : Math.round(calories),
    protein_g: g("proteins"),
    carbs_g: g("carbohydrates"),
    fat_g: g("fat"),
    sat_fat_g: g("saturated-fat"),
    sugars_g: g("sugars"),
    added_sugars_g: g("added-sugars"),
    fiber_g: g("fiber"),
    sodium_mg: sodium == null ? null : Math.round(sodium * 1000),
    salt_g: salt != null ? round1(salt) : sodium != null ? round1(sodium * 2.5) : null,
  };
}

function scale(v: Nutrients, f: number): Nutrients {
  const out = {} as Nutrients;
  for (const k of NUTRIENT_KEYS) {
    const x = v[k];
    out[k] = x == null ? null : k === "calories" || k === "sodium_mg" ? Math.round(x * f) : round1(x * f);
  }
  return out;
}
const hasAny = (v: Nutrients) => NUTRIENT_KEYS.some((k) => v[k] != null);

function analysisTri(analysis: string[], key: "vegan" | "vegetarian"): Tri {
  if (analysis.includes(`en:${key}`)) return "yes";
  if (analysis.includes(`en:non-${key}`)) return "no";
  if (analysis.includes(`en:maybe-${key}`)) return "maybe";
  return "unknown";
}

export interface OffQualityResponse {
  status?: number;
  code?: string;
  product?: Record<string, unknown>;
}

/** Normalise an OFF v2 product response. Null when the product isn't in OFF. */
export function normalizeQualityProduct(json: OffQualityResponse | null | undefined, requestedCode: string): QualityProduct | null {
  const p = json?.product;
  if (!json || json.status !== 1 || !p) return null;
  const code = text(p.code ?? json.code, 20) ?? requestedCode;
  const brand = text(typeof p.brands === "string" ? p.brands.split(",")[0] : null, 120);
  const name = text(p.product_name, 160) ?? text(p.product_name_en, 160) ?? text(p.generic_name, 160) ?? (brand ? `${brand} product` : `Product ${code}`);
  const quantity = text(p.quantity, 60);
  const unit: "g" | "ml" = String(p.serving_quantity_unit ?? "").toLowerCase() === "ml" || /\b\d+(?:[.,]\d+)?\s*(ml|cl|l)\b/i.test(quantity ?? "") ? "ml" : "g";
  const nutriments = (p.nutriments && typeof p.nutriments === "object" ? p.nutriments : {}) as Record<string, unknown>;
  const servingQuantity = num(p.serving_quantity, 5000);
  const serving = servingQuantity && servingQuantity > 0 ? round1(servingQuantity) : null;

  let per100 = readNutrients(nutriments, "100g");
  const servingRaw = readNutrients(nutriments, "serving");
  let perServing: Nutrients | null = null;
  if (serving && hasAny(per100)) perServing = scale(per100, serving / 100);
  else if (hasAny(servingRaw)) {
    perServing = servingRaw;
    if (!hasAny(per100) && serving) per100 = scale(servingRaw, 100 / serving);
  }

  const gradeRaw = String(p.nutriscore_grade ?? p.nutrition_grades ?? "").toLowerCase();
  const nutriScore: QualityProduct["nutriScore"] = /^[a-e]$/.test(gradeRaw)
    ? { grade: gradeRaw as Grade, status: "graded" }
    : gradeRaw === "not-applicable"
      ? { grade: null, status: "not_applicable" }
      : { grade: null, status: "unknown" };
  const novaRaw = Number(p.nova_group);
  const nova = [1, 2, 3, 4].includes(novaRaw) ? (novaRaw as 1 | 2 | 3 | 4) : null;

  const categories = tags(p.categories_tags, 40);
  const compared = typeof p.compared_to_category === "string" && /^[a-z]{2}:[\w-]{1,80}$/.test(p.compared_to_category) ? p.compared_to_category : null;
  const analysis = tags(p.ingredients_analysis_tags);
  const states = tags(p.states_tags, 80);
  const textEn = text(p.ingredients_text_en, 4000);
  const textAny = text(p.ingredients_text, 4000);
  const lang = typeof p.lang === "string" && /^[a-z]{2}$/.test(p.lang) ? p.lang : null;

  return {
    code,
    name,
    brand,
    quantity,
    imageUrl: safeImageUrl(p.image_front_small_url) ?? safeImageUrl(p.image_front_url) ?? safeImageUrl(p.image_small_url) ?? safeImageUrl(p.image_url),
    unit,
    servingLabel: text(p.serving_size, 60),
    servingQuantity: serving,
    per100,
    perServing,
    nutriScore,
    nova,
    categories,
    category: compared ?? categories.at(-1) ?? null,
    labels: tags(p.labels_tags),
    allergens: tags(p.allergens_tags),
    traces: tags(p.traces_tags),
    additives: tags(p.additives_tags).map((t) => t.replace(/^en:/, "")).filter((t) => /^e\d{3,4}[a-z]?(i{1,3}|iv|v)?$/.test(t)),
    ingredientsText: textEn ?? textAny,
    ingredientsLang: textEn ? null : lang && lang !== "en" ? lang : null,
    vegan: analysisTri(analysis, "vegan"),
    vegetarian: analysisTri(analysis, "vegetarian"),
    palmOil: analysis.includes("en:palm-oil-free") ? "no" : analysis.includes("en:palm-oil") ? "yes" : analysis.includes("en:may-contain-palm-oil") ? "maybe" : "unknown",
    incomplete: [
      ...(states.includes("en:ingredients-to-be-completed") || !(textEn ?? textAny) ? (["ingredients"] as const) : []),
      ...(states.includes("en:nutrition-facts-to-be-completed") || !hasAny(per100) ? (["nutrition"] as const) : []),
      ...(states.includes("en:categories-to-be-completed") || categories.length === 0 ? (["categories"] as const) : []),
    ],
  };
}

/** "en:breakfast-cereals" → "Breakfast cereals". */
export function tagLabel(tag: string): string {
  const t = tag.replace(/^[a-z]{2,3}:/, "").replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------------------------------------------------------------------------------------------------------
// Indicators and their explanations
// ---------------------------------------------------------------------------------------------------------------

export const NUTRI_SCORE_INFO = {
  what: "Nutri-Score rates a food's overall nutritional profile from A (more favourable) to E (less favourable), compared with other foods. It weighs energy, sugars, saturated fat and salt against fibre, protein and fruit, vegetables and legumes, per 100 g or 100 ml.",
  limits:
    "It compares products within the same kind of food, not across a whole diet, and doesn't account for portion size, additives, processing or your own needs. The grade shown is computed by Open Food Facts from the data it holds, which may be incomplete, and can differ from a grade printed on the pack.",
};
export const NOVA_INFO = {
  groups: {
    1: "Unprocessed or minimally processed foods",
    2: "Processed culinary ingredients (such as oils, butter, sugar, salt)",
    3: "Processed foods",
    4: "Ultra-processed food and drink products",
  } as Record<1 | 2 | 3 | 4, string>,
  what: "NOVA groups foods by how much industrial processing they've been through, from 1 (unprocessed or minimally processed) to 4 (ultra-processed).",
  limits:
    "NOVA describes processing, not nutrient content: two products in the same group can be very different nutritionally. Open Food Facts estimates the group from the ingredient list, so a missing or incomplete list makes it unreliable.",
};
export const LEVELS_INFO = {
  what: "Fat, saturated fat, sugars and salt per 100 g (or 100 ml for drinks) compared with the UK's front-of-pack \"traffic light\" thresholds.",
  limits: "These are per 100 g, not per portion, and don't distinguish natural sugars (such as in milk or fruit) from added sugars. The UK scheme also marks some large portions as high; that rule isn't applied here.",
};

export type Level = "low" | "medium" | "high";
const FSA: Record<"fat_g" | "sat_fat_g" | "sugars_g" | "salt_g", { g: [number, number]; ml: [number, number]; label: string }> = {
  fat_g: { g: [3, 17.5], ml: [1.5, 8.75], label: "Fat" },
  sat_fat_g: { g: [1.5, 5], ml: [0.75, 2.5], label: "Saturated fat" },
  sugars_g: { g: [5, 22.5], ml: [2.5, 11.25], label: "Sugars" },
  salt_g: { g: [0.3, 1.5], ml: [0.3, 0.75], label: "Salt" },
};

/** UK front-of-pack levels per 100 g / 100 ml: low ≤ the first threshold, high above the second. */
export function nutrientLevels(per100: Nutrients, unit: "g" | "ml"): { key: keyof typeof FSA; label: string; value: number | null; level: Level | null; thresholds: [number, number] }[] {
  return (Object.keys(FSA) as (keyof typeof FSA)[]).map((key) => {
    const value = per100[key];
    const [low, high] = FSA[key][unit];
    return { key, label: FSA[key].label, value, level: value == null ? null : value <= low ? "low" : value > high ? "high" : "medium", thresholds: [low, high] };
  });
}

/** EU reference intakes for an average adult (8,400 kJ / 2,000 kcal). */
export const REFERENCE_INTAKES: Partial<Record<keyof Nutrients, number>> = { calories: 2000, fat_g: 70, sat_fat_g: 20, carbs_g: 260, sugars_g: 90, protein_g: 50, salt_g: 6 };

export function percentOfReference(key: keyof Nutrients, value: number | null): number | null {
  const ri = REFERENCE_INTAKES[key];
  return value == null || !ri ? null : Math.round((value / ri) * 100);
}

/** EU nutrition-claim thresholds the product's data meets (not claims the maker made). */
export function thresholdsMet(per100: Nutrients, unit: "g" | "ml"): string[] {
  const out: string[] = [];
  const { calories, protein_g, fiber_g, sugars_g, sat_fat_g, fat_g, sodium_mg } = per100;
  if (protein_g != null && calories != null && calories > 0) {
    const share = (protein_g * 4) / calories;
    if (share >= 0.2) out.push("High protein (at least 20% of energy from protein)");
    else if (share >= 0.12) out.push("Source of protein (at least 12% of energy from protein)");
  }
  if (fiber_g != null) {
    if (fiber_g >= 6) out.push("High fibre (at least 6 g per 100 g)");
    else if (fiber_g >= 3) out.push("Source of fibre (at least 3 g per 100 g)");
  }
  if (sugars_g != null && sugars_g <= (unit === "ml" ? 2.5 : 5)) out.push(`Low sugars (no more than ${unit === "ml" ? "2.5 g per 100 ml" : "5 g per 100 g"})`);
  if (fat_g != null && fat_g <= (unit === "ml" ? 1.5 : 3)) out.push(`Low fat (no more than ${unit === "ml" ? "1.5 g per 100 ml" : "3 g per 100 g"})`);
  if (sat_fat_g != null && calories != null && sat_fat_g <= (unit === "ml" ? 0.75 : 1.5) && (calories === 0 || (sat_fat_g * 9) / calories <= 0.1)) out.push("Low saturated fat");
  if (sodium_mg != null && sodium_mg <= 120) out.push("Low salt (no more than 0.3 g salt per 100 g or ml)");
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Ingredients, additives, allergens
// ---------------------------------------------------------------------------------------------------------------

const SUGAR_TERMS = [
  "high fructose corn syrup",
  "glucose-fructose syrup",
  "fructose-glucose syrup",
  "glucose syrup",
  "corn syrup",
  "rice syrup",
  "malt syrup",
  "maple syrup",
  "golden syrup",
  "date syrup",
  "agave syrup",
  "agave nectar",
  "invert sugar",
  "cane sugar",
  "brown sugar",
  "coconut sugar",
  "icing sugar",
  "evaporated cane juice",
  "fruit juice concentrate",
  "molasses",
  "treacle",
  "honey",
  "dextrose",
  "glucose",
  "fructose",
  "sucrose",
  "maltose",
  "sugar",
];

/** Forms of sugar named in an ingredient list ("no added sugar" and "sugar-free" phrases are ignored). */
export function addedSugarIngredients(ingredients: string | null): string[] {
  if (!ingredients) return [];
  let rest = ingredients.toLowerCase().replace(/no added sugars?|sugar[- ]free|without added sugars?|unsweetened/g, " ");
  const found: string[] = [];
  for (const term of SUGAR_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[-]/g, "[- ]")}s?\\b`, "g");
    if (re.test(rest)) {
      found.push(term);
      rest = rest.replace(re, " ");
    }
  }
  return found;
}

export interface AdditiveInfo {
  name: string;
  role: string;
  note?: string;
}

const COLOUR_WARNING = "In the EU, foods containing this colour must carry the warning \"may have an adverse effect on activity and attention in children\" (Regulation (EC) No 1333/2008).";
const POLYOL_NOTE = "In the EU, foods with more than 10% added polyols must state that excessive consumption may produce laxative effects.";

/** Common additives in plain language. Notes are regulatory facts, not judgements. */
export const ADDITIVES: Record<string, AdditiveInfo> = {
  e100: { name: "Curcumin", role: "Colour (yellow)" },
  e101: { name: "Riboflavin", role: "Colour (yellow)" },
  e102: { name: "Tartrazine", role: "Colour (yellow)", note: COLOUR_WARNING },
  e104: { name: "Quinoline yellow", role: "Colour (yellow)", note: COLOUR_WARNING },
  e110: { name: "Sunset yellow FCF", role: "Colour (orange)", note: COLOUR_WARNING },
  e120: { name: "Carmine (cochineal)", role: "Colour (red)", note: "Made from insects, so not vegetarian or vegan." },
  e122: { name: "Azorubine (carmoisine)", role: "Colour (red)", note: COLOUR_WARNING },
  e124: { name: "Ponceau 4R", role: "Colour (red)", note: COLOUR_WARNING },
  e129: { name: "Allura red AC", role: "Colour (red)", note: COLOUR_WARNING },
  e133: { name: "Brilliant blue FCF", role: "Colour (blue)" },
  e140: { name: "Chlorophylls", role: "Colour (green)" },
  e150a: { name: "Plain caramel", role: "Colour (brown)" },
  e150c: { name: "Ammonia caramel", role: "Colour (brown)" },
  e150d: { name: "Sulphite ammonia caramel", role: "Colour (brown)" },
  e160a: { name: "Carotenes", role: "Colour (orange)" },
  e160c: { name: "Paprika extract", role: "Colour (red/orange)" },
  e162: { name: "Beetroot red", role: "Colour (red)" },
  e170: { name: "Calcium carbonate", role: "Colour, acidity regulator or firming agent" },
  e171: { name: "Titanium dioxide", role: "Colour (white)", note: "No longer authorised as a food additive in the EU since 2022; still permitted in some other countries." },
  e200: { name: "Sorbic acid", role: "Preservative" },
  e202: { name: "Potassium sorbate", role: "Preservative" },
  e211: { name: "Sodium benzoate", role: "Preservative" },
  e220: { name: "Sulphur dioxide", role: "Preservative", note: "Sulphites are a declared allergen when above 10 mg per kg or litre." },
  e223: { name: "Sodium metabisulphite", role: "Preservative", note: "Sulphites are a declared allergen when above 10 mg per kg or litre." },
  e250: { name: "Sodium nitrite", role: "Preservative (cured meats)", note: "Keeps cured meats safe from bacterial growth. Authorities limit how much may be added." },
  e251: { name: "Sodium nitrate", role: "Preservative (cured meats)", note: "Authorities limit how much may be added." },
  e252: { name: "Potassium nitrate", role: "Preservative (cured meats)", note: "Authorities limit how much may be added." },
  e270: { name: "Lactic acid", role: "Acid / acidity regulator" },
  e282: { name: "Calcium propionate", role: "Preservative" },
  e290: { name: "Carbon dioxide", role: "Carbonation / packaging gas" },
  e296: { name: "Malic acid", role: "Acid / acidity regulator" },
  e300: { name: "Ascorbic acid (vitamin C)", role: "Antioxidant" },
  e301: { name: "Sodium ascorbate", role: "Antioxidant" },
  e306: { name: "Tocopherol-rich extract (vitamin E)", role: "Antioxidant" },
  e322: { name: "Lecithins", role: "Emulsifier", note: "Often made from soy or sunflower; soy lecithin is declared as soy." },
  e330: { name: "Citric acid", role: "Acid / acidity regulator" },
  e331: { name: "Sodium citrates", role: "Acidity regulator" },
  e332: { name: "Potassium citrates", role: "Acidity regulator" },
  e334: { name: "Tartaric acid", role: "Acid" },
  e338: { name: "Phosphoric acid", role: "Acid (common in colas)" },
  e339: { name: "Sodium phosphates", role: "Acidity regulator / emulsifying salt" },
  e340: { name: "Potassium phosphates", role: "Acidity regulator" },
  e341: { name: "Calcium phosphates", role: "Acidity regulator / anti-caking agent" },
  e401: { name: "Sodium alginate", role: "Thickener" },
  e407: { name: "Carrageenan", role: "Thickener / gelling agent" },
  e410: { name: "Locust bean gum", role: "Thickener" },
  e412: { name: "Guar gum", role: "Thickener" },
  e414: { name: "Gum arabic", role: "Thickener / stabiliser" },
  e415: { name: "Xanthan gum", role: "Thickener" },
  e420: { name: "Sorbitol", role: "Sweetener / humectant (polyol)", note: POLYOL_NOTE },
  e422: { name: "Glycerol", role: "Humectant" },
  e440: { name: "Pectins", role: "Gelling agent" },
  e450: { name: "Diphosphates", role: "Raising agent / acidity regulator" },
  e451: { name: "Triphosphates", role: "Stabiliser" },
  e460: { name: "Cellulose", role: "Bulking / anti-caking agent" },
  e466: { name: "Carboxymethyl cellulose", role: "Thickener" },
  e471: { name: "Mono- and diglycerides of fatty acids", role: "Emulsifier" },
  e472e: { name: "DATEM", role: "Emulsifier" },
  e476: { name: "Polyglycerol polyricinoleate", role: "Emulsifier (often in chocolate)" },
  e500: { name: "Sodium carbonates (baking soda)", role: "Raising agent" },
  e503: { name: "Ammonium carbonates", role: "Raising agent" },
  e509: { name: "Calcium chloride", role: "Firming agent" },
  e551: { name: "Silicon dioxide", role: "Anti-caking agent" },
  e621: { name: "Monosodium glutamate (MSG)", role: "Flavour enhancer" },
  e627: { name: "Disodium guanylate", role: "Flavour enhancer" },
  e631: { name: "Disodium inosinate", role: "Flavour enhancer" },
  e635: { name: "Disodium 5'-ribonucleotides", role: "Flavour enhancer" },
  e901: { name: "Beeswax", role: "Glazing agent", note: "Made by bees, so not vegan." },
  e903: { name: "Carnauba wax", role: "Glazing agent" },
  e950: { name: "Acesulfame K", role: "Sweetener" },
  e951: { name: "Aspartame", role: "Sweetener", note: "Contains a source of phenylalanine, which matters for people with phenylketonuria (PKU)." },
  e955: { name: "Sucralose", role: "Sweetener" },
  e960: { name: "Steviol glycosides (stevia)", role: "Sweetener" },
  e965: { name: "Maltitol", role: "Sweetener (polyol)", note: POLYOL_NOTE },
  e967: { name: "Xylitol", role: "Sweetener (polyol)", note: POLYOL_NOTE },
};

export const ADDITIVES_NOTE =
  "Food additives are approved by food-safety authorities (such as EFSA in the EU and the FDA in the US) for specific uses and maximum amounts. This list explains what each one does; it doesn't rate them.";

export function describeAdditive(code: string): AdditiveInfo & { code: string } {
  const c = code.toLowerCase();
  const info = ADDITIVES[c] ?? ADDITIVES[c.replace(/(i{1,3}|iv|v)$/, "")] ?? { name: "No description in the app yet", role: "Food additive" };
  return { code: c.toUpperCase(), ...info };
}

/** The 14 allergens EU law requires on labels (OFF tag → plain name). */
export const ALLERGENS: Record<string, string> = {
  "en:gluten": "Gluten (wheat, rye, barley, oats)",
  "en:crustaceans": "Crustaceans",
  "en:eggs": "Eggs",
  "en:fish": "Fish",
  "en:peanuts": "Peanuts",
  "en:soybeans": "Soy",
  "en:milk": "Milk",
  "en:nuts": "Tree nuts",
  "en:celery": "Celery",
  "en:mustard": "Mustard",
  "en:sesame-seeds": "Sesame",
  "en:sulphur-dioxide-and-sulphites": "Sulphites",
  "en:lupin": "Lupin",
  "en:molluscs": "Molluscs",
};
export type AllergenTag = keyof typeof ALLERGENS;
export function allergenLabel(tag: string): string {
  return ALLERGENS[tag] ?? tagLabel(tag);
}

// ---------------------------------------------------------------------------------------------------------------
// Member filters (Plus)
// ---------------------------------------------------------------------------------------------------------------

export const NUTRITION_FILTERS = ["low_sugar", "low_salt", "low_sat_fat", "high_protein", "high_fibre"] as const;
export type NutritionFilter = (typeof NUTRITION_FILTERS)[number];
export const NUTRITION_FILTER_LABELS: Record<NutritionFilter, string> = {
  low_sugar: "Low sugars",
  low_salt: "Low salt",
  low_sat_fat: "Low saturated fat",
  high_protein: "High protein",
  high_fibre: "High fibre",
};

export interface FoodFilters {
  allergens: string[];
  diet: "none" | "vegetarian" | "vegan";
  nutrition: NutritionFilter[];
}
export const EMPTY_FILTERS: FoodFilters = { allergens: [], diet: "none", nutrition: [] };

export function sanitizeFilters(raw: unknown): FoodFilters {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FoodFilters>;
  return {
    allergens: Array.isArray(r.allergens) ? [...new Set(r.allergens.filter((a): a is string => typeof a === "string" && a in ALLERGENS))] : [],
    diet: r.diet === "vegan" || r.diet === "vegetarian" ? r.diet : "none",
    nutrition: Array.isArray(r.nutrition) ? [...new Set(r.nutrition.filter((n): n is NutritionFilter => (NUTRITION_FILTERS as readonly string[]).includes(n as string)))] : [],
  };
}

export type FilterStatus = "conflict" | "caution" | "unknown" | "ok";
export interface FilterResult {
  status: FilterStatus;
  text: string;
}

/** Check a product against the member's filters. Missing data is "unknown", never "ok". */
export function checkFilters(p: QualityProduct, f: FoodFilters): FilterResult[] {
  const out: FilterResult[] = [];
  const noAllergenData = p.allergens.length === 0 && p.traces.length === 0 && !p.ingredientsText;
  for (const a of f.allergens) {
    const name = allergenLabel(a);
    if (p.allergens.includes(a)) out.push({ status: "conflict", text: `Contains ${name.toLowerCase()} (declared).` });
    else if (p.traces.includes(a)) out.push({ status: "caution", text: `May contain ${name.toLowerCase()} (traces declared).` });
    else if (noAllergenData) out.push({ status: "unknown", text: `No allergen or ingredient information, so it can't be checked for ${name.toLowerCase()}.` });
    else out.push({ status: "ok", text: `${name} isn't declared in the data. Check the label to be sure.` });
  }
  if (f.diet !== "none") {
    const s = f.diet === "vegan" ? p.vegan : p.vegetarian;
    const labelled = p.labels.includes(`en:${f.diet}`);
    const word = f.diet === "vegan" ? "vegan" : "vegetarian";
    if (labelled || s === "yes") out.push({ status: "ok", text: labelled ? `Labelled ${word}.` : `Looks ${word} from its ingredients (not certified).` });
    else if (s === "no") out.push({ status: "conflict", text: `Not ${word}, based on its ingredients.` });
    else out.push({ status: "unknown", text: s === "maybe" ? `Might not be ${word}: some ingredients are unclear.` : `Can't tell whether it's ${word}.` });
  }
  const v = p.per100;
  const solid = p.unit === "g";
  const rule: Record<NutritionFilter, () => FilterResult> = {
    low_sugar: () => (v.sugars_g == null ? unknown("sugars") : v.sugars_g <= (solid ? 5 : 2.5) ? ok(`Low in sugars (${v.sugars_g} g per 100 ${p.unit}).`) : bad(`Not low in sugars (${v.sugars_g} g per 100 ${p.unit}).`)),
    low_salt: () => (v.salt_g == null ? unknown("salt") : v.salt_g <= 0.3 ? ok(`Low in salt (${v.salt_g} g per 100 ${p.unit}).`) : bad(`Not low in salt (${v.salt_g} g per 100 ${p.unit}).`)),
    low_sat_fat: () => (v.sat_fat_g == null ? unknown("saturated fat") : v.sat_fat_g <= (solid ? 1.5 : 0.75) ? ok(`Low in saturated fat (${v.sat_fat_g} g per 100 ${p.unit}).`) : bad(`Not low in saturated fat (${v.sat_fat_g} g per 100 ${p.unit}).`)),
    high_protein: () => {
      if (v.protein_g == null || v.calories == null || v.calories === 0) return unknown("protein");
      const pct = Math.round(((v.protein_g * 4) / v.calories) * 100);
      return pct >= 20 ? ok(`High in protein (${pct}% of energy).`) : bad(`Not high in protein (${pct}% of energy).`);
    },
    high_fibre: () => (v.fiber_g == null ? unknown("fibre") : v.fiber_g >= 6 ? ok(`High in fibre (${v.fiber_g} g per 100 ${p.unit}).`) : bad(`Not high in fibre (${v.fiber_g} g per 100 ${p.unit}).`)),
  };
  for (const n of f.nutrition) out.push(rule[n]());
  return out;
}
const ok = (text: string): FilterResult => ({ status: "ok", text });
const bad = (text: string): FilterResult => ({ status: "conflict", text });
const unknown = (what: string): FilterResult => ({ status: "unknown", text: `No ${what} value, so this can't be checked.` });

// ---------------------------------------------------------------------------------------------------------------
// Comparisons and alternatives
// ---------------------------------------------------------------------------------------------------------------

/** Two products are comparable when both are foods or both drinks, and one's most specific category contains the other. */
export function comparable(a: QualityProduct, b: QualityProduct): { ok: boolean; reason: string } {
  if (a.unit !== b.unit) return { ok: false, reason: "One is a drink and the other a food, so per-100 values don't compare directly." };
  const shared = (a.category && b.categories.includes(a.category) ? a.category : null) ?? (b.category && a.categories.includes(b.category) ? b.category : null);
  if (shared) return { ok: true, reason: `Both are in "${tagLabel(shared)}".` };
  return { ok: false, reason: `These are different kinds of product (${a.category ? tagLabel(a.category) : "no category"} and ${b.category ? tagLabel(b.category) : "no category"}), so the comparison may not be meaningful.` };
}

export const COMPARE_ROWS: { key: keyof Nutrients; label: string; unit: string; better: "lower" | "higher" | null }[] = [
  { key: "calories", label: "Calories", unit: "kcal", better: null },
  { key: "protein_g", label: "Protein", unit: "g", better: "higher" },
  { key: "sugars_g", label: "Sugars", unit: "g", better: "lower" },
  { key: "fiber_g", label: "Fibre", unit: "g", better: "higher" },
  { key: "sodium_mg", label: "Sodium", unit: "mg", better: "lower" },
  { key: "sat_fat_g", label: "Saturated fat", unit: "g", better: "lower" },
  { key: "fat_g", label: "Fat", unit: "g", better: null },
  { key: "carbs_g", label: "Carbohydrates", unit: "g", better: null },
];

const GRADE_ORDER: Grade[] = ["a", "b", "c", "d", "e"];

/** Why `alt` might be a better choice than `base` within the same category; empty when it isn't clearly better. */
export function alternativeReasons(base: QualityProduct, alt: QualityProduct): string[] {
  const out: string[] = [];
  const bg = base.nutriScore.grade;
  const ag = alt.nutriScore.grade;
  if (bg && ag && GRADE_ORDER.indexOf(ag) < GRADE_ORDER.indexOf(bg)) out.push(`Nutri-Score ${ag.toUpperCase()} instead of ${bg.toUpperCase()}`);
  if (base.nova && alt.nova && alt.nova < base.nova) out.push(`Less processed (NOVA ${alt.nova} instead of ${base.nova})`);
  const u = base.unit;
  const less = (k: "sugars_g" | "sat_fat_g" | "salt_g", label: string, minDiff: number) => {
    const a = base.per100[k];
    const b = alt.per100[k];
    if (a != null && b != null && a - b >= minDiff && b <= a * 0.75) out.push(`Less ${label}: ${b} g vs ${a} g per 100 ${u}`);
  };
  less("sugars_g", "sugar", 2);
  less("sat_fat_g", "saturated fat", 1);
  less("salt_g", "salt", 0.2);
  const more = (k: "fiber_g" | "protein_g", label: string, minDiff: number) => {
    const a = base.per100[k];
    const b = alt.per100[k];
    if (a != null && b != null && b - a >= minDiff && b >= a * 1.25) out.push(`More ${label}: ${b} g vs ${a} g per 100 ${u}`);
  };
  more("fiber_g", "fibre", 1.5);
  more("protein_g", "protein", 3);
  // Only suggest it when it's better on an overall indicator, or on several nutrients without being worse overall.
  const worseGrade = bg && ag && GRADE_ORDER.indexOf(ag) > GRADE_ORDER.indexOf(bg);
  const worseNova = base.nova && alt.nova && alt.nova > base.nova;
  if (worseGrade || worseNova) return [];
  const overall = out.some((r) => r.startsWith("Nutri-Score") || r.startsWith("Less processed"));
  return overall || out.length >= 2 ? out : [];
}

export function pickAlternatives(base: QualityProduct, candidates: QualityProduct[], filters: FoodFilters | null, limit = 5): { product: QualityProduct; reasons: string[]; sameCategory: string }[] {
  const seen = new Set<string>([base.code]);
  const out: { product: QualityProduct; reasons: string[]; sameCategory: string }[] = [];
  for (const c of candidates) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    const cmp = comparable(base, c);
    if (!cmp.ok) continue;
    if (filters && checkFilters(c, { ...filters, nutrition: [] }).some((r) => r.status === "conflict")) continue;
    const reasons = alternativeReasons(base, c);
    if (reasons.length) out.push({ product: c, reasons, sameCategory: cmp.reason });
    if (out.length >= limit) break;
  }
  return out;
}
