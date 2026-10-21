import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { barcodeLookupCandidates } from "@/lib/barcode";
import { basisFromFoodRow, basisUnits, type FoodBasis } from "@/lib/domain/food-basis";
import { basisFromOffProduct } from "@/lib/open-food-facts";
import { isFoodSearchConfigured } from "@/server/env";
import { getFood } from "@/server/services/food-database";
import { lookupBarcode } from "@/server/services/open-food-facts";
import { getLocalFood } from "@/server/services/usda-local";

/**
 * The one place a picked food's nutrition is read on the server (SPEC §8 "one consistent nutrition
 * calculation system"). The diary (logFoodAction) and recipe ingredients both call it, so a food always
 * gets the same basis whichever screen it was picked on. Nutrition from the client is never trusted.
 */

const uuid = z.string().uuid();
export const amountFields = { quantity: z.number().positive().max(100_000), unitId: z.string().regex(/^(g|oz|lb|ml|floz|serving|p\d{1,2})$/) };

/** A food picked from search, a barcode, or the user's saved foods, with the amount chosen. */
export const pickedFoodSchema = z.discriminatedUnion("source", [
  // `servings` is the older shape (a multiple of the food's serving).
  z.object({ source: z.literal("food"), foodId: uuid, quantity: amountFields.quantity.optional(), unitId: amountFields.unitId.optional(), servings: z.number().positive().max(100).optional() }),
  z.object({ source: z.literal("usda"), fdcId: z.string().regex(/^\d{1,10}$/), ...amountFields }),
  z.object({ source: z.literal("barcode"), code: z.string().regex(/^\d{8,14}$/), format: z.enum(["ean13", "upca", "upce", "ean8"]).optional(), ...amountFields }),
]);
export type PickedFood = z.infer<typeof pickedFoodSchema>;

export interface ResolvedFood {
  basis: FoodBasis;
  food_id: string | null;
  name: string;
  is_estimate: boolean;
  /** Stable key: usda:<fdcId>, off:<barcode> or food:<uuid>. */
  source: string;
  quantity: number;
  unitId: string;
}

export type ResolveResult = { ok: true; food: ResolvedFood } | { ok: false; error: string };

export async function resolvePickedFood(supabase: SupabaseClient, userId: string, item: PickedFood): Promise<ResolveResult> {
  if (item.source === "food") {
    const { data: food } = await supabase.from("foods").select("*").eq("id", item.foodId).maybeSingle();
    if (!food) return { ok: false, error: "Food not found." };
    const basis = basisFromFoodRow(food as Parameters<typeof basisFromFoodRow>[0]);
    let quantity: number;
    let unitId: string;
    if (item.quantity != null && item.unitId) {
      quantity = item.quantity;
      unitId = item.unitId;
    } else {
      // Older clients: N servings of the food.
      quantity = item.servings ?? 1;
      unitId = basisUnits(basis).some((u) => u.id === "serving") ? "serving" : "g";
      if (unitId === "g") quantity *= Number(food.serving_size);
    }
    return {
      ok: true,
      food: { basis, food_id: food.id as string, name: food.name as string, is_estimate: Boolean(food.is_estimate), source: `food:${food.id as string}`, quantity, unitId },
    };
  }
  if (item.source === "usda") {
    const local = await getLocalFood(Number(item.fdcId));
    if (local) return { ok: true, food: { basis: local.basis, food_id: null, name: local.name, is_estimate: false, source: `usda:${local.fdcId}`, quantity: item.quantity, unitId: item.unitId } };
    if (!isFoodSearchConfigured()) return { ok: false, error: "That food isn't in the food database." };
    const ext = await getFood(item.fdcId);
    if (!ext) return { ok: false, error: "That food couldn't be loaded from the food database." };
    const { data: cached, error: cErr } = await supabase
      .from("foods")
      .upsert(
        {
          owner_id: userId,
          name: ext.name.slice(0, 160),
          brand: ext.brand?.slice(0, 120) ?? null,
          serving_size: 100,
          serving_unit: "g",
          calories: ext.calories,
          protein_g: ext.protein_g,
          carbs_g: ext.carbs_g,
          fat_g: ext.fat_g,
          fiber_g: ext.fiber_g,
          source: "usda",
          source_ref: ext.fdcId,
          is_estimate: false,
        },
        { onConflict: "owner_id,source,source_ref" },
      )
      .select("id")
      .single();
    if (cErr) throw cErr;
    return {
      ok: true,
      food: {
        basis: { per100: { calories: ext.calories, protein_g: ext.protein_g, carbs_g: ext.carbs_g, fat_g: ext.fat_g, fiber_g: ext.fiber_g } },
        food_id: cached.id as string,
        name: ext.name,
        is_estimate: false,
        source: `usda:${ext.fdcId}`,
        quantity: item.quantity,
        unitId: item.unitId,
      },
    };
  }
  const candidates = barcodeLookupCandidates(item.code, item.format);
  if (!candidates) return { ok: false, error: "That barcode isn't valid." };
  // Re-fetch from Open Food Facts server-side — never trust client-supplied nutrition numbers.
  const found = await lookupBarcode(candidates);
  if (found.status !== "found") return { ok: false, error: "That product has no nutrition info in Open Food Facts. Enter it manually." };
  const p = found.product;
  const basis = basisFromOffProduct(p);
  // Cache per 100 g/ml when available, otherwise per label serving, so it shows up in My foods.
  const base = p.per100 ? { size: 100, unit: p.unit as string, v: p.per100 } : { size: 1, unit: "serving", v: p.perServing! };
  const { data: cached, error: cErr } = await supabase
    .from("foods")
    .upsert(
      {
        owner_id: userId,
        name: p.name.slice(0, 160),
        brand: p.brand?.slice(0, 120) ?? null,
        serving_size: base.size,
        serving_unit: base.unit,
        calories: base.v.calories,
        protein_g: base.v.protein_g,
        carbs_g: base.v.carbs_g,
        fat_g: base.v.fat_g,
        fiber_g: base.v.fiber_g,
        source: "openfoodfacts",
        source_ref: p.code,
        // Crowd-sourced label data, not a guess; the UI labels it "Open Food Facts (community data) — check the label".
        is_estimate: false,
      },
      { onConflict: "owner_id,source,source_ref" },
    )
    .select("id")
    .single();
  if (cErr) throw cErr;
  return {
    ok: true,
    food: { basis, food_id: cached.id as string, name: p.brand ? `${p.name} (${p.brand})` : p.name, is_estimate: false, source: `off:${p.code}`, quantity: item.quantity, unitId: item.unitId },
  };
}
