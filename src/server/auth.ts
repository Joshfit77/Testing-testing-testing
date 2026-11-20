import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { openedByRecentEmailLink } from "@/lib/auth/password-reset-session";
import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature, planFromEntitlement, type Feature } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import type { ProfileRow } from "@/lib/types/db";
import { hasCurrentAcceptance, reacceptRequired } from "@/server/legal";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * True when this request's session was opened by an emailed link in the last 30 minutes (see
 * lib/auth/password-reset-session.ts). getClaims verifies the access token before its claims are trusted.
 */
export async function sessionOpenedByRecentEmailLink(): Promise<boolean> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return false;
  return openedByRecentEmailLink(data.claims.amr, Math.floor(Date.now() / 1000));
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (userId: string): Promise<ProfileRow | null> => {
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
});

/** Require an authenticated user who has finished onboarding. */
export async function requireOnboardedUser(): Promise<{ user: User; profile: ProfileRow }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  // After a material change to the Terms (switched on by the owner), accept the current versions first.
  if (reacceptRequired() && !(await hasCurrentAcceptance(user.id))) redirect("/legal/accept");
  return { user, profile };
}

/**
 * Whether this request's session was verified with a second factor (an authenticator code): aal2 in the verified
 * access token. The database's is_admin() requires the same (migration 085).
 */
export async function sessionHasSecondFactor(): Promise<boolean> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  return !error && data?.claims?.aal === "aal2";
}

/**
 * An administrator, signed in with a second factor (F-8). An admin whose session is password-only is sent to
 * /admin/mfa to enrol an authenticator (first time) or enter its code; nothing admin happens until then. Everyone else
 * goes Home.
 */
export async function requireAdmin(): Promise<{ user: User; profile: ProfileRow }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.role !== "admin") redirect("/home");
  if (!(await sessionHasSecondFactor())) redirect("/admin/mfa");
  return { user, profile: profile! };
}

/**
 * Effective plan for the user, read from user_entitlements (written only by the server and the billing webhooks;
 * users cannot modify it under RLS) with the given client. API routes pass the client they authenticated the
 * request with: a bearer-token request carries no session cookie, so the cookie client would see no row and read
 * every member as Free.
 */
export async function getPlanWith(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabase.from("user_entitlements").select("plan, valid_until").eq("user_id", userId).maybeSingle();
  return planFromEntitlement(data as { plan: string; valid_until: string | null } | null);
}

/** Effective plan for the signed-in user of this (cookie-session) request. */
export const getUserPlan = cache(async (userId: string): Promise<Plan> => getPlanWith(await getServerSupabase(), userId));

export class EntitlementError extends Error {
  constructor(public feature: Feature, public plan: Plan) {
    super(`Your ${plan} plan does not include ${feature}`);
    this.name = "EntitlementError";
  }
}

/** Server-side feature gate. Throws EntitlementError when not allowed. */
export async function assertFeature(userId: string, feature: Feature): Promise<Plan> {
  const plan = await getUserPlan(userId);
  if (!hasFeature(plan, feature)) throw new EntitlementError(feature, plan);
  return plan;
}
