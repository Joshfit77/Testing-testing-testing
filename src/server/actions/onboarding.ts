"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, type ActionState } from "@/lib/action-state";
import { isoDateInTz } from "@/lib/domain/dates";
import { estimateNutritionTargets } from "@/lib/domain/nutrition";
import { buildStarterProgram } from "@/lib/domain/program-generator";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth";
import { loadExercises, toCatalog } from "@/server/services/catalog";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";
import { logError } from "@/server/log";

export async function saveOnboardingAction(input: OnboardingInput & { rebuildProgram?: boolean }): Promise<ActionState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();

  const { data: existing } = await supabase.from("profiles").select("onboarding_completed_at, timezone, wellness_consent_at").eq("id", user.id).single();
  const firstTime = !existing?.onboarding_completed_at;
  const today = isoDateInTz(new Date(), existing?.timezone ?? "UTC");
  const withdrawingConsent = Boolean(existing?.wellness_consent_at) && !v.wellnessConsent;

  try {
    const consentAt = v.wellnessConsent ? (existing?.wellness_consent_at ?? new Date().toISOString()) : null;
    // Unticking consent withdraws it, exactly like Profile → Withdraw consent: delete what was stored under it.
    if (withdrawingConsent) {
      const { error: rErr } = await supabase.from("recovery_checkins").delete().eq("user_id", user.id);
      if (rErr) throw rErr;
    }
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        display_name: v.displayName,
        unit_system: v.unitSystem,
        birth_year: new Date().getUTCFullYear() - v.age,
        height_cm: v.heightCm,
        sex: v.sex,
        faith_enabled: v.faithEnabled,
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
    });
    if (aErr) throw aErr;

    const { error: wErr } = await supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, recorded_on: today, weight_kg: v.weightKg }, { onConflict: "user_id,recorded_on" });
    if (wErr) throw wErr;

    const { data: goals } = await supabase.from("nutrition_goals").select("user_id, is_estimate").eq("user_id", user.id).maybeSingle();
    if (!goals || goals.is_estimate) {
      const t = estimateNutritionTargets({
        weightKg: v.weightKg,
        trainingDaysPerWeek: v.daysPerWeek,
        goal: v.primaryGoal,
        sex: v.sex,
        age: v.age,
        heightCm: v.heightCm,
        diet: v.dietType,
      });
      await supabase.from("nutrition_goals").upsert({
        user_id: user.id,
        calories: t.calories,
        protein_g: t.protein_g,
        carbs_g: t.carbs_g,
        fat_g: t.fat_g,
        water_ml: t.water_ml,
        is_estimate: true,
      });
    }

    if (firstTime || input.rebuildProgram) {
      const catalog = toCatalog(await loadExercises(supabase));
      const seed = buildStarterProgram(
        {
          primary_goal: v.primaryGoal,
          experience: v.experience,
          days_per_week: v.daysPerWeek,
          session_minutes: v.sessionMinutes,
          equipment: v.equipment,
          preferred_types: v.preferredTypes,
        },
        catalog,
      );
      const programId = await createPrivateProgram(supabase, user.id, seed, "starter");
      await activateProgram(supabase, user.id, programId);
    }
  } catch (err) {
    logError("onboarding.save", err);
    return actionError("We couldn't save your answers. Please try again.");
  }

  revalidatePath("/", "layout");
  if (firstTime) redirect("/home?welcome=1");
  const saved = input.rebuildProgram ? "Saved. Your starter program has been rebuilt and activated." : "Your training preferences were saved.";
  const message = withdrawingConsent ? `${saved} Wellness consent withdrawn; limitation notes and recovery check-ins were deleted.` : saved;
  return { ok: true, message, at: Date.now() };
}
