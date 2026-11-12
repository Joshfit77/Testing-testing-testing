/**
 * Ingredient tags read from food names (USDA-style names such as "Cheese, cheddar, sharp" or the names
 * people type), for diet styles, allergy / dislike exclusions and the planner's rough budget tiers.
 *
 * This is keyword matching, not a certified allergen check: the planner says so in the UI, and people with
 * serious allergies are told to read labels.
 */

export const FOOD_TAGS = [
  "red_meat",
  "poultry",
  "fish",
  "shellfish",
  "egg",
  "dairy",
  "gluten",
  "grain",
  "bread",
  "legume",
  "peanut",
  "tree_nut",
  "soy",
  "sesame",
  "sweetener",
  "honey",
  "processed",
] as const;
export type FoodTag = (typeof FOOD_TAGS)[number];

/** Animal-food tags (anything else is treated as a plant food). */
export const ANIMAL_TAGS: FoodTag[] = ["red_meat", "poultry", "fish", "shellfish", "egg", "dairy"];

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** Singular form of a simple English plural ("berries" → "berry", "tomatoes" → "tomato", "eggs" → "egg"). */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(oes|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

const KEYWORDS: Record<FoodTag, string[]> = {
  red_meat: ["beef", "pork", "ham", "bacon", "lamb", "veal", "steak", "sirloin", "sausage", "venison", "bison", "brisket", "chorizo", "pepperoni", "salami", "hamburger"],
  poultry: ["chicken", "turkey", "duck", "broiler", "fryer", "hen"],
  fish: ["fish", "salmon", "tuna", "cod", "tilapia", "trout", "sardine", "halibut", "anchovy", "mackerel", "pollock", "catfish", "haddock", "bass"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "scallop", "crustacean", "crawfish"],
  egg: ["egg", "mayonnaise", "mayo"],
  dairy: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "whey", "kefir", "casein", "ghee", "buttermilk"],
  gluten: ["wheat", "bread", "pasta", "spaghetti", "macaroni", "noodle", "flour", "bagel", "couscous", "barley", "rye", "cracker", "pancake", "muffin", "biscuit", "seitan"],
  grain: ["wheat", "bread", "pasta", "spaghetti", "macaroni", "noodle", "flour", "bagel", "couscous", "barley", "rye", "rice", "oat", "oatmeal", "quinoa", "cereal", "granola", "corn", "tortilla", "cracker", "pancake", "muffin", "millet"],
  bread: ["bread", "bagel", "muffin", "biscuit", "bun", "roll", "pita", "pancake"],
  legume: ["bean", "lentil", "chickpea", "garbanzo", "pea", "hummus", "tofu", "soy", "soybean", "edamame", "peanut", "tempeh"],
  peanut: ["peanut"],
  tree_nut: ["almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia", "brazil", "nut"],
  soy: ["soy", "soybean", "soymilk", "tofu", "edamame", "tempeh", "miso"],
  sesame: ["sesame", "tahini", "hummus"],
  sweetener: ["sugar", "syrup", "jam", "jelly", "chocolate", "candy", "molasses"],
  honey: ["honey"],
  processed: ["bacon", "ham", "sausage", "salami", "pepperoni", "hot", "jerky", "deli", "luncheon", "bologna", "chorizo"],
};

/** Plant "milks" and "butters" that aren't dairy. */
const PLANT_PREFIX = new Set(["almond", "soy", "soymilk", "oat", "rice", "coconut", "cashew", "peanut", "nut", "seed", "apple", "cocoa", "shea", "sunflower"]);

/** Tags for one food name. */
export function tagsForFood(name: string): FoodTag[] {
  const ws = words(name).map(singular);
  const out = new Set<FoodTag>();
  ws.forEach((w, i) => {
    for (const tag of FOOD_TAGS) {
      if (!KEYWORDS[tag].includes(w)) continue;
      const prev = ws[i - 1];
      // "almond milk", "peanut butter", "cocoa butter" aren't dairy; "coconut cream" isn't either.
      if (tag === "dairy" && (w === "milk" || w === "butter" || w === "cream") && prev && PLANT_PREFIX.has(prev)) continue;
      if (tag === "dairy" && w === "butter" && ws.includes("peanut")) continue;
      // "hot" is only processed in "hot dog".
      if (tag === "processed" && w === "hot" && ws[i + 1] !== "dog") continue;
      // "nut" alone: "peanut" is a separate word, so a bare "nut" is a tree nut; "nutmeg"/"coconut" never tokenize to "nut".
      if (tag === "legume" && w === "pea" && ws[i + 1] === "nut") continue;
      // "Corn tortilla" is gluten-free: only flour tortillas and wheat foods are gluten.
      out.add(tag);
    }
  });
  if (ws.includes("tortilla") && ws.includes("flour")) out.add("gluten");
  // Peanuts are legumes, not tree nuts.
  if (out.has("peanut")) out.add("legume");
  return FOOD_TAGS.filter((t) => out.has(t));
}

/** Tags for a whole dish: the union over its ingredient names (and its own name). */
export function tagsForDish(names: string[]): FoodTag[] {
  const all = new Set<FoodTag>();
  for (const n of names) for (const t of tagsForFood(n)) all.add(t);
  return FOOD_TAGS.filter((t) => all.has(t));
}

/** Allergy words people type, mapped to tags ("lactose" → dairy, "nuts" → tree nuts and peanuts…). */
const TERM_TAGS: Record<string, FoodTag[]> = {
  dairy: ["dairy"],
  milk: ["dairy"],
  lactose: ["dairy"],
  cheese: ["dairy"],
  egg: ["egg"],
  gluten: ["gluten"],
  wheat: ["gluten"],
  celiac: ["gluten"],
  peanut: ["peanut"],
  nut: ["tree_nut", "peanut"],
  "tree nut": ["tree_nut"],
  shellfish: ["shellfish"],
  seafood: ["fish", "shellfish"],
  fish: ["fish"],
  soy: ["soy"],
  sesame: ["sesame"],
  pork: ["red_meat"],
  "red meat": ["red_meat"],
  meat: ["red_meat", "poultry"],
  poultry: ["poultry"],
};

/** Normalizes a typed allergy or dislike ("Tree nuts " → "tree nut"). */
export function normalizeTerm(term: string): string {
  return words(term).map(singular).join(" ");
}

/**
 * Does a dish hit an exclusion term? Known allergen words match by tag (so "dairy" excludes cheese and
 * yogurt); anything else matches a word in the dish or ingredient names ("mushroom" matches "Mushrooms, raw").
 */
export function matchesExclusion(dish: { name: string; ingredientNames: string[]; tags: FoodTag[] }, term: string): boolean {
  const t = normalizeTerm(term);
  if (!t) return false;
  const tags = TERM_TAGS[t];
  if (tags && tags.some((x) => dish.tags.includes(x))) return true;
  const termWords = t.split(" ");
  return [dish.name, ...dish.ingredientNames].some((n) => {
    const ws = words(n).map(singular);
    // Every word of the term must appear in order as consecutive words.
    for (let i = 0; i + termWords.length <= ws.length; i++) if (termWords.every((tw, j) => ws[i + j] === tw)) return true;
    return false;
  });
}

/**
 * Rough budget tier from ingredient types (not prices): fish, seafood, steak and nuts are "high"; other
 * meat, poultry and cheese are "medium"; beans, grains, eggs, milk, produce and oils are "low".
 */
export type CostTier = "low" | "medium" | "high";

export function costTierForFood(name: string): CostTier {
  const ws = words(name).map(singular);
  const tags = tagsForFood(name);
  if (tags.includes("fish") && !ws.includes("tuna")) return "high";
  if (tags.includes("shellfish") || ws.includes("steak") || ws.includes("sirloin") || tags.includes("tree_nut")) return "high";
  if (tags.includes("red_meat") || tags.includes("poultry") || ws.includes("cheese") || ws.includes("avocado") || ws.includes("yogurt") || ws.includes("tuna"))
    return "medium";
  return "low";
}

const TIER_RANK: Record<CostTier, number> = { low: 0, medium: 1, high: 2 };

export function costTierForDish(names: string[]): CostTier {
  let tier: CostTier = "low";
  for (const n of names) {
    const t = costTierForFood(n);
    if (TIER_RANK[t] > TIER_RANK[tier]) tier = t;
  }
  return tier;
}

export function tierFits(tier: CostTier, budget: "low" | "medium" | "any"): boolean {
  return budget === "any" || TIER_RANK[tier] <= TIER_RANK[budget];
}
