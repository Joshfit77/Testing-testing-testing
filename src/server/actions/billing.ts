"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/action-state";
import { getPlans } from "@/lib/domain/plans";
import { getUserPlan, requireUser } from "@/server/auth";
import { isServiceRoleConfigured, isStripeConfigured, isYearlyBillingConfigured } from "@/server/env";
import { getNativePlatform } from "@/server/native";
import { createCheckoutSession, createPortalSession } from "@/server/services/billing";
import { logError } from "@/server/log";

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const plan = z.enum(["plus", "pro"]).safeParse(formData.get("plan"));
  const interval = z.enum(["month", "year"]).safeParse(formData.get("interval") ?? "month");
  if (!plan.success || !interval.success) return actionError("Choose a plan.");
  if (await getNativePlatform()) return actionError("Subscriptions can't be purchased inside the mobile app yet.");
  if (!isStripeConfigured() || !isServiceRoleConfigured()) return actionError("Payments aren't configured on this server yet.");
  // Yearly is offered only when yearly billing is switched on and the plan's yearly Stripe price is configured.
  if (interval.data === "year" && (!getPlans()[plan.data].yearlyPriceCents || !isYearlyBillingConfigured(plan.data))) return actionError("Yearly billing isn't offered right now.");
  const current = await getUserPlan(user.id);
  if (current !== "free") return actionError("You already have a subscription. Use “Manage billing” to change plans.");
  let url: string;
  try {
    url = await createCheckoutSession(user.id, user.email, plan.data, interval.data);
  } catch (err) {
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
