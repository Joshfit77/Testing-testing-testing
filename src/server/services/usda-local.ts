import "server-only";
import { prepareEntry, rankFoods, tokenize, type SearchEntry } from "@/lib/domain/food-search";
import type { FoodBasis } from "@/lib/domain/food-basis";
import { POPULAR_FOODS } from "@/data/popular-foods";

/**
 * Offline USDA FoodData Central SR Legacy database (public domain; 7,448 foods, nutrients per 100 g with
 * USDA household portions). The ~1 MB JSON is loaded lazily on the server the first time it's needed and
 * is never sent to the browser — search results carry only the foods they return.
 */

type RawFood = [number, string, number, number, number, number, number, number | null, number | null, number | null, [string, number][]];
interface RawDb {
  v: number;
  source: string;
  cats: string[];
  foods: RawFood[];
}

export interface LocalFood {
  fdcId: number;
  /** USDA description, or the friendly name for a popular food. */
  name: string;
  /** The USDA description (same as `name` unless this is a popular food). */
  usdaName: string;
  popular?: boolean;
  category: string;
  catIndex: number;
  basis: FoodBasis;
}

interface Index {
  cats: string[];
  foods: LocalFood[];
  entries: SearchEntry[];
  byId: Map<number, number>;
  popular: { food: LocalFood; entry: SearchEntry }[];
}

/** Deli, fast-food, restaurant and regional entries sort after the plain food unless they match better. */
const CATEGORY_BOOST: Record<string, number> = {
  "Sausages and Luncheon Meats": -10,
  "Fast Foods": -10,
  "Restaurant Foods": -10,
  "American Indian/Alaska Native Foods": -10,
};

let indexPromise: Promise<Index> | null = null;

function loadIndex(): Promise<Index> {
  indexPromise ??= import("@/data/usda-foods.json").then((mod) => {
    const db = ((mod as { default?: unknown }).default ?? mod) as RawDb;
    const foods: LocalFood[] = db.foods.map(([fdcId, name, cat, kcal, p, c, f, fiber, sugar, sodium, portions]) => ({
      fdcId,
      name,
      usdaName: name,
      catIndex: cat,
      category: db.cats[cat] ?? "",
      basis: {
        per100: { calories: kcal, protein_g: p, carbs_g: c, fat_g: f, fiber_g: fiber, sugar_g: sugar, sodium_mg: sodium },
        portions: portions.map(([label, grams]) => ({ label, grams })),
      },
    }));
    const entries = foods.map((f) => prepareEntry(f.name, CATEGORY_BOOST[f.category] ?? 0));
    const byId = new Map(foods.map((f, i) => [f.fdcId, i]));
    const popular = POPULAR_FOODS.flatMap((p) => {
      const i = byId.get(p.fdcId);
      if (i == null) return [];
      // Extra search words go in a trailing segment so they match but don't outrank the name itself.
      return [{ food: { ...foods[i]!, name: p.name, popular: true }, entry: prepareEntry(p.also ? `${p.name}, ${p.also}` : p.name, 15) }];
    });
    return { cats: db.cats, foods, entries, byId, popular };
  });
  return indexPromise;
}

export async function usdaCategories(): Promise<string[]> {
  return (await loadIndex()).cats;
}

/** One food by FoodData Central id (with its friendly name when it's a popular food). */
export async function getLocalFood(fdcId: number): Promise<LocalFood | null> {
  const idx = await loadIndex();
  const pop = idx.popular.find((p) => p.food.fdcId === fdcId);
  if (pop) return pop.food;
  const i = idx.byId.get(fdcId);
  return i == null ? null : idx.foods[i]!;
}

/** Everyday foods (friendly names), in their curated order — shown when the search box is empty. */
export async function popularFoods(): Promise<LocalFood[]> {
  return (await loadIndex()).popular.map((p) => p.food);
}

/**
 * Food search: matching popular foods first (friendly names, e.g. "Egg, whole, large (raw)" before
 * eggnog), then the rest of the USDA database by rank, without duplicates.
 */
export async function searchUsda(query: string, limit = 30): Promise<LocalFood[]> {
  const idx = await loadIndex();
  const popular = rankFoods(idx.popular, query, (p) => p.entry, 10).map((p) => p.food);
  const seen = new Set(popular.map((f) => f.fdcId));
  const rest = (await searchLocalFoods(query, { limit: limit + seen.size })).filter((f) => !seen.has(f.fdcId));
  return [...popular, ...rest].slice(0, Math.max(limit, popular.length));
}

/** Ranked search across all foods, or within one category when `catIndex` is given. */
export async function searchLocalFoods(query: string, opts: { catIndex?: number; limit?: number } = {}): Promise<LocalFood[]> {
  const idx = await loadIndex();
  const pool = opts.catIndex == null ? idx.foods.map((_, i) => i) : idx.foods.flatMap((f, i) => (f.catIndex === opts.catIndex ? [i] : []));
  return rankFoods(pool, query, (i) => idx.entries[i]!, opts.limit ?? 30).map((i) => idx.foods[i]!);
}

/**
 * Browse one category alphabetically (optionally narrowed by a query, then ranked), paginated.
 * Returns the page and the total count.
 */
export async function browseCategory(catIndex: number, query: string, offset: number, limit: number): Promise<{ foods: LocalFood[]; total: number }> {
  const idx = await loadIndex();
  if (tokenize(query).length) {
    const all = await searchLocalFoods(query, { catIndex, limit: 10_000 });
    return { foods: all.slice(offset, offset + limit), total: all.length };
  }
  const all = idx.foods.filter((f) => f.catIndex === catIndex);
  return { foods: all.slice(offset, offset + limit), total: all.length };
}
