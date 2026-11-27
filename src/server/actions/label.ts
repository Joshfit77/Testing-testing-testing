"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FoodBasis } from "@/lib/domain/food-basis";
import { isLoggableDate } from "@/lib/domain/food-photo";
import { mealTypeSchema } from "@/lib/validation/schemas";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { amountColumns, findOrCreateMeal, LIMITS_ERROR, withinLimits } from "@/server/services/diary-write";
import { isRepeatOf } from "@/server/services/idempotency";
import { logError } from "@/server/log";

type Result = { ok: true; message: string } | { ok: false; error: string };

const per = (max: number) => z.number().min(0).max(max);
const labelFoodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: mealTypeSchema,
  /** Made on the device once per check: a retried or double-sent save can't log the food twice. */
  clientId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  nutrition: z.object({
    basis: z.enum(["100g", "100ml", "serving"]),
    servingGrams: z.number().positive().max(5000).nullable(),
    calories: per(5000),
    protein_g: per(500),
    carbs_g: per(1000),
    fat_g: per(500),
    fiber_g: per(500).nullable(),
    sugars_g: per(1000).nullable(),
    salt_g: per(100).nullable(),
  }),
  quantity: z.number().positive().max(100_000),
  unitId: z.enum(["g", "ml", "serving"]),
});

/** The label's values as a food basis the diary already understands (per 100 g/ml, or per serving). */
function basisFromLabel(n: z.infer<typeof labelFoodSchema>["nutrition"]): FoodBasis {
  const values = { calories: n.calories, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, fiber_g: n.fiber_g, sugar_g: n.sugars_g, sodium_mg: n.salt_g == null ? null : Math.round(n.salt_g * 400) };
  const servingLabel = n.servingGrams ? `${n.servingGrams} ${n.basis === "100ml" ? "ml" : "g"}` : null;
  if (n.basis === "serving") return { per100: values, servingOnly: true, servingLabel };
  return { per100: values, servingGrams: n.servingGrams, servingLabel, liquid: n.basis === "100ml" };
}

/**
 * Log a food from a label the member checked: the values are the label's (typed or read from a photo and corrected
 * by the member), and the amount is computed here from them, never taken from the device.
 */
export async function logLabelFoodAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  try {
    await assertFeature(user.id, "nutrition_tracking");
  } catch (err) {
    if (err instanceof EntitlementError) return { ok: false, error: "Food logging isn't available on your account right now." };
    throw err;
  }
  const parsed = labelFoodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a name, the label's calories, protein, carbs and fat, and how much you had." };
  const { date, mealType, clientId, name, nutrition, quantity, unitId } = parsed.data;
  if (!isLoggableDate(date)) return { ok: false, error: "Choose today or an earlier day." };
  const cols = amountColumns(basisFromLabel(nutrition), quantity, unitId);
  if (!cols) return { ok: false, error: nutrition.basis === "serving" ? "These values are per serving: enter how many servings you had." : "Enter the amount in the units the label uses." };
  if (!withinLimits(cols)) return { ok: false, error: LIMITS_ERROR };

  const supabase = await getServerSupabase();
  try {
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, "logged");
    const row = { ...cols, amount_label: `${cols.amount_label ?? ""} (from a label you checked)`.trim().slice(0, 160) };
    const { error } = await supabase
      .from("meal_items")
      .insert({ meal_id: mealId, user_id: user.id, client_id: clientId ?? null, food_id: null, name: name.slice(0, 160), is_estimate: false, source: "custom", ...row });
    if (isRepeatOf(error, clientId)) return { ok: true, message: `Added ${name} to ${mealType}.` };
    if (error) throw error;
  } catch (err) {
    logError("label.log", err);
    return { ok: false, error: "Couldn't add it to your diary. Try again." };
  }
  revalidatePath("/nutrition");
  revalidatePath("/home");
  return { ok: true, message: `Added ${name} to ${mealType}.` };
}
