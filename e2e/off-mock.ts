import { createServer, type Server } from "node:http";

/**
 * A local stand-in for the Open Food Facts API (the real one isn't reachable from tests). Started once for the whole
 * run by global-setup.ts on E2E_OFF_MOCK_PORT; the app must run with OFF_API_BASE_URL pointing at it.
 * It answers GET /api/v2/product/<code>.json and GET /api/v2/search?categories_tags=<tag>.
 */

/** The protein bar used by the food-amounts journey. */
export const BAR_CODE = "0012345678905";

/** Food Quality Scanner fixtures (valid EAN-13 codes that aren't real products). */
export const Q = {
  honey: "5000000000012",
  oat: "5000000000029",
  choco: "5000000000036",
  rice: "5000000000043",
  cola: "5000000000050",
  mystery: "5000000000067",
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
