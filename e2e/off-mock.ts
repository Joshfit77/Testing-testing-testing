import { createServer, type Server } from "node:http";

/**
 * A local stand-in for the Open Food Facts API (the real one isn't reachable from tests). Started once for the whole
 * run by global-setup.ts on E2E_OFF_MOCK_PORT; the app must run with OFF_API_BASE_URL pointing at it.
 * It answers GET /api/v2/product/<code>.json, GET /api/v2/search?categories_tags=<tag> and GET /cgi/search.pl?search_terms=<words>.
 */

/** The protein bar used by the food-amounts journey. */
export const BAR_CODE = "0012345678905";

/** Food IQ fixtures (valid EAN-13 codes that aren't real products). */
export const Q = {
  honey: "5000000000012",
  oat: "5000000000029",
  choco: "5000000000036",
  rice: "5000000000043",
  cola: "5000000000050",
  mystery: "5000000000067",
  // Food IQ fixtures (fictional products with typical values).
  water: "5000000000074",
  zero: "5000000000081",
  oil: "5000000000098",
  yogurt: "5000000000104",
  bar: "5000000000111",
  leanBar: "5000000000128",
  ham: "5000000000135",
} as const;

const img = (code: string) => `https://images.openfoodfacts.org/images/products/${code}/front_en.200.jpg`;
const cereal = (code: string, name: string, grade: string, nova: number, n: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  code,
  product_name: name,
  brands: "Morning Co",
  quantity: "500 g",
  serving_size: "40 g",
  serving_quantity: 40,
  nutriments: { "energy-kcal_100g": 380, proteins_100g: 8, carbohydrates_100g: 78, fat_100g: 4, "saturated-fat_100g": 1, salt_100g: 0.7, ...n },
  nutriscore_grade: grade,
  nova_group: nova,
  categories_tags: ["en:plant-based-foods", "en:cereals-and-potatoes", "en:breakfast-cereals"],
  image_front_small_url: img(code),
  ...extra,
});

export const PRODUCTS: Record<string, Record<string, unknown>> = {
  [BAR_CODE]: {
    code: BAR_CODE,
    product_name: "Peanut Protein Bar",
    brands: "Test Foods",
    quantity: "4 x 60 g",
    serving_size: "1 bar (60 g)",
    serving_quantity: 60,
    nutriments: { "energy-kcal_100g": 350, proteins_100g: 33.3, carbohydrates_100g: 40, fat_100g: 11.7, fiber_100g: 10, sugars_100g: 5, sodium_100g: 0.4 },
  },
  [Q.honey]: cereal(Q.honey, "Honey Crunch", "d", 4, { sugars_100g: 30, fiber_100g: 3.5 }, {
    ingredients_text: "Wheat flour, sugar, glucose syrup, honey (3%), salt, emulsifier: soy lecithin (E322), sweetener: aspartame (E951)",
    allergens_tags: ["en:gluten", "en:soybeans"],
    traces_tags: ["en:nuts"],
    additives_tags: ["en:e322", "en:e951"],
    ingredients_analysis_tags: ["en:palm-oil-free", "en:non-vegan", "en:vegetarian"],
    labels_tags: ["en:no-artificial-colours"],
  }),
  [Q.oat]: cereal(Q.oat, "Oat Hoops", "b", 3, { sugars_100g: 12, fiber_100g: 8 }, {
    ingredients_text: "Wholegrain oats, wheat flour, sugar, salt",
    allergens_tags: ["en:gluten"],
    ingredients_analysis_tags: ["en:vegan", "en:vegetarian"],
  }),
  [Q.choco]: cereal(Q.choco, "Choco Puffs", "d", 4, { sugars_100g: 29, fiber_100g: 3 }, { ingredients_text: "Wheat, sugar, cocoa", allergens_tags: ["en:gluten"] }),
  [Q.rice]: cereal(Q.rice, "Rice Flakes", "a", 3, { sugars_100g: 5, fiber_100g: 4, salt_100g: 0.2 }, {
    ingredients_text: "Rice, salt",
    allergens_tags: [],
    ingredients_analysis_tags: ["en:vegan", "en:vegetarian"],
  }),
  [Q.cola]: {
    code: Q.cola,
    product_name: "Cola Classic",
    brands: "Fizz",
    quantity: "330 ml",
    serving_size: "330 ml",
    serving_quantity: 330,
    serving_quantity_unit: "ml",
    nutriments: { "energy-kcal_100g": 42, carbohydrates_100g: 10.6, sugars_100g: 10.6, proteins_100g: 0, fat_100g: 0, salt_100g: 0 },
    nutriscore_grade: "e",
    nova_group: 4,
    categories_tags: ["en:beverages", "en:sodas"],
    ingredients_text: "Carbonated water, sugar, colour: E150d, acid: E338, natural flavourings, caffeine",
    additives_tags: ["en:e150d", "en:e338"],
  },
  [Q.mystery]: { code: Q.mystery, product_name: "Mystery Snack", brands: "Unknown Brand" },
  [Q.water]: {
    code: Q.water,
    product_name: "Clear Spring Still Water",
    brands: "Clear Spring",
    quantity: "500 ml",
    serving_size: "500 ml",
    serving_quantity: 500,
    serving_quantity_unit: "ml",
    nutriments: { "energy-kcal_100g": 0, proteins_100g: 0, carbohydrates_100g: 0, sugars_100g: 0, fat_100g: 0, "saturated-fat_100g": 0, salt_100g: 0.01 },
    nutriscore_grade: "a",
    nova_group: 1,
    categories_tags: ["en:beverages", "en:waters", "en:spring-waters"],
    ingredients_text: "Natural spring water",
    allergens_tags: [],
    ingredients_analysis_tags: ["en:vegan", "en:vegetarian", "en:palm-oil-free"],
  },
  [Q.zero]: {
    code: Q.zero,
    product_name: "Cola Zero Sugar",
    brands: "Fizz",
    quantity: "330 ml",
    serving_size: "330 ml",
    serving_quantity: 330,
    serving_quantity_unit: "ml",
    nutriments: { "energy-kcal_100g": 0.3, proteins_100g: 0, carbohydrates_100g: 0, sugars_100g: 0, fat_100g: 0, "saturated-fat_100g": 0, salt_100g: 0.02 },
    nutriscore_grade: "b",
    nova_group: 4,
    categories_tags: ["en:beverages", "en:sodas", "en:diet-sodas"],
    ingredients_text: "Carbonated water, colour: E150d, acids: E338, E331, sweeteners: aspartame (E951), acesulfame K (E950), natural flavourings, caffeine",
    additives_tags: ["en:e150d", "en:e338", "en:e331", "en:e951", "en:e950"],
    allergens_tags: [],
    ingredients_analysis_tags: ["en:vegan", "en:vegetarian"],
  },
  [Q.oil]: {
    code: Q.oil,
    product_name: "Grove Extra Virgin Olive Oil",
    brands: "Grove",
    quantity: "500 ml",
    serving_size: "1 tbsp (14 g)",
    serving_quantity: 14,
    nutriments: { "energy-kcal_100g": 884, proteins_100g: 0, carbohydrates_100g: 0, sugars_100g: 0, fat_100g: 100, "saturated-fat_100g": 14, salt_100g: 0 },
    nutriscore_grade: "b",
    nova_group: 2,
    categories_tags: ["en:plant-based-foods", "en:fats", "en:vegetable-fats", "en:vegetable-oils", "en:olive-oils"],
    ingredients_text: "Extra virgin olive oil",
    allergens_tags: [],
    ingredients_analysis_tags: ["en:vegan", "en:vegetarian", "en:palm-oil-free"],
  },
  [Q.yogurt]: {
    code: Q.yogurt,
    product_name: "Plain Greek Yogurt 0%",
    brands: "Meadow",
    quantity: "500 g",
    serving_size: "150 g",
    serving_quantity: 150,
    nutriments: { "energy-kcal_100g": 59, proteins_100g: 10.2, carbohydrates_100g: 3.6, sugars_100g: 3.2, fat_100g: 0.4, "saturated-fat_100g": 0.1, fiber_100g: 0, salt_100g: 0.09 },
    nutriscore_grade: "a",
    nova_group: 1,
    categories_tags: ["en:dairies", "en:fermented-foods", "en:yogurts", "en:greek-style-yogurts"],
    ingredients_text: "Pasteurised skimmed milk, live cultures",
    allergens_tags: ["en:milk"],
    ingredients_analysis_tags: ["en:non-vegan", "en:vegetarian", "en:palm-oil-free"],
  },
  [Q.bar]: {
    code: Q.bar,
    product_name: "Peak Protein Bar Chocolate",
    brands: "Peak",
    quantity: "60 g",
    serving_size: "1 bar (60 g)",
    serving_quantity: 60,
    nutriments: { "energy-kcal_100g": 360, proteins_100g: 33, carbohydrates_100g: 33, sugars_100g: 4, fat_100g: 13, "saturated-fat_100g": 6.5, fiber_100g: 12, salt_100g: 0.6 },
    nutriscore_grade: "c",
    nova_group: 4,
    categories_tags: ["en:snacks", "en:sweet-snacks", "en:bars", "en:protein-bars"],
    ingredients_text: "Milk protein, collagen hydrolysate, humectant: maltitol (E965), cocoa butter, soluble fibre, cocoa mass, emulsifier: soy lecithin (E322), salt, flavouring, sweetener: sucralose (E955)",
    additives_tags: ["en:e965", "en:e322", "en:e955"],
    allergens_tags: ["en:milk", "en:soybeans"],
    traces_tags: ["en:nuts", "en:peanuts"],
    ingredients_analysis_tags: ["en:non-vegan", "en:maybe-vegetarian", "en:palm-oil-free"],
  },
  [Q.leanBar]: {
    code: Q.leanBar,
    product_name: "Lean Protein Bar Vanilla",
    brands: "Peak",
    quantity: "55 g",
    serving_size: "1 bar (55 g)",
    serving_quantity: 55,
    nutriments: { "energy-kcal_100g": 330, proteins_100g: 36, carbohydrates_100g: 30, sugars_100g: 3, fat_100g: 9, "saturated-fat_100g": 3, fiber_100g: 15, salt_100g: 0.4 },
    nutriscore_grade: "b",
    nova_group: 4,
    categories_tags: ["en:snacks", "en:sweet-snacks", "en:bars", "en:protein-bars"],
    ingredients_text: "Milk protein, soluble fibre, almonds, rapeseed oil, natural flavouring, salt, sweetener: steviol glycosides (E960)",
    additives_tags: ["en:e960"],
    allergens_tags: ["en:milk", "en:nuts"],
    ingredients_analysis_tags: ["en:non-vegan", "en:vegetarian", "en:palm-oil-free"],
  },
  [Q.ham]: {
    code: Q.ham,
    product_name: "Smoked Ham Slices",
    brands: "Farmhouse",
    quantity: "120 g",
    serving_size: "2 slices (40 g)",
    serving_quantity: 40,
    nutriments: { "energy-kcal_100g": 107, proteins_100g: 18, carbohydrates_100g: 1.2, sugars_100g: 1, fat_100g: 3.4, "saturated-fat_100g": 1.1, fiber_100g: 0, salt_100g: 2.2 },
    nutriscore_grade: "d",
    nova_group: 4,
    categories_tags: ["en:meats", "en:prepared-meats", "en:hams"],
    ingredients_text: "Pork (90%), water, salt, dextrose, stabiliser: triphosphates (E451), antioxidant: sodium ascorbate (E301), preservative: sodium nitrite (E250), smoke",
    additives_tags: ["en:e451", "en:e301", "en:e250"],
    allergens_tags: [],
    ingredients_analysis_tags: ["en:non-vegan", "en:non-vegetarian", "en:palm-oil-free"],
  },
};

export function startOffMock(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = new URL(req.url ?? "/", "http://localhost");
    const code = url.pathname.match(/^\/api\/v2\/product\/(\d+)\.json$/)?.[1];
    if (code) {
      const product = PRODUCTS[code];
      if (!product) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: 0, status_verbose: "product not found" }));
        return;
      }
      res.end(JSON.stringify({ code, status: 1, product }));
      return;
    }
    if (url.pathname === "/cgi/search.pl") {
      // Full-text product search: every word must appear in the name or brand.
      const words = (url.searchParams.get("search_terms") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const products = Object.values(PRODUCTS).filter((p) => {
        const hay = `${p.product_name ?? ""} ${p.brands ?? ""}`.toLowerCase();
        return words.length > 0 && words.every((w) => hay.includes(w));
      });
      res.end(JSON.stringify({ count: products.length, page: 1, page_size: 20, products }));
      return;
    }
    if (url.pathname === "/api/v2/search") {
      const tag = url.searchParams.get("categories_tags") ?? "";
      const products = Object.values(PRODUCTS).filter((p) => Array.isArray(p.categories_tags) && (p.categories_tags as string[]).includes(tag));
      res.end(JSON.stringify({ count: products.length, page: 1, page_size: 24, products }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ status: 0 }));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
