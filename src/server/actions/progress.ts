"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { kgToLb, toCm, toKg } from "@/lib/domain/units";
import { goalSchema, measurementSchema, weightEntrySchema } from "@/lib/validation/schemas";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

async function ctx() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const supabase = await getServerSupabase();
  return { user, units: profile?.unit_system ?? "imperial", supabase };
}

export async function logWeightAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, units, supabase } = await ctx();
  const parsed = weightEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const kg = toKg(parsed.data.weight, units);
  if (kg < 25 || kg > 400) return actionError("That weight looks out of range.", { weight: "Out of range" });
  const { error } = await supabase
    .from("weight_entries")
    .upsert({ user_id: user.id, recorded_on: parsed.data.recordedOn, weight_kg: kg }, { onConflict: "user_id,recorded_on" });
  if (error) {
    logError("progress.weight", error);
    return actionError("Couldn't save your weight.");
  }
  revalidatePath("/progress", "layout");
  revalidatePath("/home");
  return actionOk("Bodyweight saved.");
}

export async function deleteWeightAction(formData: FormData): Promise<void> {
  const { user, supabase } = await ctx();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await supabase.from("weight_entries").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/progress", "layout");
}

export async function logMeasurementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, units, supabase } = await ctx();
  const parsed = measurementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const c = (n: number | null) => (n == null ? null : toCm(n, units));
  if ([v.waist, v.chest, v.hips, v.arm, v.thigh, v.bodyFatPct].every((x) => x == null)) return actionError("Enter at least one measurement.");
  const { error } = await supabase.from("measurement_entries").insert({
    user_id: user.id,
    recorded_on: v.recordedOn,
    waist_cm: c(v.waist),
    chest_cm: c(v.chest),
    hips_cm: c(v.hips),
    arm_cm: c(v.arm),
    thigh_cm: c(v.thigh),
    body_fat_pct: v.bodyFatPct,
    notes: v.notes || null,
  });
  if (error) {
    logError("progress.measurement", error);
    return actionError(error.code === "23514" ? "One of the measurements is out of range." : "Couldn't save measurements.");
  }
  revalidatePath("/progress", "layout");
  return actionOk("Measurements saved.");
}

export async function createGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase } = await ctx();
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const exerciseId = z.string().uuid().safeParse(formData.get("exerciseId"));
  // Capture the starting point server-side so progress is measured from where the user began.
  let startValue: number | null = null;
  const inLb = v.unit === "lb";
  if (v.goalType === "bodyweight") {
    const { data } = await supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle();
    if (data) startValue = Math.round((inLb ? kgToLb(Number(data.weight_kg)) : Number(data.weight_kg)) * 10) / 10;
  } else if (v.goalType === "strength" && exerciseId.success) {
    const { data } = await supabase
      .from("personal_records")
      .select("value")
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId.data)
      .eq("record_type", "estimated_1rm")
      .order("value", { ascending: false })
      .limit(1)
      .maybeSingle();
    startValue = data ? Math.round((inLb ? kgToLb(Number(data.value)) : Number(data.value)) * 10) / 10 : 0;
  }
  const { error } = await supabase.from("fitness_goals").insert({
    user_id: user.id,
    title: v.title,
    goal_type: v.goalType,
    target_value: v.targetValue,
    start_value: startValue,
    unit: v.unit || null,
    exercise_id: v.goalType === "strength" && exerciseId.success ? exerciseId.data : null,
    target_date: v.targetDate || null,
  });
  if (error) {
    logError("progress.goal", error);
    return actionError("Couldn't create the goal.");
  }
  revalidatePath("/progress", "layout");
  return actionOk("Goal added.");
}

export async function setGoalStatusAction(formData: FormData): Promise<void> {
  const { user, supabase } = await ctx();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(["active", "completed", "archived"]).safeParse(formData.get("status"));
  if (!id.success || !status.success) return;
  await supabase
    .from("fitness_goals")
    .update({ status: status.data, completed_at: status.data === "completed" ? new Date().toISOString() : null })
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/progress", "layout");
}
