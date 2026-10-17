/**
 * Built-in common foods, so food search works without a USDA API key.
 * Values are typical per-serving figures based on USDA FoodData Central reference
 * entries, rounded. Real products vary — labels are always more accurate, so these
 * are stored as estimates (`is_estimate = true`).
 */
export type FoodGroup = "protein" | "dairy" | "grains" | "fruit" | "vegetables" | "fats" | "snacks" | "drinks" | "meals";

export interface CommonFood {
  slug: string;
  name: string;
  group: FoodGroup;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
}

const f = (
  slug: string,
  name: string,
  group: FoodGroup,
  servingSize: number,
  servingUnit: string,
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number,
  fiber_g?: number,
): CommonFood => ({ slug, name, group, servingSize, servingUnit, calories, protein_g, carbs_g, fat_g, fiber_g });

export const COMMON_FOODS: CommonFood[] = [
  // Protein
  f("chicken-breast-cooked", "Chicken breast, skinless, cooked", "protein", 4, "oz (113 g)", 187, 35, 0, 4),
  f("chicken-thigh-cooked", "Chicken thigh, skinless, cooked", "protein", 4, "oz (113 g)", 229, 28, 0, 12),
  f("ground-beef-90-cooked", "Ground beef 90% lean, cooked", "protein", 4, "oz (113 g)", 245, 30, 0, 13),
  f("ground-beef-80-cooked", "Ground beef 80% lean, cooked", "protein", 4, "oz (113 g)", 307, 29, 0, 20),
  f("ground-turkey-93-cooked", "Ground turkey 93% lean, cooked", "protein", 4, "oz (113 g)", 241, 31, 0, 13),
  f("sirloin-steak-cooked", "Sirloin steak, lean, cooked", "protein", 4, "oz (113 g)", 230, 34, 0, 9),
  f("pork-tenderloin-cooked", "Pork tenderloin, cooked", "protein", 4, "oz (113 g)", 162, 30, 0, 4),
  f("bacon-cooked", "Bacon, cooked", "protein", 3, "slices (24 g)", 129, 9, 0, 10),
  f("salmon-cooked", "Salmon, Atlantic, cooked", "protein", 4, "oz (113 g)", 233, 25, 0, 14),
  f("tilapia-cooked", "Tilapia, cooked", "protein", 4, "oz (113 g)", 145, 30, 0, 3),
  f("shrimp-cooked", "Shrimp, cooked", "protein", 4, "oz (113 g)", 112, 27, 0, 1),
  f("tuna-canned-water", "Tuna, canned in water, drained", "protein", 1, "can (142 g drained)", 165, 36, 0, 1),
  f("egg-large", "Egg, large, whole", "protein", 1, "egg (50 g)", 72, 6, 0, 5),
  f("egg-white", "Egg whites", "protein", 3, "tbsp (46 g)", 25, 5, 0, 0),
  f("turkey-deli", "Turkey breast, deli sliced", "protein", 2, "oz (56 g)", 60, 11, 2, 1),
  f("tofu-firm", "Tofu, firm", "protein", 0.5, "cup (126 g)", 181, 22, 4, 11, 3),
  f("black-beans", "Black beans, cooked", "protein", 0.5, "cup (86 g)", 114, 8, 20, 0, 8),
  f("lentils-cooked", "Lentils, cooked", "protein", 0.5, "cup (99 g)", 115, 9, 20, 0, 8),
  f("chickpeas-cooked", "Chickpeas, cooked", "protein", 0.5, "cup (82 g)", 134, 7, 22, 2, 6),
  f("whey-protein", "Whey protein powder", "protein", 1, "scoop (30 g)", 120, 24, 3, 2),
  // Dairy
  f("greek-yogurt-nonfat", "Greek yogurt, plain, nonfat", "dairy", 1, "container (170 g)", 100, 17, 6, 1),
  f("greek-yogurt-whole", "Greek yogurt, plain, whole milk", "dairy", 1, "container (170 g)", 165, 15, 7, 8),
  f("cottage-cheese-2", "Cottage cheese, 2%", "dairy", 0.5, "cup (113 g)", 92, 12, 5, 3),
  f("milk-whole", "Milk, whole", "dairy", 1, "cup (244 ml)", 149, 8, 12, 8),
  f("milk-2", "Milk, 2%", "dairy", 1, "cup (244 ml)", 122, 8, 12, 5),
  f("milk-skim", "Milk, skim", "dairy", 1, "cup (245 ml)", 83, 8, 12, 0),
  f("almond-milk-unsweetened", "Almond milk, unsweetened", "dairy", 1, "cup (240 ml)", 39, 1, 3, 3),
  f("cheddar-cheese", "Cheddar cheese", "dairy", 1, "oz (28 g)", 114, 7, 0, 9),
  f("mozzarella-part-skim", "Mozzarella, part-skim", "dairy", 1, "oz (28 g)", 72, 7, 1, 5),
  f("string-cheese", "String cheese", "dairy", 1, "stick (28 g)", 80, 7, 1, 6),
  // Grains
  f("white-rice-cooked", "White rice, cooked", "grains", 1, "cup (158 g)", 205, 4, 45, 0, 1),
  f("brown-rice-cooked", "Brown rice, cooked", "grains", 1, "cup (195 g)", 216, 5, 45, 2, 4),
  f("oats-dry", "Oats, rolled, dry", "grains", 0.5, "cup (40 g)", 150, 5, 27, 3, 4),
  f("pasta-cooked", "Pasta, cooked", "grains", 1, "cup (140 g)", 220, 8, 43, 1, 3),
  f("quinoa-cooked", "Quinoa, cooked", "grains", 1, "cup (185 g)", 222, 8, 39, 4, 5),
  f("bread-whole-wheat", "Bread, whole wheat", "grains", 1, "slice (32 g)", 81, 4, 14, 1, 2),
  f("bread-white", "Bread, white", "grains", 1, "slice (28 g)", 75, 3, 14, 1, 1),
  f("bagel-plain", "Bagel, plain", "grains", 1, "medium (105 g)", 277, 11, 55, 1, 2),
  f("tortilla-flour", "Tortilla, flour, 8-inch", "grains", 1, "tortilla (49 g)", 146, 4, 25, 4, 2),
  f("tortilla-corn", "Tortilla, corn, 6-inch", "grains", 1, "tortilla (26 g)", 57, 1, 12, 1, 2),
  f("english-muffin", "English muffin, whole wheat", "grains", 1, "muffin (66 g)", 134, 6, 27, 1, 4),
  f("cereal-cheerios", "Toasted oat cereal", "grains", 1, "cup (28 g)", 100, 3, 20, 2, 3),
  f("granola", "Granola", "grains", 0.25, "cup (30 g)", 140, 3, 20, 6, 2),
  f("pancakes", "Pancakes, plain", "grains", 2, "pancakes, 6-inch (154 g)", 350, 10, 44, 15, 1),
  // Fruit
  f("banana", "Banana", "fruit", 1, "medium (118 g)", 105, 1, 27, 0, 3),
  f("apple", "Apple", "fruit", 1, "medium (182 g)", 95, 0, 25, 0, 4),
  f("orange", "Orange", "fruit", 1, "medium (131 g)", 62, 1, 15, 0, 3),
  f("blueberries", "Blueberries", "fruit", 1, "cup (148 g)", 84, 1, 21, 0, 4),
  f("strawberries", "Strawberries", "fruit", 1, "cup halves (152 g)", 49, 1, 12, 0, 3),
  f("grapes", "Grapes", "fruit", 1, "cup (151 g)", 104, 1, 27, 0, 1),
  f("pineapple", "Pineapple chunks", "fruit", 1, "cup (165 g)", 82, 1, 22, 0, 2),
  f("mango", "Mango", "fruit", 1, "cup pieces (165 g)", 99, 1, 25, 1, 3),
  f("watermelon", "Watermelon", "fruit", 1, "cup diced (152 g)", 46, 1, 12, 0, 1),
  f("raisins", "Raisins", "fruit", 0.25, "cup (40 g)", 120, 1, 32, 0, 2),
  // Vegetables
  f("broccoli", "Broccoli, cooked", "vegetables", 1, "cup (156 g)", 55, 4, 11, 1, 5),
  f("spinach-raw", "Spinach, raw", "vegetables", 2, "cups (60 g)", 14, 2, 2, 0, 1),
  f("mixed-salad", "Mixed salad greens", "vegetables", 2, "cups (85 g)", 15, 1, 3, 0, 2),
  f("carrots", "Carrots, raw", "vegetables", 1, "cup chopped (128 g)", 52, 1, 12, 0, 4),
  f("green-beans", "Green beans, cooked", "vegetables", 1, "cup (125 g)", 44, 2, 10, 0, 4),
  f("bell-pepper", "Bell pepper, raw", "vegetables", 1, "medium (119 g)", 31, 1, 7, 0, 3),
  f("sweet-potato", "Sweet potato, baked", "vegetables", 1, "medium (114 g)", 103, 2, 24, 0, 4),
  f("potato-baked", "Potato, baked with skin", "vegetables", 1, "medium (173 g)", 161, 4, 37, 0, 4),
  f("corn", "Corn, cooked", "vegetables", 1, "cup (164 g)", 177, 5, 41, 2, 5),
  f("avocado", "Avocado", "vegetables", 0.5, "avocado (68 g)", 114, 1, 6, 10, 5),
  f("mixed-vegetables", "Mixed vegetables, frozen, cooked", "vegetables", 1, "cup (182 g)", 118, 5, 24, 0, 8),
  // Fats & nuts
  f("peanut-butter", "Peanut butter", "fats", 2, "tbsp (32 g)", 190, 7, 7, 16, 2),
  f("almond-butter", "Almond butter", "fats", 2, "tbsp (32 g)", 196, 7, 6, 18, 3),
  f("almonds", "Almonds", "fats", 1, "oz (28 g)", 164, 6, 6, 14, 4),
  f("walnuts", "Walnuts", "fats", 1, "oz (28 g)", 185, 4, 4, 18, 2),
  f("olive-oil", "Olive oil", "fats", 1, "tbsp (14 g)", 119, 0, 0, 14),
  f("butter", "Butter", "fats", 1, "tbsp (14 g)", 102, 0, 0, 12),
  f("mayonnaise", "Mayonnaise", "fats", 1, "tbsp (14 g)", 94, 0, 0, 10),
  f("chia-seeds", "Chia seeds", "fats", 1, "tbsp (12 g)", 58, 2, 5, 4, 4),
  // Snacks
  f("protein-bar", "Protein bar", "snacks", 1, "bar (60 g)", 210, 20, 22, 7, 3),
  f("rice-cake", "Rice cake, plain", "snacks", 1, "cake (9 g)", 35, 1, 7, 0),
  f("popcorn-air", "Popcorn, air-popped", "snacks", 3, "cups (24 g)", 93, 3, 19, 1, 4),
  f("potato-chips", "Potato chips", "snacks", 1, "oz (28 g)", 152, 2, 15, 10, 1),
  f("dark-chocolate", "Dark chocolate, 70–85%", "snacks", 1, "oz (28 g)", 170, 2, 13, 12, 3),
  f("beef-jerky", "Beef jerky", "snacks", 1, "oz (28 g)", 116, 9, 3, 7),
  f("hummus", "Hummus", "snacks", 2, "tbsp (30 g)", 70, 2, 4, 5, 2),
  f("trail-mix", "Trail mix", "snacks", 0.25, "cup (38 g)", 173, 5, 17, 11, 2),
  f("honey", "Honey", "snacks", 1, "tbsp (21 g)", 64, 0, 17, 0),
  // Drinks
  f("orange-juice", "Orange juice", "drinks", 1, "cup (248 ml)", 112, 2, 26, 0),
  f("coffee-black", "Coffee, black", "drinks", 1, "cup (240 ml)", 2, 0, 0, 0),
  f("sports-drink", "Sports drink", "drinks", 20, "fl oz (591 ml)", 140, 0, 36, 0),
  f("soda-cola", "Cola", "drinks", 12, "fl oz can (355 ml)", 140, 0, 39, 0),
  f("chocolate-milk", "Chocolate milk, low-fat", "drinks", 1, "cup (250 ml)", 190, 8, 30, 5),
  // Meals & fast food (typical restaurant portions)
  f("cheese-pizza-slice", "Cheese pizza, regular crust", "meals", 1, "slice (107 g)", 285, 12, 36, 10, 2),
  f("cheeseburger", "Cheeseburger, single patty", "meals", 1, "burger (150 g)", 350, 18, 33, 16, 2),
  f("burrito-bowl-chicken", "Chicken burrito bowl (rice, beans, salsa)", "meals", 1, "bowl", 650, 45, 75, 18, 12),
  f("grilled-chicken-salad", "Grilled chicken salad, light dressing", "meals", 1, "salad", 380, 35, 15, 20, 5),
  f("turkey-sandwich", "Turkey sandwich on wheat", "meals", 1, "sandwich", 360, 25, 40, 11, 5),
  f("spaghetti-meat-sauce", "Spaghetti with meat sauce", "meals", 1.5, "cups (370 g)", 480, 25, 60, 15, 5),
  f("chicken-stir-fry", "Chicken stir-fry with rice", "meals", 1, "plate", 550, 35, 65, 15, 4),
];

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  protein: "Protein",
  dairy: "Dairy",
  grains: "Grains & bread",
  fruit: "Fruit",
  vegetables: "Vegetables",
  fats: "Nuts & fats",
  snacks: "Snacks",
  drinks: "Drinks",
  meals: "Meals",
};
