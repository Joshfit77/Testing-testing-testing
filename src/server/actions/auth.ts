"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { safeNextPath } from "@/lib/safe-redirect";
import { emailSchema, newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { signupAcceptances } from "@/lib/legal/versions";
import { isFlagEnabled } from "@/server/flags";
import { registerLegalVersions } from "@/server/legal";
import { logError } from "@/server/log";
import { clientIp, hashKey, rateLimitAll } from "@/server/rate-limit";

const MINUTE = 60_000;
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const TOO_MANY_EMAILS = "Please wait a few minutes before requesting another email.";

/**
 * App-level limits on the sign-in and email actions. These run on our servers, so Supabase's own per-address auth
 * limits see the server's address; these use the client's (hashed) address and the (hashed) email instead, shared
 * across every server instance. AUTH_RATE_LIMIT_SCALE can only raise the limits (automated test runs sign up many
 * accounts from one machine); production leaves it unset.
 */
type Check = { key: string; limit: number; windowMs: number };
const SCALE = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_SCALE) || 1);

async function authLimited(checks: Check[]): Promise<boolean> {
  return !(await rateLimitAll(checks.map((c) => ({ ...c, limit: c.limit * SCALE })))).ok;
}

/** A per-address check, or none when the platform didn't pass the client's address (so unrelated people never share one counter). */
async function perAddress(prefix: string, limit: number, windowMs: number): Promise<Check[]> {
  const ip = await clientIp();
  return ip === "unknown" ? [] : [{ key: `${prefix}:ip:${hashKey(ip)}`, limit, windowMs }];
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  if (!(await isFlagEnabled("signups"))) return actionError("New registrations are temporarily paused. Please try again later.");
  if (await authLimited(await perAddress("signup", 5, 10 * MINUTE))) return actionError(TOO_MANY);

  // The database records only listed document versions; make sure this server's are listed (never blocks sign-up).
  await registerLegalVersions().catch((err) => logError("legal.register", err));
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding`,
      // Recorded with the account by a database trigger (legal_acceptances): what was accepted, which version, when.
      data: { display_name: parsed.data.displayName, legal_acceptances: signupAcceptances() },
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
  if (
    await authLimited([
      ...(await perAddress("signin", 20, 5 * MINUTE)),
      { key: `signin:email:${hashKey(parsed.data.email)}`, limit: 10, windowMs: 15 * MINUTE },
    ])
  )
    return actionError(TOO_MANY);
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
  if (
    await authLimited([
      ...(await perAddress("email", 5, 15 * MINUTE)),
      { key: `email:addr:${hashKey(email.data)}`, limit: 3, windowMs: 15 * MINUTE },
    ])
  )
    return actionError(TOO_MANY_EMAILS);
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
  if (
    await authLimited([
      ...(await perAddress("email", 5, 15 * MINUTE)),
      { key: `email:addr:${hashKey(parsed.data.email)}`, limit: 3, windowMs: 15 * MINUTE },
    ])
  )
    return actionError(TOO_MANY_EMAILS);
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
  if (await authLimited([{ key: `password-update:${userData.user.id}`, limit: 10, windowMs: 15 * MINUTE }])) return actionError(TOO_MANY);
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/different from the old/i.test(error.message)) return actionError("Choose a password you haven't used before.", { password: error.message });
    // secure_password_change: an older session must sign in again before changing the password.
    if (error.code === "reauthentication_needed" || /reauthenticat/i.test(error.message)) {
      return actionError("For your security, sign out and sign in again, then change your password.");
    }
    logError("auth.update_password", error);
    return actionError("We couldn't update your password. Please try again.");
  }
  redirect("/home?password=updated");
}
