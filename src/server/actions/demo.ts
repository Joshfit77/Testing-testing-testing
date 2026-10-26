"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { actionError, type ActionState } from "@/lib/action-state";
import { signupAcceptances } from "@/lib/legal/versions";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { demoAccount, isDemoMode, isDemoUser } from "@/server/demo";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";

/** Enter the seeded demo account (sample data, Pro switched on). Demo deployments only. */
export async function enterDemoAction(_prev: ActionState): Promise<ActionState> {
  const account = demoAccount();
  if (!account) return actionError("The demo isn't set up on this server.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(account);
  if (error) {
    logError("demo.enter", error);
    return actionError("The demo account couldn't sign in. Re-run the demo seed script.");
  }
  redirect("/home");
}

/**
 * Start a brand-new, empty demo account to walk through onboarding as a new member would. The account is marked
 * as a demo account by the server, starts on Free, and lives only in the demo database.
 */
export async function startFreshDemoAction(_prev: ActionState): Promise<ActionState> {
  if (!isDemoMode()) return actionError("The demo isn't set up on this server.");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`demo-fresh:${ip}`, 10, 60 * 60_000).ok) return actionError("Too many new demo accounts from here. Please try again later.");
  const email = `new-member-${randomUUID().slice(0, 8)}@demo.narrowgatefitness.invalid`;
  const password = randomBytes(24).toString("base64url");
  const admin = getServiceSupabase();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { demo: true },
    // The same records a real sign-up makes when the member ticks the Terms, Privacy Policy and acknowledgment boxes.
    user_metadata: { display_name: "New Member", legal_acceptances: signupAcceptances() },
  });
  if (createErr) {
    logError("demo.fresh", createErr);
    return actionError("Couldn't start a new demo account. Please try again.");
  }
  const { error } = await (await getServerSupabase()).auth.signInWithPassword({ email, password });
  if (error) {
    logError("demo.fresh_signin", error);
    return actionError("Couldn't sign in to the new demo account. Please try again.");
  }
  redirect("/onboarding");
}

/** Switch the signed-in demo account between Free and Pro All Access (a server-held test entitlement). */
export async function setDemoPlanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const plan = formData.get("plan");
  if (!isDemoMode() || !isDemoUser(user) || (plan !== "free" && plan !== "pro")) return;
  const { error } = await getServiceSupabase()
    .from("user_entitlements")
    .upsert({ user_id: user.id, plan, source: plan === "pro" ? "admin" : "default", valid_until: null }, { onConflict: "user_id" });
  if (error) logError("demo.plan", error);
  revalidatePath("/", "layout");
}
