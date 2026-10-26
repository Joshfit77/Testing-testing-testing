"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/action-state";
import { getPlans } from "@/lib/domain/plans";
import { getUserPlan, requireUser } from "@/server/auth";
import { isServiceRoleConfigured, isStripeConfigured, isYearlyBillingConfigured } from "@/server/env";
import { getNativePlatform } from "@/server/native";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTO_RENEWAL_CONSENT, autoRenewalText } from "@/lib/legal/versions";
import { recordAcceptances } from "@/server/legal";
import { createCheckoutSession, createPortalSession, AlreadySubscribedError, PriceMismatchError, stripeProPrices } from "@/server/services/billing";
import { logError } from "@/server/log";

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  // Only Pro All Access is sold to new customers.
  const plan = z.enum(["pro"]).safeParse(formData.get("plan"));
  const interval = z.enum(["month", "year"]).safeParse(formData.get("interval") ?? "month");
  if (!plan.success || !interval.success) return actionError("Choose a plan.");
  // Auto-renewal consent: an unticked box naming the price and period (California and federal ROSCA expectations).
  if (formData.get("renewalConsent") !== "on") return actionError("Please tick the box to agree to automatic renewal before continuing.");
  if (await getNativePlatform()) return actionError("Subscriptions can't be purchased inside the mobile app yet.");
  if (!isStripeConfigured() || !isServiceRoleConfigured()) return actionError("Payments aren't configured on this server yet.");
  if (interval.data === "year" && (!getPlans().pro.yearlyPriceCents || !isYearlyBillingConfigured())) return actionError("Yearly billing isn't offered right now.");
  const current = await getUserPlan(user.id);
  if (current !== "free") {
    // One paid membership per person: a second purchase would bill them twice.
    const { data: ent } = await (await getServerSupabase()).from("user_entitlements").select("source").eq("user_id", user.id).maybeSingle();
    if (ent?.source === "app_store" || ent?.source === "play_store")
      return actionError(`Your membership is billed through ${ent.source === "app_store" ? "the App Store" : "Google Play"}. Change it in the app on your phone so you're never billed twice.`);
    return actionError("You already have a membership. Use “Manage billing” to change it.");
  }
  let url: string;
  try {
    // Record the consent with the price Stripe will charge (the checkout below refuses a price that differs from it).
    const info = (await stripeProPrices())[interval.data];
    const price = info?.unitAmount != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: info.currency.toUpperCase() }).format(info.unitAmount / 100) : "the price shown";
    await recordAcceptances(
      user.id,
      [{ document: "auto_renewal", version: AUTO_RENEWAL_CONSENT.version, sha256: AUTO_RENEWAL_CONSENT.sha256, details: autoRenewalText(price, interval.data).slice(0, 300) }],
      "checkout",
    );
    url = await createCheckoutSession(user.id, user.email, plan.data, interval.data);
  } catch (err) {
    if (err instanceof AlreadySubscribedError) return actionError("You already have a subscription. Use “Manage billing” to change plans.");
    if (err instanceof PriceMismatchError) {
      logError("billing.price_mismatch", err);
      return actionError("Checkout is paused while we correct a pricing setting. You haven't been charged. Please try again later.");
    }
    logError("billing.checkout", err);
    return actionError("We couldn't start checkout. Please try again in a moment.");
  }
  redirect(url);
}

export async function openBillingPortalAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  if (!isStripeConfigured() || !isServiceRoleConfigured()) return actionError("Payments aren't configured on this server yet.");
  let url: string;
  try {
    url = await createPortalSession(user.id);
  } catch (err) {
    logError("billing.portal", err);
    return actionError("We couldn't open the billing portal. If you've never subscribed, choose a plan first.");
  }
  redirect(url);
}
