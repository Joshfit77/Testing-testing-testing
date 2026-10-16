import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature, type Feature } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import type { ProfileRow } from "@/lib/types/db";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

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
  return { user, profile };
}

export async function requireAdmin(): Promise<{ user: User; profile: ProfileRow }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.role !== "admin") redirect("/home");
  return { user, profile: profile! };
}

/**
 * Effective plan for the user, read from user_entitlements (written only by the
 * server/Stripe webhook — users cannot modify it under RLS).
 */
export const getUserPlan = cache(async (userId: string): Promise<Plan> => {
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("user_entitlements").select("plan, valid_until").eq("user_id", userId).maybeSingle();
  if (!data) return "free";
  if (data.valid_until && new Date(data.valid_until as string).getTime() < Date.now()) return "free";
  return (data.plan as Plan) ?? "free";
});

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
