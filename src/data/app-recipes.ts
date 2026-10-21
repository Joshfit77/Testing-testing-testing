import type { PlanSlot } from "@/lib/domain/meal-planner";

/**
 * Simple built-in recipes for the meal planner, written for this app (not taken from a cookbook or a
 * dietitian). Everyday foods, nothing fancy. Every ingredient points at an exact USDA FoodData Central SR
 * Legacy record in usda-foods.json, and its amount uses either grams ("g") or one of that record's USDA
 * household measures, so nutrition is computed by the same code as the food diary.
 * `tests/unit/app-recipes.test.ts` checks every id and unit.
 */

export interface AppRecipeIngredient {
  fdcId: number;
  quantity: number;
  /** "g", "oz", or the exact USDA portion label (e.g. "1 large"). */
  unit: string;
}

export interface AppRecipe {
  slug: string;
  name: string;
  servings: number;
  slots: PlanSlot[];
  ingredients: AppRecipeIngredient[];
  steps: string[];
}

const OATS = 173904;
const MILK_SKIM = 169868;
const BANANA = 173944;
const PEANUT_BUTTER = 172470;
const GREEK_YOGURT = 170894;
const BLUEBERRIES = 171711;
const WALNUTS = 170187;
const HONEY = 169640;
const EGG = 171287;
const EGG_BOILED = 173424;
const WW_BREAD = 172688;
const SPINACH = 168462;
const OLIVE_OIL = 171413;
const RED_PEPPER = 170108;
const ONION = 170000;
const CHEDDAR = 170899;
const COTTAGE = 172182;
const STRAWBERRIES = 167762;
const TOFU = 172475;
const CORN_TORTILLA = 175036;
const FLOUR_TORTILLA = 167535;
const ALMOND_MILK = 174832;
const CHIA = 170554;
const CHICKEN = 171477;
const BROWN_RICE = 169704;
const WHITE_RICE = 168878;
const BROCCOLI_COOKED = 169967;
const BROCCOLI_RAW = 170379;
const GROUND_TURKEY = 171506;
const BLACK_BEANS = 173735;
const SALSA = 174524;
const ROMAINE = 169247;
const TUNA = 171986;
const TOMATO = 170457;
const SALMON = 175168;
const SWEET_POTATO = 168483;
const GREEN_BEANS = 169141;
const GROUND_BEEF = 171794;
const PASTA = 169737;
const LENTILS = 172421;
const CARROTS = 170393;
const CHICKPEAS = 173757;
const QUINOA = 168917;
const CUCUMBER = 168409;
const SIRLOIN = 168635;
const POTATO = 170030;
const AVOCADO = 171705;
const TILAPIA = 175177;
const BUTTER = 173410;
const APPLE = 171688;
const HUMMUS = 174289;
const ALMONDS = 170567;

export const APP_RECIPES: AppRecipe[] = [
  // ---------------------------------------------------------------- Breakfast
  {
    slug: "oatmeal-banana-peanut-butter",
    name: "Oatmeal with banana and peanut butter",
    servings: 1,
    slots: ["breakfast"],
    ingredients: [
      { fdcId: OATS, quantity: 40, unit: "g" },
      { fdcId: MILK_SKIM, quantity: 1, unit: "1 cup" },
      { fdcId: BANANA, quantity: 1, unit: '1 medium (7" to 7-7/8" long)' },
      { fdcId: PEANUT_BUTTER, quantity: 16, unit: "g" },
    ],
    steps: ["Cook the oats in the milk for 3–5 minutes, stirring.", "Top with sliced banana and the peanut butter."],
  },
  {
    slug: "greek-yogurt-berries-walnuts",
    name: "Greek yogurt with blueberries and walnuts",
    servings: 1,
    slots: ["breakfast", "snack"],
    ingredients: [
      { fdcId: GREEK_YOGURT, quantity: 1, unit: "1 container" },
      { fdcId: BLUEBERRIES, quantity: 0.5, unit: "1 cup" },
      { fdcId: WALNUTS, quantity: 14, unit: "g" },
      { fdcId: HONEY, quantity: 1, unit: "1 tbsp" },
    ],
    steps: ["Spoon the yogurt into a bowl.", "Add the blueberries and walnuts and drizzle with honey."],
  },
  {
    slug: "scrambled-eggs-toast-spinach",
    name: "Scrambled eggs, spinach and whole-wheat toast",
    servings: 1,
    slots: ["breakfast"],
    ingredients: [
      { fdcId: EGG, quantity: 2, unit: "1 large" },
      { fdcId: SPINACH, quantity: 1, unit: "1 cup" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
      { fdcId: WW_BREAD, quantity: 2, unit: "1 slice" },
    ],
    steps: ["Wilt the spinach in the oil over medium heat.", "Add the beaten eggs and stir until just set.", "Serve with the toast."],
  },
  {
    slug: "veggie-omelet",
    name: "Pepper, onion and cheddar omelet",
    servings: 1,
    slots: ["breakfast", "lunch"],
    ingredients: [
      { fdcId: EGG, quantity: 3, unit: "1 large" },
      { fdcId: RED_PEPPER, quantity: 0.5, unit: "1 cup, chopped" },
      { fdcId: ONION, quantity: 2, unit: "1 tbsp chopped" },
      { fdcId: CHEDDAR, quantity: 1, unit: "1 slice (1 oz)" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Soften the pepper and onion in the oil.", "Pour in the beaten eggs, cook until nearly set, add the cheese and fold."],
  },
  {
    slug: "cottage-cheese-strawberries",
    name: "Cottage cheese with strawberries",
    servings: 1,
    slots: ["breakfast", "snack"],
    ingredients: [
      { fdcId: COTTAGE, quantity: 1, unit: "1 cup (not packed)" },
      { fdcId: STRAWBERRIES, quantity: 1, unit: "1 cup, sliced" },
    ],
    steps: ["Top the cottage cheese with the sliced strawberries."],
  },
  {
    slug: "tofu-scramble-tacos",
    name: "Tofu scramble tacos",
    servings: 1,
    slots: ["breakfast", "lunch"],
    ingredients: [
      { fdcId: TOFU, quantity: 1, unit: "0.5 cup" },
      { fdcId: SPINACH, quantity: 1, unit: "1 cup" },
      { fdcId: RED_PEPPER, quantity: 0.5, unit: "1 cup, chopped" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
      { fdcId: CORN_TORTILLA, quantity: 2, unit: "1 tortilla" },
    ],
    steps: ["Crumble the tofu into the hot oil with the pepper and cook 5 minutes.", "Stir in the spinach until wilted.", "Spoon into warm tortillas."],
  },
  {
    slug: "peanut-butter-banana-toast",
    name: "Peanut butter and banana toast",
    servings: 1,
    slots: ["breakfast", "snack"],
    ingredients: [
      { fdcId: WW_BREAD, quantity: 2, unit: "1 slice" },
      { fdcId: PEANUT_BUTTER, quantity: 1, unit: "2 tbsp" },
      { fdcId: BANANA, quantity: 1, unit: '1 medium (7" to 7-7/8" long)' },
    ],
    steps: ["Toast the bread, spread with peanut butter and top with sliced banana."],
  },
  {
    slug: "overnight-oats-chia",
    name: "Overnight oats with chia and strawberries",
    servings: 1,
    slots: ["breakfast"],
    ingredients: [
      { fdcId: OATS, quantity: 40, unit: "g" },
      { fdcId: ALMOND_MILK, quantity: 1, unit: "1 cup" },
      { fdcId: CHIA, quantity: 15, unit: "g" },
      { fdcId: STRAWBERRIES, quantity: 0.5, unit: "1 cup, sliced" },
    ],
    steps: ["Stir the oats, chia and almond milk together in a jar.", "Refrigerate overnight; top with strawberries in the morning."],
  },
  {
    slug: "steak-and-eggs",
    name: "Steak and eggs",
    servings: 1,
    slots: ["breakfast", "lunch", "dinner"],
    ingredients: [
      { fdcId: SIRLOIN, quantity: 1, unit: "3 oz" },
      { fdcId: EGG, quantity: 2, unit: "1 large" },
      { fdcId: BUTTER, quantity: 1, unit: '1 pat (1" sq, 1/3" high)' },
    ],
    steps: ["Sear the steak to your liking and let it rest.", "Fry the eggs in the butter and serve together."],
  },
  {
    slug: "eggs-avocado-spinach",
    name: "Eggs with avocado and spinach",
    servings: 1,
    slots: ["breakfast", "lunch"],
    ingredients: [
      { fdcId: EGG, quantity: 3, unit: "1 large" },
      { fdcId: AVOCADO, quantity: 1, unit: "1 NLEA Serving" },
      { fdcId: SPINACH, quantity: 1, unit: "1 cup" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Fry or scramble the eggs in the oil.", "Serve on the spinach with sliced avocado."],
  },
  // ---------------------------------------------------------------- Lunch and dinner
  {
    slug: "chicken-rice-broccoli",
    name: "Chicken, brown rice and broccoli",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: CHICKEN, quantity: 120, unit: "g" },
      { fdcId: BROWN_RICE, quantity: 1, unit: "1 cup" },
      { fdcId: BROCCOLI_COOKED, quantity: 2, unit: "0.5 cup, chopped" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Roast or grill the chicken breast.", "Steam the broccoli and toss with the oil.", "Serve over the rice."],
  },
  {
    slug: "turkey-black-bean-bowl",
    name: "Ground turkey and black bean bowl",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: GROUND_TURKEY, quantity: 100, unit: "g" },
      { fdcId: BLACK_BEANS, quantity: 0.5, unit: "1 cup" },
      { fdcId: WHITE_RICE, quantity: 0.75, unit: "1 cup" },
      { fdcId: SALSA, quantity: 1, unit: "2 tbsp" },
      { fdcId: ROMAINE, quantity: 1, unit: "1 cup shredded" },
    ],
    steps: ["Brown the turkey and warm the beans.", "Layer over rice and lettuce; top with salsa."],
  },
  {
    slug: "tuna-yogurt-wrap",
    name: "Tuna and Greek yogurt wrap",
    servings: 1,
    slots: ["lunch"],
    ingredients: [
      { fdcId: TUNA, quantity: 1, unit: "3 oz" },
      { fdcId: GREEK_YOGURT, quantity: 50, unit: "g" },
      { fdcId: FLOUR_TORTILLA, quantity: 1, unit: "1 tortilla" },
      { fdcId: ROMAINE, quantity: 1, unit: "1 cup shredded" },
      { fdcId: TOMATO, quantity: 2, unit: '1 slice, medium (1/4" thick)' },
    ],
    steps: ["Mix the drained tuna with the yogurt.", "Fill the tortilla with lettuce, tomato and the tuna, then roll."],
  },
  {
    slug: "salmon-sweet-potato-green-beans",
    name: "Salmon, sweet potato and green beans",
    servings: 1,
    slots: ["dinner"],
    ingredients: [
      { fdcId: SALMON, quantity: 120, unit: "g" },
      { fdcId: SWEET_POTATO, quantity: 1, unit: '1 medium (2" dia, 5" long, raw)' },
      { fdcId: GREEN_BEANS, quantity: 1, unit: "1 cup" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Bake the sweet potato (about 45 minutes at 400 °F / 200 °C).", "Bake the salmon for the last 12–15 minutes.", "Steam the green beans and toss with the oil."],
  },
  {
    slug: "beef-tomato-pasta",
    name: "Beef and tomato pasta",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: GROUND_BEEF, quantity: 1, unit: "3 oz" },
      { fdcId: PASTA, quantity: 1.5, unit: "1 cup spaghetti not packed" },
      { fdcId: TOMATO, quantity: 1, unit: "1 cup, chopped or sliced" },
      { fdcId: ONION, quantity: 2, unit: "1 tbsp chopped" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Brown the beef with the onion in the oil.", "Add the chopped tomato and simmer 10 minutes.", "Toss with the cooked pasta."],
  },
  {
    slug: "lentil-rice-bowl",
    name: "Lentil and brown rice bowl",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: LENTILS, quantity: 1, unit: "1 cup" },
      { fdcId: BROWN_RICE, quantity: 0.75, unit: "1 cup" },
      { fdcId: CARROTS, quantity: 1, unit: "1 medium" },
      { fdcId: ONION, quantity: 2, unit: "1 tbsp chopped" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Soften the onion and diced carrot in the oil.", "Stir in the cooked lentils and heat through.", "Serve over the rice."],
  },
  {
    slug: "chickpea-quinoa-salad",
    name: "Chickpea and quinoa salad",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: CHICKPEAS, quantity: 0.75, unit: "1 cup" },
      { fdcId: QUINOA, quantity: 0.75, unit: "1 cup" },
      { fdcId: CUCUMBER, quantity: 1, unit: "0.5 cup slices" },
      { fdcId: TOMATO, quantity: 1, unit: '1 medium whole (2-3/5" dia)' },
      { fdcId: OLIVE_OIL, quantity: 2, unit: "1 tsp" },
    ],
    steps: ["Combine the chickpeas, cooled quinoa, cucumber and chopped tomato.", "Dress with the oil and a pinch of salt."],
  },
  {
    slug: "tofu-vegetable-stir-fry",
    name: "Tofu and vegetable stir-fry",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: TOFU, quantity: 2, unit: "0.25 block" },
      { fdcId: BROCCOLI_RAW, quantity: 1, unit: "1 cup chopped" },
      { fdcId: RED_PEPPER, quantity: 0.5, unit: "1 cup, sliced" },
      { fdcId: BROWN_RICE, quantity: 1, unit: "1 cup" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Brown the cubed tofu in the oil.", "Add the broccoli and pepper and stir-fry 4–5 minutes.", "Serve over the rice."],
  },
  {
    slug: "steak-potato-salad",
    name: "Sirloin, baked potato and salad",
    servings: 1,
    slots: ["dinner"],
    ingredients: [
      { fdcId: SIRLOIN, quantity: 1.5, unit: "3 oz" },
      { fdcId: POTATO, quantity: 1, unit: '1 potato medium (2-1/4" to 3-1/4" dia.)' },
      { fdcId: ROMAINE, quantity: 2, unit: "1 cup shredded" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Bake the potato.", "Grill or pan-sear the steak.", "Serve with the lettuce dressed in the oil."],
  },
  {
    slug: "black-bean-tacos",
    name: "Black bean and avocado tacos",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: BLACK_BEANS, quantity: 0.75, unit: "1 cup" },
      { fdcId: CORN_TORTILLA, quantity: 3, unit: "1 tortilla" },
      { fdcId: SALSA, quantity: 1, unit: "2 tbsp" },
      { fdcId: AVOCADO, quantity: 1, unit: "1 NLEA Serving" },
      { fdcId: ROMAINE, quantity: 1, unit: "1 cup shredded" },
    ],
    steps: ["Warm the beans and tortillas.", "Fill with beans, lettuce, avocado and salsa."],
  },
  {
    slug: "tilapia-rice-green-beans",
    name: "Tilapia, rice and green beans",
    servings: 1,
    slots: ["dinner"],
    ingredients: [
      { fdcId: TILAPIA, quantity: 1, unit: "1 fillet" },
      { fdcId: WHITE_RICE, quantity: 1, unit: "1 cup" },
      { fdcId: GREEN_BEANS, quantity: 1, unit: "1 cup" },
      { fdcId: OLIVE_OIL, quantity: 1, unit: "1 tsp" },
    ],
    steps: ["Bake the tilapia 10–12 minutes at 400 °F / 200 °C.", "Serve with rice and steamed green beans tossed in the oil."],
  },
  {
    slug: "chicken-salad-bowl",
    name: "Chicken salad bowl",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: CHICKEN, quantity: 100, unit: "g" },
      { fdcId: ROMAINE, quantity: 2, unit: "1 cup shredded" },
      { fdcId: TOMATO, quantity: 1, unit: '1 medium whole (2-3/5" dia)' },
      { fdcId: CUCUMBER, quantity: 1, unit: "0.5 cup slices" },
      { fdcId: OLIVE_OIL, quantity: 2, unit: "1 tsp" },
    ],
    steps: ["Slice the cooked chicken.", "Toss the lettuce, tomato and cucumber with the oil and top with the chicken."],
  },
  {
    slug: "beef-patty-cheddar",
    name: "Beef patty with cheddar",
    servings: 1,
    slots: ["lunch", "dinner"],
    ingredients: [
      { fdcId: GROUND_BEEF, quantity: 150, unit: "g" },
      { fdcId: CHEDDAR, quantity: 1, unit: "1 slice (1 oz)" },
    ],
    steps: ["Shape the beef into a patty and cook through.", "Melt the cheese on top for the last minute."],
  },
  // ---------------------------------------------------------------- Snacks
  {
    slug: "apple-peanut-butter",
    name: "Apple with peanut butter",
    servings: 1,
    slots: ["snack"],
    ingredients: [
      { fdcId: APPLE, quantity: 1, unit: '1 medium (3" dia)' },
      { fdcId: PEANUT_BUTTER, quantity: 16, unit: "g" },
    ],
    steps: ["Slice the apple and serve with the peanut butter."],
  },
  {
    slug: "hummus-vegetables",
    name: "Hummus with carrots and cucumber",
    servings: 1,
    slots: ["snack"],
    ingredients: [
      { fdcId: HUMMUS, quantity: 3, unit: "1 tbsp" },
      { fdcId: CARROTS, quantity: 1, unit: "1 cup strips or slices" },
      { fdcId: CUCUMBER, quantity: 1, unit: "0.5 cup slices" },
    ],
    steps: ["Cut the vegetables into sticks and dip."],
  },
  {
    slug: "almonds-strawberries",
    name: "Almonds and strawberries",
    servings: 1,
    slots: ["snack"],
    ingredients: [
      { fdcId: ALMONDS, quantity: 1, unit: "1 oz (23 whole kernels)" },
      { fdcId: STRAWBERRIES, quantity: 1, unit: "1 cup, halves" },
    ],
    steps: ["Serve together."],
  },
  {
    slug: "hard-boiled-eggs",
    name: "Hard-boiled eggs",
    servings: 1,
    slots: ["snack", "breakfast"],
    ingredients: [{ fdcId: EGG_BOILED, quantity: 2, unit: "1 large" }],
    steps: ["Boil the eggs 10–12 minutes, cool in cold water and peel."],
  },
];

export function appRecipe(slug: string): AppRecipe | undefined {
  return APP_RECIPES.find((r) => r.slug === slug);
}
