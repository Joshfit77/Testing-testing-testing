"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, type ActionState } from "@/lib/action-state";
import { fieldErrors } from "@/lib/validation/schemas";
import { isValidTimeZone, isoDateInTz } from "@/lib/domain/dates";
import { onboardingPlanSchema, onboardingSchema, type OnboardingInput, type OnboardingPlanInput } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { buildAndActivateCustomProgram } from "@/server/services/custom-programs";
import { estimateAndSaveTargets, waterTargetMl } from "@/server/services/nutrition-targets";
import { calorieBudget, rateTowardGoal, type WeeklyRateKg } from "@/lib/domain/calorie-budget";
import { starterProgramInput } from "@/lib/domain/starter-program";

export async function saveOnboardingAction(input: OnboardingInput & { rebuildProgram?: boolean }): Promise<ActionState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();

  const { data: existing } = await supabase.from("profiles").select("onboarding_completed_at, timezone, wellness_consent_at").eq("id", user.id).single();
  const firstTime = !existing?.onboarding_completed_at;
  const today = isoDateInTz(new Date(), existing?.timezone ?? "UTC");

  try {
    const consentAt = v.wellnessConsent ? (existing?.wellness_consent_at ?? new Date().toISOString()) : null;
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        display_name: v.displayName,
        unit_system: v.unitSystem,
        birth_year: new Date().getUTCFullYear() - v.age,
        height_cm: v.heightCm,
        sex: v.sex,
        faith_enabled: v.faithEnabled,
        ...(v.textSize ? { text_size: v.textSize } : {}),
        ...(v.reduceMotion !== undefined ? { reduce_motion: v.reduceMotion } : {}),
        wellness_consent_at: consentAt,
        onboarding_completed_at: existing?.onboarding_completed_at ?? new Date().toISOString(),
      })
      .eq("id", user.id);
    if (pErr) throw pErr;

    const { error: aErr } = await supabase.from("onboarding_answers").upsert({
      user_id: user.id,
      primary_goal: v.primaryGoal,
      experience: v.experience,
      days_per_week: v.daysPerWeek,
      session_minutes: v.sessionMinutes,
      equipment: v.equipment,
      preferred_types: v.preferredTypes,
      limitations: v.wellnessConsent && v.limitations ? v.limitations : null,
      dietary_preferences: v.dietaryPreferences,
      diet_type: v.dietType,
      ...(v.secondaryGoal !== undefined ? { secondary_goal: v.secondaryGoal } : {}),
    });
    if (aErr) throw aErr;

    const { error: wErr } = await supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, recorded_on: today, weight_kg: v.weightKg }, { onConflict: "user_id,recorded_on" });
    if (wErr) throw wErr;

    const { data: goals } = await supabase.from("nutrition_goals").select("user_id, is_estimate").eq("user_id", user.id).maybeSingle();
    if (!goals || goals.is_estimate) await estimateAndSaveTargets(supabase, user.id);

    if (firstTime || input.rebuildProgram) {
      // The same generator as sign-up and the schedule preview, so a rebuild gives the program the preview shows.
      await buildAndActivateCustomProgram(
        supabase,
        user.id,
        starterProgramInput({
          goal: v.primaryGoal,
          experience: v.experience,
          daysPerWeek: v.daysPerWeek,
          sessionMinutes: v.sessionMinutes,
          age: v.age,
          heightCm: v.heightCm,
          bodyweightKg: v.weightKg,
          equipment: [...new Set(v.equipment)],
          units: v.unitSystem,
          secondaryGoal: v.secondaryGoal ?? null,
        }),
        "starter",
      );
    }
  } catch (err) {
    logError("onboarding.save", err);
    return actionError("We couldn't save your answers. Please try again.");
  }

  revalidatePath("/", "layout");
  if (firstTime) redirect("/home?welcome=1");
  return { ok: true, message: input.rebuildProgram ? "Saved. Your starter program has been rebuilt and activated." : "Your training preferences were saved.", at: Date.now() };
}

/**
 * Finish the guided sign-up questionnaire: save the answers and a bodyweight entry, set a calorie budget
 * (an estimate), build the starter program through the custom-program path and make it active, then
 * show the plan summary. Onboarding is only marked complete once everything above has been saved, so a
 * failure leaves the user on the questionnaire to try again.
 */
export async function completeOnboardingAction(input: OnboardingPlanInput): Promise<ActionState> {
  const user = await requireUser();
  const parsed = onboardingPlanSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return actionError(Object.values(errors)[0] ?? "Please check your answers.", errors);
  }
  const v = parsed.data;
  const supabase = await getServerSupabase();

  const { data: existing } = await supabase.from("profiles").select("onboarding_completed_at, timezone").eq("id", user.id).single();
  if (existing?.onboarding_completed_at) redirect("/plan");
  const today = isoDateInTz(new Date(), existing?.timezone ?? "UTC");
  const weeklyChangeKg = rateTowardGoal(v.weightKg, v.goalWeightKg, v.weeklyChangeKg as WeeklyRateKg);

  try {
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        display_name: v.displayName,
        unit_system: v.unitSystem,
        birth_year: new Date().getUTCFullYear() - v.age,
        height_cm: v.heightCm,
        sex: v.sex,
        faith_enabled: v.faithEnabled,
        // Optional accessibility step; skipped = keep the defaults.
        ...(v.textSize ? { text_size: v.textSize } : {}),
        ...(v.reduceMotion !== undefined ? { reduce_motion: v.reduceMotion } : {}),
        // Dates (today's workout, the food diary, the calendar) follow the member's clock, not the server's.
        ...(isValidTimeZone(v.timeZone) ? { timezone: v.timeZone } : {}),
      })
      .eq("id", user.id);
    if (pErr) throw pErr;

    const { error: aErr } = await supabase.from("onboarding_answers").upsert({
      user_id: user.id,
      primary_goal: v.primaryGoal,
      secondary_goal: v.secondaryGoal ?? null,
      experience: v.experience,
      days_per_week: v.daysPerWeek,
      session_minutes: v.sessionMinutes,
      equipment: [...new Set(v.equipment)],
      preferred_types: [],
      dietary_preferences: ["no_preference"],
      diet_type: v.dietType,
      goal_weight_kg: v.goalWeightKg,
      weekly_change_kg: weeklyChangeKg,
      activity_level: v.activityLevel,
    });
    if (aErr) throw aErr;

    const { error: wErr } = await supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, recorded_on: today, weight_kg: v.weightKg }, { onConflict: "user_id,recorded_on" });
    if (wErr) throw wErr;

    const { data: goals } = await supabase.from("nutrition_goals").select("is_estimate").eq("user_id", user.id).maybeSingle();
    if (!goals || goals.is_estimate) {
      const b = calorieBudget({
        sex: v.sex,
        age: v.age,
        heightCm: v.heightCm,
        weightKg: v.weightKg,
        activity: v.activityLevel,
        weeklyChangeKg,
        goal: v.primaryGoal,
        diet: v.dietType,
      });
      const { error: gErr } = await supabase.from("nutrition_goals").upsert({
        user_id: user.id,
        calories: b.calories,
        protein_g: b.protein_g,
        carbs_g: b.carbs_g,
        fat_g: b.fat_g,
        water_ml: waterTargetMl(v.weightKg, { daysPerWeek: v.daysPerWeek, goal: v.primaryGoal }),
        is_estimate: true,
      });
      if (gErr) throw gErr;
    }

    await buildAndActivateCustomProgram(
      supabase,
      user.id,
      starterProgramInput({
        goal: v.primaryGoal,
        experience: v.experience,
        daysPerWeek: v.daysPerWeek,
        sessionMinutes: v.sessionMinutes,
        age: v.age,
        heightCm: v.heightCm,
        bodyweightKg: v.weightKg,
        equipment: [...new Set(v.equipment)],
        units: v.unitSystem,
        secondaryGoal: v.secondaryGoal ?? null,
      }),
      "starter",
    );

    const { error: doneErr } = await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
    if (doneErr) throw doneErr;
  } catch (err) {
    logError("onboarding.complete", err);
    return actionError("We couldn't finish setting up your plan. Please try again.");
  }

  revalidatePath("/", "layout");
  redirect("/plan?new=1");
}
