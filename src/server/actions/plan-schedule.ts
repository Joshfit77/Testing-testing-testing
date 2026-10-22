"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { starterProgramInput } from "@/lib/domain/starter-program";
import type { Equipment, ExperienceLevel, PrimaryGoal } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";
import { buildAndActivateCustomProgram } from "@/server/services/custom-programs";

const scheduleSchema = z.object({
  daysPerWeek: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(180),
});

/**
 * Training preferences → "Change my schedule": save new days per week and session length, then rebuild and
 * activate the starter program from the saved answers with the same builder onboarding uses. The
 * client shows the before → after preview first and calls router.refresh() afterwards.
 */
export async function applyScheduleChangeAction(input: unknown): Promise<ActionState> {
  const { user, profile } = await requireOnboardedUser();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return actionError("Choose 1–7 days and a session length between 15 and 180 minutes.");
  const supabase = await getServerSupabase();
  try {
    const { data: a, error: aErr } = await supabase
      .from("onboarding_answers")
      .select("primary_goal, experience, equipment, secondary_goal")
      .eq("user_id", user.id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!a) return actionError("Complete your training preferences first.");
    // Check everything the rebuild needs before changing anything, so a refusal leaves the answers as they were.
    const { data: w } = await supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle();
    if (!profile.birth_year || !profile.height_cm || !w?.weight_kg) return actionError("Add your age, height and weight in Training preferences first.");
    // Each rebuild saves a new private program, so it's limited like the program builder.
    if (!rateLimit(`schedule-rebuild:${user.id}`, 10, 60 * 60_000).ok) return actionError("You've rebuilt your program several times in the last hour. Please try again later.");
    const { error: uErr } = await supabase
      .from("onboarding_answers")
      .update({ days_per_week: parsed.data.daysPerWeek, session_minutes: parsed.data.sessionMinutes })
      .eq("user_id", user.id);
    if (uErr) throw uErr;
    await buildAndActivateCustomProgram(
      supabase,
      user.id,
      starterProgramInput({
        goal: a.primary_goal as PrimaryGoal,
        experience: a.experience as ExperienceLevel,
        daysPerWeek: parsed.data.daysPerWeek,
        sessionMinutes: parsed.data.sessionMinutes,
        age: new Date().getUTCFullYear() - profile.birth_year,
        heightCm: Number(profile.height_cm),
        bodyweightKg: Number(w.weight_kg),
        equipment: (a.equipment as Equipment[]) ?? [],
        units: profile.unit_system,
        secondaryGoal: (a.secondary_goal as string | null) ?? null,
      }),
      "starter",
    );
  } catch (err) {
    logError("plan-schedule.apply", err);
    return actionError("We couldn't update your schedule. Please try again.");
  }
  return actionOk("Schedule updated. Your rebuilt program is now active.");
}
