"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mealTypeSchema } from "@/lib/validation/schemas";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertFeature, EntitlementError, getUserPlan, requireUser } from "@/server/auth";
import { getAiAllowance } from "@/server/services/ai-coach";
import { amountColumns, findOrCreateMeal, LIMITS_ERROR, withinLimits, type MealItemRow } from "@/server/services/diary-write";
import { pickedFoodSchema, resolvePickedFood } from "@/server/services/food-resolve";
import { logError } from "@/server/log";

type Result = { ok: true; message: string } | { ok: false; error: string };

/** Food photos are part of the AI features: Pro, or a subscription that kept its AI allowance. */
async function hasAi(userId: string): Promise<boolean> {
  return (await getAiAllowance(userId, await getUserPlan(userId))).chatLimit > 0;
}

/** Agree (or stop agreeing) to send meal photos to the AI provider. Withdrawing always works. */
export async function setFoodPhotoConsentAction(agreed: unknown): Promise<Result> {
  const user = await requireUser();
  if (typeof agreed !== "boolean") return { ok: false, error: "Invalid choice." };
  if (agreed && !(await hasAi(user.id))) return { ok: false, error: "Food photo analysis is included with Pro." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ food_photo_consent_at: agreed ? new Date().toISOString() : null }).eq("id", user.id);
  if (error) {
    logError("food_photo.consent", error);
    return { ok: false, error: "Couldn't save that. Try again." };
  }
  revalidatePath("/nutrition/photo");
  return { ok: true, message: agreed ? "Thanks. You can analyse a meal photo." : "Meal photos won't be sent to the AI." };
}

const estimateItem = z.object({
  kind: z.literal("estimate"),
  name: z.string().trim().min(1).max(120),
  portion: z.string().trim().max(120).optional().default(""),
  grams: z.number().positive().max(3000).nullable(),
  calories: z.number().min(0).max(4000),
  protein_g: z.number().min(0).max(300),
  carbs_g: z.number().min(0).max(500),
  fat_g: z.number().min(0).max(300),
});
const databaseItem = z.object({ kind: z.literal("database"), picked: pickedFoodSchema });

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: mealTypeSchema,
  items: z.array(z.discriminatedUnion("kind", [estimateItem, databaseItem])).min(1).max(15),
});

/**
 * Log the items the member confirmed. Photo estimates are saved as estimates ("photo" source); items matched to a
 * database food are recomputed on the server from that food, never trusted from the client.
 */
export async function logFoodPhotoItemsAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  try {
    await assertFeature(user.id, "nutrition_tracking");
  } catch (err) {
    if (err instanceof EntitlementError) return { ok: false, error: "Food logging isn't available on your account right now." };
    throw err;
  }
  if (!(await hasAi(user.id))) return { ok: false, error: "Food photo analysis is included with Pro." };
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the items: every one needs a name and calories and macros within range." };
  const { date, mealType, items } = parsed.data;
  const supabase = await getServerSupabase();

  const rows: MealItemRow[] = [];
  for (const item of items) {
    if (item.kind === "estimate") {
      const amount = item.portion || (item.grams ? `${item.grams} g` : "");
      rows.push({
        food_id: null,
        name: item.name,
        servings: 1,
        is_estimate: true,
        calories: Math.round(item.calories),
        protein_g: Math.round(item.protein_g * 10) / 10,
        carbs_g: Math.round(item.carbs_g * 10) / 10,
        fat_g: Math.round(item.fat_g * 10) / 10,
        fiber_g: null,
        sugar_g: null,
        sodium_mg: null,
        grams: item.grams,
        quantity: null,
        unit_label: null,
        amount_label: amount ? `${amount} (estimated from a photo)`.slice(0, 160) : "Estimated from a photo",
        source: "photo",
        basis: null,
      });
      continue;
    }
    const resolved = await resolvePickedFood(supabase, user.id, item.picked);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const { basis, quantity, unitId, ...rest } = resolved.food;
    const cols = amountColumns(basis, quantity, unitId);
    if (!cols) return { ok: false, error: "Choose one of the units listed for this food." };
    if (!withinLimits(cols)) return { ok: false, error: LIMITS_ERROR };
    rows.push({ food_id: rest.food_id, name: rest.name.slice(0, 160), is_estimate: rest.is_estimate, source: rest.source, ...cols });
  }

  try {
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, "logged");
    const { error } = await supabase.from("meal_items").insert(rows.map((r) => ({ meal_id: mealId, user_id: user.id, ...r })));
    if (error) throw error;
  } catch (err) {
    logError("food_photo.log", err);
    return { ok: false, error: "Couldn't add these to your diary. Try again." };
  }
  revalidatePath("/nutrition");
  revalidatePath("/home");
  return { ok: true, message: `Added ${rows.length} item${rows.length === 1 ? "" : "s"} to ${mealType}.` };
}
