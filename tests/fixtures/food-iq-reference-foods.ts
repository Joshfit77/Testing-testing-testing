/**
 * Reference foods for checking the Food IQ rating (docs/FOOD_IQ_METHOD.md). Typical values per 100 g (or 100 ml for
 * drinks), rounded, from standard composition tables (USDA FoodData Central, SR Legacy / Foundation entries) and, for
 * branded-style products, typical label values. They are representative, not any specific product.
 *
 * `expect` is what dietary guidance would lead you to expect of the band, used as a sanity check of the method, not as
 * proof it is right: [min, max] score bounds.
 */
export interface ReferenceFood {
  name: string;
  group: string;
  unit?: "g" | "ml";
  categories?: string[];
  n: { kcal: number; protein: number; carbs: number; sugars: number; fat: number; sat: number; fibre?: number; salt: number };
  fvl?: number;
  sweeteners?: boolean;
  expect: [number, number];
}

export const REFERENCE_FOODS: ReferenceFood[] = [
  // Vegetables, fruit, legumes
  { name: "Broccoli, raw", group: "Vegetables", n: { kcal: 34, protein: 2.8, carbs: 6.6, sugars: 1.7, fat: 0.4, sat: 0.04, fibre: 2.6, salt: 0.08 }, fvl: 100, expect: [85, 100] },
  { name: "Apple, raw", group: "Fruit", n: { kcal: 52, protein: 0.3, carbs: 13.8, sugars: 10.4, fat: 0.2, sat: 0.03, fibre: 2.4, salt: 0 }, fvl: 100, expect: [70, 100] },
  { name: "Banana, raw", group: "Fruit", n: { kcal: 89, protein: 1.1, carbs: 22.8, sugars: 12.2, fat: 0.3, sat: 0.1, fibre: 2.6, salt: 0 }, fvl: 100, expect: [70, 100] },
  { name: "Raisins", group: "Fruit", n: { kcal: 299, protein: 3.1, carbs: 79, sugars: 59, fat: 0.5, sat: 0.1, fibre: 3.7, salt: 0.03 }, fvl: 100, expect: [30, 69] },
  { name: "Hummus", group: "Legumes", n: { kcal: 166, protein: 7.9, carbs: 14.3, sugars: 0.3, fat: 9.6, sat: 1.4, fibre: 6, salt: 0.9 }, fvl: 70, expect: [70, 100] },
  { name: "Lentils, boiled", group: "Legumes", n: { kcal: 116, protein: 9, carbs: 20, sugars: 1.8, fat: 0.4, sat: 0.05, fibre: 7.9, salt: 0.01 }, fvl: 100, expect: [85, 100] },
  // Grains
  { name: "Rolled oats", group: "Whole grains", n: { kcal: 379, protein: 13.2, carbs: 67.7, sugars: 1, fat: 6.5, sat: 1.1, fibre: 10.1, salt: 0.01 }, expect: [70, 100] },
  { name: "Wholemeal bread", group: "Whole grains", n: { kcal: 247, protein: 13, carbs: 41, sugars: 6, fat: 3.4, sat: 0.7, fibre: 7, salt: 0.9 }, expect: [70, 100] },
  { name: "White bread", group: "Refined grains", n: { kcal: 265, protein: 9, carbs: 49, sugars: 5, fat: 3.2, sat: 0.7, fibre: 2.7, salt: 1.2 }, expect: [40, 69] },
  { name: "Pasta, dry", group: "Refined grains", n: { kcal: 371, protein: 13, carbs: 75, sugars: 2.7, fat: 1.5, sat: 0.3, fibre: 3.2, salt: 0.01 }, expect: [50, 84] },
  { name: "Brown rice, raw", group: "Whole grains", n: { kcal: 370, protein: 7.9, carbs: 77, sugars: 0.9, fat: 2.9, sat: 0.6, fibre: 3.5, salt: 0.01 }, expect: [50, 84] },
  { name: "Frosted flakes cereal", group: "Sweetened cereals", n: { kcal: 375, protein: 5, carbs: 87, sugars: 37, fat: 0.5, sat: 0.1, fibre: 2, salt: 0.7 }, expect: [0, 49] },
  { name: "Granola with added sugar", group: "Sweetened cereals", n: { kcal: 450, protein: 10, carbs: 64, sugars: 20, fat: 17, sat: 2, fibre: 7, salt: 0.3 }, expect: [30, 69] },
  // Protein foods
  { name: "Chicken breast, raw", group: "Lean protein", n: { kcal: 120, protein: 22.5, carbs: 0, sugars: 0, fat: 2.6, sat: 0.6, fibre: 0, salt: 0.15 }, expect: [70, 84] },
  { name: "Salmon, raw", group: "Oily fish", n: { kcal: 208, protein: 20, carbs: 0, sugars: 0, fat: 13, sat: 3.1, fibre: 0, salt: 0.15 }, expect: [50, 84] },
  { name: "Eggs, whole", group: "Eggs", n: { kcal: 143, protein: 12.6, carbs: 0.7, sugars: 0.4, fat: 9.5, sat: 3.1, fibre: 0, salt: 0.36 }, expect: [50, 84] },
  { name: "Bacon, cured", group: "Processed meat", n: { kcal: 417, protein: 13, carbs: 1.4, sugars: 0, fat: 42, sat: 14, fibre: 0, salt: 2.5 }, expect: [0, 29] },
  { name: "Protein bar (typical)", group: "Protein snacks", n: { kcal: 350, protein: 29, carbs: 35, sugars: 5, fat: 11, sat: 4, fibre: 10, salt: 0.5 }, expect: [40, 69] },
  // Dairy
  { name: "Greek yogurt, plain 0%", group: "Dairy", n: { kcal: 59, protein: 10.2, carbs: 3.6, sugars: 3.2, fat: 0.4, sat: 0.1, fibre: 0, salt: 0.09 }, expect: [70, 84] },
  { name: "Fruit yogurt, whole milk", group: "Dairy", n: { kcal: 105, protein: 3.5, carbs: 15, sugars: 14, fat: 3.5, sat: 2.1, fibre: 0, salt: 0.1 }, fvl: 10, expect: [30, 69] },
  { name: "Whole milk", group: "Dairy", unit: "ml", categories: ["en:dairies", "en:milks"], n: { kcal: 61, protein: 3.2, carbs: 4.8, sugars: 4.8, fat: 3.3, sat: 1.9, fibre: 0, salt: 0.1 }, expect: [50, 84] },
  { name: "Cheddar cheese", group: "Cheese", n: { kcal: 403, protein: 25, carbs: 1.3, sugars: 0.5, fat: 33, sat: 21, fibre: 0, salt: 1.8 }, expect: [0, 49] },
  // Snacks and sweets
  { name: "Potato crisps", group: "Salty snacks", n: { kcal: 536, protein: 7, carbs: 53, sugars: 0.5, fat: 35, sat: 3.4, fibre: 4.4, salt: 1.3 }, expect: [0, 49] },
  { name: "Milk chocolate", group: "Confectionery", n: { kcal: 535, protein: 7.6, carbs: 59, sugars: 52, fat: 30, sat: 19, fibre: 3.4, salt: 0.2 }, expect: [0, 29] },
  { name: "Dark chocolate 70%", group: "Confectionery", n: { kcal: 600, protein: 7.8, carbs: 46, sugars: 24, fat: 43, sat: 24, fibre: 11, salt: 0.03 }, expect: [0, 49] },
  { name: "Instant noodles with seasoning", group: "Ready meals", n: { kcal: 450, protein: 9, carbs: 60, sugars: 2, fat: 18, sat: 8, fibre: 2.5, salt: 3.5 }, expect: [0, 29] },
  { name: "Tomato ketchup", group: "Condiments", n: { kcal: 112, protein: 1.2, carbs: 26, sugars: 22.8, fat: 0.1, sat: 0, fibre: 0.3, salt: 2.3 }, fvl: 60, expect: [0, 49] },
  // Fats, oils, nuts
  { name: "Extra virgin olive oil", group: "Oils", categories: ["en:fats", "en:vegetable-oils", "en:olive-oils"], n: { kcal: 884, protein: 0, carbs: 0, sugars: 0, fat: 100, sat: 14, fibre: 0, salt: 0 }, expect: [70, 84] },
  { name: "Sunflower oil", group: "Oils", categories: ["en:fats", "en:vegetable-oils"], n: { kcal: 884, protein: 0, carbs: 0, sugars: 0, fat: 100, sat: 10, fibre: 0, salt: 0 }, expect: [70, 84] },
  { name: "Coconut oil", group: "Oils", categories: ["en:fats", "en:vegetable-oils"], n: { kcal: 892, protein: 0, carbs: 0, sugars: 0, fat: 99, sat: 86, fibre: 0, salt: 0 }, expect: [0, 49] },
  { name: "Butter, salted", group: "Animal fats", categories: ["en:fats", "en:animal-fats", "en:butters"], n: { kcal: 717, protein: 0.9, carbs: 0.1, sugars: 0.1, fat: 81, sat: 51, fibre: 0, salt: 1.6 }, expect: [0, 29] },
  { name: "Butter, unsalted", group: "Animal fats", categories: ["en:fats", "en:animal-fats", "en:butters"], n: { kcal: 717, protein: 0.9, carbs: 0.1, sugars: 0.1, fat: 81, sat: 51, fibre: 0, salt: 0.03 }, expect: [0, 49] },
  { name: "Almonds", group: "Nuts", categories: ["en:nuts"], n: { kcal: 579, protein: 21, carbs: 22, sugars: 4.4, fat: 50, sat: 3.8, fibre: 12.5, salt: 0 }, expect: [85, 100] },
  { name: "Peanut butter, sweetened and salted", group: "Nuts", categories: ["en:nut-butters", "en:peanut-butters"], n: { kcal: 588, protein: 25, carbs: 20, sugars: 9, fat: 50, sat: 10, fibre: 6, salt: 1.1 }, expect: [50, 84] },
  // Drinks
  { name: "Still spring water", group: "Water", unit: "ml", categories: ["en:beverages", "en:waters", "en:spring-waters"], n: { kcal: 0, protein: 0, carbs: 0, sugars: 0, fat: 0, sat: 0, salt: 0 }, expect: [100, 100] },
  { name: "Unsweetened black tea", group: "Unsweetened drinks", unit: "ml", categories: ["en:beverages", "en:teas"], n: { kcal: 1, protein: 0, carbs: 0.3, sugars: 0, fat: 0, sat: 0, salt: 0 }, expect: [70, 89] },
  { name: "Cola", group: "Sugary drinks", unit: "ml", categories: ["en:beverages", "en:sodas"], n: { kcal: 42, protein: 0, carbs: 10.6, sugars: 10.6, fat: 0, sat: 0, salt: 0 }, expect: [0, 29] },
  { name: "Diet cola (sweeteners)", group: "Sweetened drinks", unit: "ml", categories: ["en:beverages", "en:sodas"], n: { kcal: 0.4, protein: 0, carbs: 0, sugars: 0, fat: 0, sat: 0, salt: 0.02 }, sweeteners: true, expect: [50, 69] },
  { name: "Orange juice, 100%", group: "Juices", unit: "ml", categories: ["en:beverages", "en:fruit-juices"], n: { kcal: 45, protein: 0.7, carbs: 10.4, sugars: 8.4, fat: 0.2, sat: 0, fibre: 0.2, salt: 0 }, fvl: 100, expect: [30, 49] },
  { name: "Sports drink", group: "Sugary drinks", unit: "ml", categories: ["en:beverages", "en:sports-drinks"], n: { kcal: 26, protein: 0, carbs: 6, sugars: 6, fat: 0, sat: 0, salt: 0.1 }, expect: [0, 49] },
];
