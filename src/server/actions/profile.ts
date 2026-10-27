"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth";
import { isServiceRoleConfigured } from "@/server/env";
import { removeUserStorage } from "@/server/services/account";
import { cancelStripeSubscriptionsForUser } from "@/server/services/billing";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    unitSystem: formData.get("unitSystem"),
    heightCm: formData.get("heightCm"),
    timezone: formData.get("timezone"),
    faithEnabled: formData.get("faithEnabled") === "on",
  });
  if (!parsed.success) return actionInvalid(parsed.error);
  if (!isValidTimeZone(parsed.data.timezone)) return actionError("Choose a valid time zone.", { timezone: "Invalid time zone" });
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      unit_system: parsed.data.unitSystem,
      height_cm: parsed.data.heightCm,
      timezone: parsed.data.timezone,
      faith_enabled: parsed.data.faithEnabled,
    })
    .eq("id", user.id);
  if (error) {
    logError("profile.update", error);
    return actionError("Couldn't save your profile.");
  }
  revalidatePath("/", "layout");
  return actionOk("Profile saved.");
}

/** Withdraw consent for optional wellness data and delete what was stored under it. */
export async function withdrawWellnessConsentAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const steps = await Promise.all([
    supabase.from("onboarding_answers").update({ limitations: null }).eq("user_id", user.id),
    supabase.from("recovery_checkins").delete().eq("user_id", user.id),
  ]);
  if (steps.some((s) => s.error)) return actionError("Couldn't remove your wellness data. Please try again.");
  const { error } = await supabase.from("profiles").update({ wellness_consent_at: null }).eq("id", user.id);
  if (error) return actionError("Couldn't update your consent. Please try again.");
  revalidatePath("/", "layout");
  return actionOk("Consent withdrawn. Limitation notes and recovery check-ins were deleted.");
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (formData.get("confirm") !== "DELETE") return actionError('Type DELETE to confirm.', { confirm: "Type DELETE" });
  if (!isServiceRoleConfigured()) return actionError("Account deletion isn't configured on this server. Please contact support.");
  const limit = await rateLimit(`delete:${user.id}`, 5, 60 * 60_000);
  if (!limit.ok) return actionError("Too many attempts. Please wait a while and try again.");
  try {
    await cancelStripeSubscriptionsForUser(user.id);
    const admin = getServiceSupabase();
    // Rows cascade with the auth user; storage objects don't, so remove them first.
    await removeUserStorage(admin, user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    logError("account.delete", err);
    return actionError("We couldn't delete your account. Please try again or contact support.");
  }
  const supabase = await getServerSupabase();
  await supabase.auth.signOut().catch(() => null);
  redirect("/?deleted=1");
}
