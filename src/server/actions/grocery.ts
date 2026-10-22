"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { mergeGroceries, type GroceryInput } from "@/lib/domain/grocery";
import type { UnitSystem } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import type { GroceryIngredient } from "@/server/services/recipes";

/** Grocery list: generated from planned meals in a date range, plus items added by hand. */

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function ctx() {
  const user = await requireUser();
  await assertFeature(user.id, "meal_planning");
  return { user, supabase: await getServerSupabase() };
}

function guard(err: unknown, scope: string): ActionState {
  if (err instanceof EntitlementError) return actionError("The grocery list is included with Plus and Pro.");
  logError(scope, err);
  return actionError("Something went wrong. Please try again.");
}

/**
 * Rebuilds the plan part of the list for the date range (items added by hand are kept). Each planned meal
 * contributes its ingredients × its portion; the same ingredient is combined when the units convert.
 */
export async function generateGroceryAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = z
      .object({ from: isoDate, to: isoDate })
      .refine((v) => v.from <= v.to, "The end date must be on or after the start date.")
      .safeParse(input);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Choose a date range.");
    const { from, to } = parsed.data;
    const [{ data: entries, error }, { data: profile }] = await Promise.all([
      supabase.from("meal_plan_entries").select("portion, ingredients").eq("user_id", user.id).gte("plan_date", from).lte("plan_date", to),
      supabase.from("profiles").select("unit_system").eq("id", user.id).maybeSingle(),
    ]);
    if (error) throw error;
    if (!entries?.length) return actionError("No planned meals in those dates. Generate a meal plan first, or pick dates your plan covers.");
    const items: GroceryInput[] = entries.flatMap((e) =>
      ((e.ingredients ?? []) as GroceryIngredient[]).map((i) => ({ key: i.key, name: i.name, quantity: Number(i.quantity) * Number(e.portion), unitLabel: i.unitLabel, gramsPerUnit: i.gramsPerUnit ?? null })),
    );
    const units: UnitSystem = profile?.unit_system === "metric" ? "metric" : "imperial";
    const lines = mergeGroceries(items, units);
    const { error: delErr } = await supabase.from("grocery_items").delete().eq("user_id", user.id).eq("origin", "plan");
    if (delErr) throw delErr;
    if (lines.length) {
      const { error: insErr } = await supabase.from("grocery_items").insert(
        lines.map((l, i) => ({
          user_id: user.id,
          name: l.name.slice(0, 160),
          quantity: l.quantity > 0 ? l.quantity : null,
          unit: l.unit.slice(0, 60),
          note: l.note?.slice(0, 300) ?? null,
          origin: "plan",
          ingredient_key: l.key.slice(0, 80),
          position: i,
        })),
      );
      if (insErr) throw insErr;
    }
    const { error: listErr } = await supabase.from("grocery_lists").upsert({ user_id: user.id, from_date: from, to_date: to, generated_at: new Date().toISOString() });
    if (listErr) throw listErr;
    return actionOk(`Grocery list built from ${entries.length} planned meal${entries.length === 1 ? "" : "s"}: ${lines.length} item${lines.length === 1 ? "" : "s"}.`);
  } catch (err) {
    return guard(err, "grocery.generate");
  }
}

export async function addGroceryItemAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = z
      .object({
        name: z.string().trim().min(1, "Enter an item.").max(160),
        quantity: z.number().positive().max(100_000).nullable().optional(),
        unit: z.string().trim().max(60).optional(),
      })
      .safeParse(input);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Enter an item.");
    const { name, quantity, unit } = parsed.data;
    const { error } = await supabase.from("grocery_items").insert({ user_id: user.id, name, quantity: quantity ?? null, unit: unit || null, origin: "manual", position: 10_000 });
    if (error) throw error;
    return actionOk(`Added ${name}.`);
  } catch (err) {
    return guard(err, "grocery.add");
  }
}

export async function toggleGroceryItemAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = z.object({ id: uuid, checked: z.boolean() }).safeParse(input);
    if (!parsed.success) return actionError("That item couldn't be updated.");
    const { data, error } = await supabase.from("grocery_items").update({ checked: parsed.data.checked }).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    if (error) throw error;
    if (!data?.length) return actionError("That item is no longer on the list.");
    return actionOk();
  } catch (err) {
    return guard(err, "grocery.toggle");
  }
}

export async function removeGroceryItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("grocery_items").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) logError("grocery.remove", error);
}

/** Clears the whole list, or only the checked items. */
export async function clearGroceryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const onlyChecked = formData.get("scope") === "checked";
  let q = supabase.from("grocery_items").delete().eq("user_id", user.id);
  if (onlyChecked) q = q.eq("checked", true);
  const { error } = await q;
  if (error) logError("grocery.clear", error);
  if (!onlyChecked) await supabase.from("grocery_lists").delete().eq("user_id", user.id);
}
