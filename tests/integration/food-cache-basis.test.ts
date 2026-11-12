import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { basisFromFoodRow, computeAmount, incompleteMacros, type FoodBasis } from "@/lib/domain/food-basis";
import type { BarcodeProduct } from "@/lib/open-food-facts";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * N5: a barcode product cached in `foods` keeps the basis it was looked up with (foods.basis, migration
 * 20261112000059), so re-logging it from My foods keeps its `missing` list, sugar, sodium and label serving; a foods
 * row without a basis logs exactly as before. Open Food Facts is stubbed (no network); the member's session is real.
 */
let current: SupabaseClient;
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const CODE = "3017620422003";
const product: BarcodeProduct = {
  code: CODE,
  name: "Integration hazelnut spread",
  brand: "IT",
  quantity: "400 g",
  servingLabel: "1 tbsp (15 g)",
  servingQuantity: 15,
  unit: "g",
  // No protein on the label: stored as 0 in the columns, listed as missing in the basis.
  per100: { calories: 539, protein_g: 0, carbs_g: 57.5, fat_g: 30.9, fiber_g: null, sugar_g: 56.3, sodium_mg: 41 },
  perServing: null,
  missing: ["protein"],
};
vi.mock("@/server/services/open-food-facts", async (original) => ({
  ...(await original<typeof import("@/server/services/open-food-facts")>()),
  lookupBarcode: async () => ({ status: "found", product }),
}));

const available = await stackAvailable();

type ItemRow = { id: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; sugar_g: number | null; sodium_mg: number | null; amount_label: string; basis: FoodBasis };
const ITEM = "id, calories, protein_g, carbs_g, fat_g, sugar_g, sodium_mg, amount_label, basis";

describe.skipIf(!available)("cached foods keep their full nutrition basis", () => {
  let user: TestUser;
  const svc = serviceClient();
  const date = "2026-11-12";

  beforeAll(async () => {
    user = await createTestUser("food-cache-basis");
    current = user.client;
  });
  afterAll(async () => deleteTestUser(user));

  const item = async (id: string) => (await svc.from("meal_items").select(ITEM).eq("id", id).single()).data as ItemRow;

  it("a barcode food cached with missing macros, re-logged from My foods, keeps missing, sugar, sodium and serving", async () => {
    const { logFoodAction } = await import("@/server/actions/nutrition");
    const scanned = await logFoodAction({ date, mealType: "breakfast", status: "logged", item: { source: "barcode", code: CODE, quantity: 1, unitId: "serving" } });
    expect(scanned.ok).toBe(true);

    const { data: cached } = await svc.from("foods").select("id, protein_g, basis").eq("owner_id", user.id).eq("source", "openfoodfacts").eq("source_ref", CODE).single();
    expect(Number(cached!.protein_g)).toBe(0);
    expect((cached!.basis as FoodBasis).missing).toEqual(["protein_g"]);

    const relogged = await logFoodAction({ date, mealType: "snack", status: "logged", item: { source: "food", foodId: cached!.id, quantity: 1, unitId: "serving" } });
    expect(relogged.ok).toBe(true);
    const [first, again] = await Promise.all([item(scanned.itemIds![0]!), item(relogged.itemIds![0]!)]);
    expect(again.basis.missing).toEqual(["protein_g"]);
    expect(again.basis.per100.sugar_g).toBe(56.3);
    expect(again.basis.per100.sodium_mg).toBe(41);
    expect(again.basis.servingGrams).toBe(15);
    expect(again.basis.servingLabel).toBe("1 tbsp (15 g)");
    expect(again.amount_label).toBe(first.amount_label);
    expect(Number(again.sugar_g)).toBe(Number(first.sugar_g));
    expect(Number(again.sodium_mg)).toBe(Number(first.sodium_mg));
    expect(Number(again.calories)).toBe(Number(first.calories));
    // The day's totals still read "at least" for protein.
    expect(incompleteMacros([again])).toEqual(["protein_g"]);
  });

  it("an old foods row without a basis still logs exactly as before (rebuilt from its columns)", async () => {
    const { logFoodAction } = await import("@/server/actions/nutrition");
    const old = { owner_id: user.id, name: "Old cached bar", serving_size: 100, serving_unit: "g", calories: 400, protein_g: 0, carbs_g: 60, fat_g: 15, fiber_g: 3, source: "openfoodfacts", source_ref: "5000000000001", is_estimate: false };
    const { data: food, error } = await user.client.from("foods").insert(old).select("id, basis").single();
    expect(error).toBeNull();
    expect(food!.basis).toBeNull();

    const res = await logFoodAction({ date, mealType: "lunch", status: "logged", item: { source: "food", foodId: food!.id, quantity: 50, unitId: "g" } });
    expect(res.ok).toBe(true);
    const row = await item(res.itemIds![0]!);
    const expected = computeAmount(basisFromFoodRow(old), 50, "g")!;
    expect(row.basis).toEqual(basisFromFoodRow(old));
    expect(row.basis.missing).toBeUndefined();
    expect(Number(row.calories)).toBe(expected.nutrition.calories);
    expect(Number(row.protein_g)).toBe(expected.nutrition.protein_g);
    expect(Number(row.carbs_g)).toBe(expected.nutrition.carbs_g);
    expect(Number(row.fat_g)).toBe(expected.nutrition.fat_g);
    expect(row.amount_label).toBe(expected.amountLabel);
  });

  it("the database refuses a basis that isn't an object with per100", async () => {
    const base = { owner_id: user.id, name: "Bad basis", serving_size: 100, serving_unit: "g", calories: 1, source: "custom" };
    expect((await user.client.from("foods").insert({ ...base, basis: [1, 2] })).error).not.toBeNull();
    expect((await user.client.from("foods").insert({ ...base, basis: { calories: 1 } })).error).not.toBeNull();
  });
});
