"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth";
import { isRevenueCatConfigured, isServiceRoleConfigured } from "@/server/env";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/server/rate-limit";
import { deleteUserAccount, deletionFailureMessage } from "@/server/services/account-deletion";
import { cancelStripeSubscriptionsForUser, deleteStripeCustomer, isStripeConfigured } from "@/server/services/billing";
import { deleteRevenueCatCustomer } from "@/server/services/store-billing";
import { logError } from "@/server/log";
import { RETURNING_COOKIE } from "@/lib/opening";

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
  // The flag first: if the deletes fail, consent still reads as withdrawn and the member can retry the deletion.
  const { error } = await supabase.from("profiles").update({ wellness_consent_at: null }).eq("id", user.id);
  if (error) return actionError("Couldn't update your consent. Please try again.");
  const steps = await Promise.all([
    supabase.from("onboarding_answers").update({ limitations: null }).eq("user_id", user.id),
    supabase.from("recovery_checkins").delete().eq("user_id", user.id),
  ]);
  if (steps.some((s) => s.error)) return actionError("Consent withdrawn, but some wellness data couldn't be removed. Please try again.");
  revalidatePath("/", "layout");
  return actionOk("Consent withdrawn. Limitation notes and recovery check-ins were deleted; sleep entries stay until you delete them under Sleep & Recovery > Goal & privacy.");
}

/**
 * Allow or withdraw sharing data with the AI provider for the AI coach. Withdrawing stops the coach (no further
 * data is sent); past conversations stay in the account until the user deletes them.
 */
export async function setAiDataConsentAction(allow: boolean): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("profiles")
    // Withdrawing AI consent also switches coaching memory off: saved notes stay (the member can view or delete them
    // under AI Coach > Memory) but nothing is used or added until both are allowed again.
    // It also switches off sharing of Apple Health / Health Connect data: that permission only has meaning with this one.
    // And the prayer-journal permission (migration 080), with every entry's share mark (below).
    .update(allow ? { ai_data_consent_at: new Date().toISOString() } : { ai_data_consent_at: null, coach_memory_enabled: false, health_ai_share_consent_at: null, journal_ai_consent_at: null })
    .eq("id", user.id);
  if (error) {
    logError("profile.ai_consent", error);
    return actionError("Couldn't save your choice. Please try again.");
  }
  // With consent off nothing is sent whatever the marks say; clearing them means turning it on again shares nothing old.
  if (!allow) await clearJournalShareMarks(supabase, user.id);
  revalidatePath("/coach");
  revalidatePath("/profile");
  return actionOk(allow ? "AI Coach turned on." : "AI Coach data sharing turned off, and coaching memory with it. Nothing is sent until you allow it again; your saved memories stay until you delete them.");
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (formData.get("confirm") !== "DELETE") return actionError("Type DELETE to confirm.", { confirm: "Type DELETE" });
  const password = String(formData.get("password") ?? "");
  if (!password) return actionError("Enter your password to confirm.", { password: "Enter your password" });
  if (!isServiceRoleConfigured()) return actionError("Account deletion isn't configured on this server. Please contact support.");

  const attempt = await rateLimit(`delete-account:${user.id}`, 5, 15 * 60_000);
  if (!attempt.ok) return actionError("Too many attempts. Please wait a few minutes and try again.");
  const check = await verifyPassword(user.email ?? "", password);
  if (check === "wrong") return actionError("That password isn't right.", { password: "Incorrect password" });
  if (check === "error") return actionError("We couldn't check your password right now. Please try again.");

  const result = await deleteUserAccount(user.id, {
    admin: getServiceSupabase(),
    cancelSubscriptions: cancelStripeSubscriptionsForUser,
    deleteStripeCustomer: isStripeConfigured() ? deleteStripeCustomer : null,
    deleteStoreCustomer: isRevenueCatConfigured() ? deleteRevenueCatCustomer : null,
    log: logError,
  });
  if (!result.ok) return actionError(deletionFailureMessage(result));

  const supabase = await getServerSupabase();
  await supabase.auth.signOut().catch(() => null);
  // Nobody has an account on this device any more: the next launch opens the welcome page, not sign-in.
  (await cookies()).delete(RETURNING_COOKIE);
  redirect("/?deleted=1");
}

/**
 * Confirms the password with a throwaway client that keeps no session, so the person's own cookies are
 * untouched. Accounts that sign in without a password (none today) would need another re-check.
 */
async function verifyPassword(email: string, password: string): Promise<"ok" | "wrong" | "error"> {
  if (!email) return "error";
  const client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return error.status === 400 || /invalid login credentials/i.test(error.message) ? "wrong" : "error";
  // End the extra session this check created.
  // "local" only drops this throwaway client's tokens; the default ("global") would sign the person out everywhere.
  if (data.session) await client.auth.signOut({ scope: "local" }).catch(() => null);
  return "ok";
}

/**
 * Turn sharing of Apple Health / Health Connect data with the AI provider on or off (migration 079). Off by default.
 * It needs the general AI consent first; turning it off takes effect on the next message.
 */
export async function setHealthAiShareAction(allow: boolean): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  if (allow) {
    const { data } = await supabase.from("profiles").select("ai_data_consent_at").eq("id", user.id).maybeSingle();
    if (!data?.ai_data_consent_at) return actionError("Turn on the AI Coach first.");
  }
  const { error } = await supabase
    .from("profiles")
    .update({ health_ai_share_consent_at: allow ? new Date().toISOString() : null })
    .eq("id", user.id);
  if (error) {
    logError("profile.health_ai_share", error);
    return actionError("Couldn't save your choice. Please try again.");
  }
  revalidatePath("/coach");
  revalidatePath("/profile");
  return actionOk(allow ? "Health data sharing with the AI Coach turned on." : "Health data sharing with the AI Coach turned off. Nothing from Apple Health or Health Connect is sent from now on.");
}

/**
 * Turn the separate permission to share prayer-journal entries with the AI Coach on or off (migration 080). Off by
 * default. Turning it on needs the general AI consent and faith features; it shares nothing by itself (each entry must
 * still be marked). Turning it off also clears every entry's share mark, so turning it on again later never resumes
 * sharing old entries without the member choosing them again.
 */
export async function setJournalAiShareAction(allow: boolean): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  if (allow) {
    const { data } = await supabase.from("profiles").select("ai_data_consent_at, faith_enabled").eq("id", user.id).maybeSingle();
    if (!data?.ai_data_consent_at) return actionError("Turn on the AI Coach first.");
    if (!data.faith_enabled) return actionError("Turn on faith features first.");
  } else {
    const cleared = await clearJournalShareMarks(supabase, user.id);
    if (!cleared) return actionError("Couldn't save your choice. Please try again.");
  }
  const { error } = await supabase.from("profiles").update({ journal_ai_consent_at: allow ? new Date().toISOString() : null }).eq("id", user.id);
  if (error) {
    logError("profile.journal_ai_share", error);
    return actionError("Couldn't save your choice. Please try again.");
  }
  revalidatePath("/coach");
  revalidatePath("/profile");
  revalidatePath("/faith/journal");
  return actionOk(
    allow
      ? "Journal sharing turned on. Nothing is shared until you mark an entry \"Share with AI Coach\"."
      : "Journal sharing turned off. No journal entry is sent to the AI Coach, and every entry is private again.",
  );
}

/** Mark every journal entry private again (journal permission or AI consent withdrawn). */
async function clearJournalShareMarks(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string): Promise<boolean> {
  const { error } = await supabase.from("faith_journal_entries").update({ share_with_coach: false }).eq("user_id", userId).eq("share_with_coach", true);
  if (error) logError("profile.journal_share_clear", error);
  return !error;
}
