"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { safeNextPath } from "@/lib/safe-redirect";
import { emailSchema, newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { isFlagEnabled } from "@/server/flags";
import { logError } from "@/server/log";

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  if (!(await isFlagEnabled("signups"))) return actionError("New registrations are temporarily paused. Please try again later.");

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding`,
      data: { display_name: parsed.data.displayName },
    },
  });
  if (error) {
    if (error.status === 429) return actionError("Too many attempts. Please wait a minute and try again.");
    if (/password/i.test(error.message)) return actionError(error.message, { password: error.message });
    logError("auth.signup", error);
    return actionError("We couldn't create your account. Please try again.");
  }
  if (data.session) redirect("/onboarding");
  return actionOk("Check your inbox to confirm your email address, then sign in.");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return actionInvalid(parsed.error);
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      return actionError("Please confirm your email address first. You can resend the confirmation email below.", { unconfirmed: "1" });
    }
    if (error.status === 429) return actionError("Too many attempts. Please wait a minute and try again.");
    return actionError("Incorrect email or password.");
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function resendConfirmationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return actionError("Enter the email address you signed up with.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding` },
  });
  if (error?.status === 429) return actionError("Please wait a minute before requesting another email.");
  // Generic response either way — don't reveal whether an account exists.
  return actionOk("If an unconfirmed account exists for that email, a new confirmation link is on its way.");
}

export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) return actionError("Please wait a minute before requesting another email.");
  if (error) logError("auth.reset_request", error);
  return actionOk("If an account exists for that email, you'll receive a password reset link shortly.");
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError("Your reset link has expired. Please request a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/different from the old/i.test(error.message)) return actionError("Choose a password you haven't used before.", { password: error.message });
    // secure_password_change: an older session must sign in again before changing the password.
    if (error.code === "reauthentication_needed" || /reauthenticat/i.test(error.message)) {
      return actionError("For your security, sign out and sign in again, then change your password.");
    }
    return actionError(error.message || "We couldn't update your password.");
  }
  redirect("/home?password=updated");
}
