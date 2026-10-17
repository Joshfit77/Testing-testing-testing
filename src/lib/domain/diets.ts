import type { CommonFood } from "@/data/foods";

/**
 * Diet styles a user can follow. Each sets a macro split for the calorie estimate, plain-language
 * guidance, and a rule for which built-in foods fit. This is general education, not medical or
 * dietetic advice — several styles carry a caution shown in the UI.
 */
export const DIET_TYPES = [
  "balanced",
  "high_protein",
  "low_carb",
  "keto",
  "mediterranean",
  "paleo",
  "vegetarian",
  "vegan",
  "pescatarian",
  "intermittent_fasting",
  "carnivore",
  "daniel_fast",
  "dash",
] as const;
export type DietType = (typeof DIET_TYPES)[number];

export interface DietInfo {
  id: DietType;
  name: string;
  tagline: string;
  description: string;
  eat: string[];
  limit: string[];
  sampleDay: string[];
  caution?: string;
  /** Eating window for time-restricted styles. */
  eatingWindow?: string;
}

export const DIETS: Record<DietType, DietInfo> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    tagline: "A bit of everything, built around whole foods.",
    description: "Protein at every meal, plenty of fruit and vegetables, whole grains and healthy fats. The easiest style to keep up long term.",
    eat: ["Lean protein at each meal", "Fruit and vegetables at most meals", "Whole grains, potatoes and beans", "Nuts, olive oil and avocado"],
    limit: ["Sugary drinks", "Fried and highly processed foods"],
    sampleDay: ["Oats with berries and Greek yogurt", "Chicken, rice and vegetables", "Apple and peanut butter", "Salmon, potatoes and salad"],
  },
  high_protein: {
    id: "high_protein",
    name: "High protein",
    tagline: "Extra protein to build muscle and stay full.",
    description: "Around 2.2 g of protein per kg of bodyweight, spread over 3–5 meals. Popular for building muscle or keeping it while losing fat.",
    eat: ["Chicken, turkey, lean beef, fish and eggs", "Greek yogurt and cottage cheese", "Protein shakes when meals fall short", "Vegetables and whole grains around training"],
    limit: ["Meals with little or no protein", "Calorie-dense snacks that crowd out protein"],
    sampleDay: ["Egg-white omelet and toast", "Turkey sandwich and Greek yogurt", "Protein shake and banana", "Lean steak, rice and broccoli"],
  },
  low_carb: {
    id: "low_carb",
    name: "Low carb",
    tagline: "Fewer starches and sugars, more protein and fat.",
    description: "Roughly 75–125 g of carbs a day, mostly from vegetables, fruit and some whole grains timed around training.",
    eat: ["Meat, fish, eggs and dairy", "Non-starchy vegetables", "Berries", "Nuts, seeds, olive oil and avocado"],
    limit: ["Bread, pasta and rice in large portions", "Sugary drinks and sweets"],
    sampleDay: ["Eggs, spinach and avocado", "Grilled chicken salad", "Greek yogurt with berries", "Salmon with green beans"],
  },
  keto: {
    id: "keto",
    name: "Keto",
    tagline: "Very low carb, high fat.",
    description: "About 20–30 g of carbs a day so the body runs mainly on fat. It can make hard, high-intensity training feel tougher at first.",
    eat: ["Meat, fish and eggs", "Cheese, butter and olive oil", "Leafy greens and other low-carb vegetables", "Nuts and avocado"],
    limit: ["Grains, bread and pasta", "Fruit (except small portions of berries)", "Sugar, juice and soda", "Beans and potatoes"],
    sampleDay: ["Eggs and bacon with spinach", "Tuna salad with olive oil", "Cheese and almonds", "Steak with broccoli and butter"],
    caution: "Talk to your doctor first if you have diabetes, kidney disease, take blood-pressure or blood-sugar medication, or are pregnant or breastfeeding.",
  },
  mediterranean: {
    id: "mediterranean",
    name: "Mediterranean",
    tagline: "Olive oil, fish, vegetables and whole grains.",
    description: "Based on the traditional eating of Mediterranean countries. One of the most studied styles for heart health.",
    eat: ["Vegetables, fruit, beans and whole grains", "Fish and seafood twice a week or more", "Olive oil, nuts and seeds", "Yogurt and cheese in moderation"],
    limit: ["Red and processed meat", "Sweets and sugary drinks", "Refined grains"],
    sampleDay: ["Greek yogurt, berries and walnuts", "Chickpea and quinoa salad with olive oil", "Hummus and carrots", "Salmon, vegetables and brown rice"],
  },
  paleo: {
    id: "paleo",
    name: "Paleo",
    tagline: "Meat, fish, vegetables, fruit and nuts.",
    description: "Built on foods that don't need much processing. No grains, dairy, beans or added sugar.",
    eat: ["Meat, fish and eggs", "Vegetables and fruit", "Sweet potatoes", "Nuts, seeds, olive oil and avocado"],
    limit: ["Grains and bread", "Dairy", "Beans and peanuts", "Added sugar and processed foods"],
    sampleDay: ["Eggs, sweet potato and peppers", "Chicken salad with avocado", "Apple and almonds", "Steak with roasted vegetables"],
  },
  vegetarian: {
    id: "vegetarian",
    name: "Vegetarian",
    tagline: "No meat or fish. Eggs and dairy are in.",
    description: "Protein comes from eggs, dairy, beans, lentils, tofu and protein powder. Plan protein at every meal.",
    eat: ["Eggs, Greek yogurt and cottage cheese", "Beans, lentils, chickpeas and tofu", "Whole grains, fruit and vegetables", "Nuts and seeds"],
    limit: ["Meat, poultry and fish"],
    sampleDay: ["Eggs and whole-wheat toast", "Lentil and rice bowl", "Cottage cheese and fruit", "Tofu stir-fry with vegetables"],
  },
  vegan: {
    id: "vegan",
    name: "Vegan",
    tagline: "Fully plant-based.",
    description: "No animal products. Combine beans, lentils, tofu, grains and nuts to reach your protein, and consider a vitamin B12 supplement.",
    eat: ["Tofu, beans, lentils and chickpeas", "Whole grains, fruit and vegetables", "Nuts, seeds and nut butters", "Plant protein powder"],
    limit: ["Meat, fish, eggs, dairy and honey"],
    sampleDay: ["Oats with almond milk, banana and peanut butter", "Black bean and rice bowl", "Hummus and vegetables", "Tofu, quinoa and broccoli"],
    caution: "A vitamin B12 supplement is recommended on a fully vegan diet. Ask a doctor or dietitian about iron, vitamin D and omega-3s.",
  },
  pescatarian: {
    id: "pescatarian",
    name: "Pescatarian",
    tagline: "Vegetarian plus fish and seafood.",
    description: "No meat or poultry, but fish, seafood, eggs and dairy are all in.",
    eat: ["Fish and seafood", "Eggs and dairy", "Beans, lentils and tofu", "Whole grains, fruit and vegetables"],
    limit: ["Meat and poultry"],
    sampleDay: ["Greek yogurt and granola", "Tuna sandwich and fruit", "Cottage cheese", "Shrimp, rice and vegetables"],
  },
  intermittent_fasting: {
    id: "intermittent_fasting",
    name: "Intermittent fasting (16:8)",
    tagline: "Eat within an 8-hour window.",
    description: "Same healthy foods, fewer hours of eating — for example noon to 8 pm. It helps some people eat less without counting every bite.",
    eat: ["2–3 protein-rich meals inside your window", "Water, black coffee and plain tea while fasting", "Your biggest meal around training if you can"],
    limit: ["Overeating when the window opens", "Hard training sessions while very hungry, if they feel bad"],
    sampleDay: ["12:00 — Chicken, rice and vegetables", "3:30 — Greek yogurt and fruit", "7:30 — Salmon, potatoes and salad"],
    eatingWindow: "16 hours fasting, 8 hours eating (e.g. 12 pm–8 pm)",
    caution: "Not recommended if you're pregnant or breastfeeding, have a history of disordered eating, or take insulin or other blood-sugar medication.",
  },
  carnivore: {
    id: "carnivore",
    name: "Carnivore",
    tagline: "Animal foods only.",
    description: "Meat, fish, eggs and some dairy, with almost no plant foods. Very restrictive and with little long-term research — try it with care.",
    eat: ["Beef, pork, poultry and lamb", "Fish and seafood", "Eggs", "Butter and hard cheese"],
    limit: ["All plant foods: grains, fruit, vegetables, beans, nuts", "Sugar and processed foods"],
    sampleDay: ["Eggs and bacon", "Ground beef patties", "Salmon", "Ribeye steak"],
    caution: "Very restrictive with little long-term research. Check with your doctor first, especially if you have heart, kidney or cholesterol concerns.",
  },
  daniel_fast: {
    id: "daniel_fast",
    name: "Daniel Fast",
    tagline: "A plant-based fast of prayer, often 21 days.",
    description:
      "Based on Daniel 1:12 and 10:2–3: vegetables, fruit, whole grains, beans and water — no meat, dairy, sugar, leavened bread or processed food. Usually kept for a set season of prayer.",
    eat: ["Fruit and vegetables", "Whole grains like brown rice, oats and quinoa", "Beans, lentils and nuts", "Water"],
    limit: ["Meat, fish, eggs and dairy", "Sugar, honey and sweets", "White flour, leavened bread and processed food", "Coffee, soda and juice"],
    sampleDay: ["Oats with banana and almonds", "Lentil soup with brown rice", "Apple and walnuts", "Black beans, quinoa and roasted vegetables"],
    caution: "Protein is harder to reach on this fast; reduce heavy training volume during it. Talk to your doctor first if you have a medical condition.",
  },
  dash: {
    id: "dash",
    name: "DASH (heart-healthy)",
    tagline: "Lower salt, more produce — built for blood pressure.",
    description: "Developed to help lower blood pressure: lots of fruit, vegetables, whole grains and low-fat dairy, and less salt and red meat.",
    eat: ["Fruit and vegetables at every meal", "Whole grains", "Low-fat dairy", "Fish, poultry, beans and nuts"],
    limit: ["Salty and processed foods", "Red and processed meat", "Sugary drinks and sweets"],
    sampleDay: ["Oats, banana and skim milk", "Turkey and vegetable whole-wheat wrap", "Yogurt and fruit", "Chicken, brown rice and green beans"],
  },
};

// --------------------------------------------------------------------------- Food compatibility

const MEAT = new Set([
  "chicken-breast-cooked", "chicken-thigh-cooked", "ground-beef-90-cooked", "ground-beef-80-cooked", "ground-turkey-93-cooked",
  "sirloin-steak-cooked", "pork-tenderloin-cooked", "bacon-cooked", "turkey-deli", "beef-jerky", "cheeseburger",
  "burrito-bowl-chicken", "grilled-chicken-salad", "turkey-sandwich", "spaghetti-meat-sauce", "chicken-stir-fry",
]);
const FISH = new Set(["salmon-cooked", "tilapia-cooked", "shrimp-cooked", "tuna-canned-water"]);
const EGG = new Set(["egg-large", "egg-white", "pancakes"]);
const DAIRY = new Set([
  "greek-yogurt-nonfat", "greek-yogurt-whole", "cottage-cheese-2", "milk-whole", "milk-2", "milk-skim", "cheddar-cheese",
  "mozzarella-part-skim", "string-cheese", "whey-protein", "butter", "chocolate-milk", "cheese-pizza-slice", "cheeseburger", "pancakes",
]);
const GRAIN = new Set([
  "white-rice-cooked", "brown-rice-cooked", "oats-dry", "pasta-cooked", "quinoa-cooked", "bread-whole-wheat", "bread-white", "bagel-plain",
  "tortilla-flour", "tortilla-corn", "english-muffin", "cereal-cheerios", "granola", "pancakes", "popcorn-air", "rice-cake", "corn",
  "cheese-pizza-slice", "cheeseburger", "burrito-bowl-chicken", "turkey-sandwich", "spaghetti-meat-sauce", "chicken-stir-fry",
]);
const REFINED_GRAIN = new Set(["white-rice-cooked", "pasta-cooked", "bread-white", "bagel-plain", "tortilla-flour", "cereal-cheerios", "pancakes", "rice-cake", "cheese-pizza-slice", "cheeseburger", "spaghetti-meat-sauce", "chicken-stir-fry"]);
const LEGUME = new Set(["black-beans", "lentils-cooked", "chickpeas-cooked", "hummus", "peanut-butter", "tofu-firm", "burrito-bowl-chicken"]);
const PROCESSED = new Set([
  "bacon-cooked", "turkey-deli", "beef-jerky", "potato-chips", "soda-cola", "sports-drink", "protein-bar", "granola", "cereal-cheerios",
  "cheese-pizza-slice", "cheeseburger", "chocolate-milk", "whey-protein", "mayonnaise", "dark-chocolate", "trail-mix",
]);
const SUGARY = new Set(["soda-cola", "sports-drink", "honey", "chocolate-milk", "dark-chocolate", "granola", "orange-juice", "raisins"]);
const SALTY = new Set(["bacon-cooked", "turkey-deli", "beef-jerky", "potato-chips", "cheese-pizza-slice", "cheeseburger", "string-cheese"]);
const RED_MEAT = new Set(["ground-beef-90-cooked", "ground-beef-80-cooked", "sirloin-steak-cooked", "bacon-cooked", "beef-jerky", "cheeseburger", "spaghetti-meat-sauce"]);
const DRINK_NOT_WATER = new Set(["coffee-black", "soda-cola", "sports-drink", "orange-juice", "chocolate-milk"]);

type FoodLike = Pick<CommonFood, "slug" | "group" | "carbs_g">;

/** Does a built-in food fit a diet style? Unknown foods (custom, scanned) are never marked. */
export function fitsDiet(food: FoodLike, diet: DietType): boolean {
  const s = food.slug;
  const animal = MEAT.has(s) || FISH.has(s) || EGG.has(s) || DAIRY.has(s);
  switch (diet) {
    case "balanced":
    case "high_protein":
    case "intermittent_fasting":
      return !SUGARY.has(s) || s === "orange-juice" || s === "raisins" || s === "honey";
    case "low_carb":
      return food.carbs_g <= 15 && !SUGARY.has(s);
    case "keto":
      return food.carbs_g <= 6 && !SUGARY.has(s) && !GRAIN.has(s) && !LEGUME.has(s) && food.group !== "fruit";
    case "mediterranean":
      return (!RED_MEAT.has(s) && !PROCESSED.has(s) && !SUGARY.has(s) && !REFINED_GRAIN.has(s)) || s === "dark-chocolate";
    case "paleo":
      return !GRAIN.has(s) && !DAIRY.has(s) && !LEGUME.has(s) && !PROCESSED.has(s) && (!SUGARY.has(s) || s === "honey" || s === "raisins");
    case "vegetarian":
      return !MEAT.has(s) && !FISH.has(s);
    case "vegan":
      return !animal && s !== "honey" && s !== "mayonnaise" && s !== "protein-bar";
    case "pescatarian":
      return !MEAT.has(s);
    case "carnivore":
      return (MEAT.has(s) || FISH.has(s) || s === "egg-large" || s === "egg-white" || s === "butter" || s === "cheddar-cheese") && !GRAIN.has(s) && food.carbs_g <= 2;
    case "daniel_fast":
      return !animal && !PROCESSED.has(s) && !SUGARY.has(s) && !REFINED_GRAIN.has(s) && !DRINK_NOT_WATER.has(s) && s !== "honey" && s !== "mayonnaise" && s !== "butter" && s !== "bread-whole-wheat" && s !== "english-muffin" && s !== "tortilla-corn" && s !== "almond-milk-unsweetened";
    case "dash":
      return (!SALTY.has(s) && !SUGARY.has(s) && !RED_MEAT.has(s) && !PROCESSED.has(s)) || s === "orange-juice";
  }
}

// --------------------------------------------------------------------------- Macro split

export interface MacroSplit {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Split a calorie target into protein, carbs and fat for a diet style. Protein is set per kg of
 * bodyweight, carbs are fixed for the low-carb styles, and fat fills the rest (never below
 * 0.6 g/kg). Rounded grams always add back up to within a few kcal of the target.
 */
export function macroSplitForDiet(calories: number, weightKg: number, diet: DietType, baseProteinPerKg: number): MacroSplit {
  const proteinPerKg: Partial<Record<DietType, number>> = {
    high_protein: 2.2,
    low_carb: 2.0,
    keto: 1.6,
    carnivore: 2.0,
    paleo: 1.8,
    vegan: Math.max(baseProteinPerKg, 1.6),
    daniel_fast: 1.2,
  };
  const protein_g = Math.round(weightKg * (proteinPerKg[diet] ?? baseProteinPerKg));
  const fatFloor = Math.round(weightKg * 0.6);
  const fixedCarbs: Partial<Record<DietType, number>> = { keto: 25, carnivore: 10, low_carb: 100 };
  const fatPct: Partial<Record<DietType, number>> = { mediterranean: 0.35, paleo: 0.4, daniel_fast: 0.25, dash: 0.27, high_protein: 0.25 };

  let carbs_g: number;
  let fat_g: number;
  const remaining = Math.max(0, calories - protein_g * 4);
  if (fixedCarbs[diet] !== undefined) {
    carbs_g = Math.min(fixedCarbs[diet]!, Math.round(remaining / 4));
    fat_g = Math.max(fatFloor, Math.round((remaining - carbs_g * 4) / 9));
  } else {
    fat_g = Math.max(fatFloor, Math.round((calories * (fatPct[diet] ?? 0.3)) / 9));
    carbs_g = Math.max(0, Math.round((remaining - fat_g * 9) / 4));
  }
  return { protein_g, carbs_g, fat_g };
}

export function isDietType(v: unknown): v is DietType {
  return typeof v === "string" && (DIET_TYPES as readonly string[]).includes(v);
}
