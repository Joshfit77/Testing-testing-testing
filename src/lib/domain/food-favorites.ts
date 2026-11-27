import { sanitizeBasis, type FoodChoice } from "@/lib/domain/food-basis";

/**
 * Stable keys for favorited foods — the same format meal_items.source uses:
 * "usda:<fdcId>", "off:<barcode>", "food:<uuid>". Hand-entered entries ("custom") have no stable
 * identity and can't be favorited.
 */
export const FAVORITE_KEY_PATTERN = /^(usda:[0-9]{1,10}|off:[0-9]{8,14}|food:[0-9a-f-]{36})$/;

export function isFavoritableKey(key: string | null | undefined): key is string {
  return typeof key === "string" && FAVORITE_KEY_PATTERN.test(key);
}

export interface FavoriteRow {
  food_key: string;
  name: string;
  detail: string | null;
  basis: unknown;
  is_estimate: boolean;
}

/** Turns a stored favorite into a pickable food (null when the row is malformed). */
export function choiceFromFavorite(row: FavoriteRow): FoodChoice | null {
  if (!isFavoritableKey(row.food_key)) return null;
  const basis = sanitizeBasis(row.basis);
  if (!basis) return null;
  const sep = row.food_key.indexOf(":");
  const prefix = row.food_key.slice(0, sep) as "usda" | "off" | "food";
  return {
    key: row.food_key,
    kind: prefix,
    ref: row.food_key.slice(sep + 1),
    name: row.name,
    detail: row.detail ?? undefined,
    basis,
    isEstimate: row.is_estimate,
  };
}

/** The payload logFoodAction expects for a picked food (nutrition is re-read on the server). */
export function logItemFor(food: Pick<FoodChoice, "kind" | "ref" | "format">, quantity: number, unitId: string) {
  return food.kind === "usda"
    ? { source: "usda" as const, fdcId: food.ref, quantity, unitId }
    : food.kind === "off"
      ? { source: "barcode" as const, code: food.ref, format: food.format, quantity, unitId }
      : { source: "food" as const, foodId: food.ref, quantity, unitId };
}
