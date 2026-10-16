"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { isoDateInTz } from "@/lib/domain/dates";
import { readinessBand, readinessNote, readinessScore } from "@/lib/domain/readiness";
import { recoveryCheckinSchema } from "@/lib/validation/schemas";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

export async function recoveryCheckinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = recoveryCheckinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const profile = await getProfile(user.id);
  const supabase = await getServerSupabase();

  if (!profile?.wellness_consent_at) {
    if (formData.get("consent") !== "on") {
      return actionError("Recovery check-ins are optional wellness information. Please give consent to save them.", { consent: "Consent required" });
    }
    const { error } = await supabase.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return actionError("Couldn't record your consent. Please try again.");
  }

  const v = parsed.data;
  const score = readinessScore(v);
  const { error } = await supabase.from("recovery_checkins").upsert(
    {
      user_id: user.id,
      checked_on: isoDateInTz(new Date(), profile?.timezone ?? "UTC"),
      sleep_quality: v.sleepQuality,
      energy: v.energy,
      soreness: v.soreness,
      stress: v.stress,
      readiness_score: score,
      notes: v.notes || null,
    },
    { onConflict: "user_id,checked_on" },
  );
  if (error) {
    logError("recovery.checkin", error);
    return actionError("Couldn't save your check-in. Please try again.");
  }
  revalidatePath("/train/recovery");
  revalidatePath("/home");
  return actionOk(`Readiness ${score}/100. ${readinessNote(readinessBand(score))}`);
}
