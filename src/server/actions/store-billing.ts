"use server";

import { revalidatePath } from "next/cache";
import type { Plan } from "@/lib/domain/types";
import { requireUser } from "@/server/auth";
import { isRevenueCatConfigured, isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";
import { syncStoreSubscriber } from "@/server/services/store-billing";

/**
 * Re-read the signed-in member's App Store / Google Play purchases from RevenueCat, after a purchase or
 * "Restore purchases" in the app, so the plan updates without waiting for the webhook. The app never says what
 * was bought; the server asks RevenueCat.
 */
export async function syncStorePurchasesAction(): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!isRevenueCatConfigured() || !isServiceRoleConfigured()) return { ok: false, error: "In-app purchases aren't configured on this server yet." };
  if (!(await rateLimit(`store-sync:${user.id}`, 10, 60_000)).ok) return { ok: false, error: "Please wait a moment and try again." };
  try {
    const plan = await syncStoreSubscriber(user.id);
    revalidatePath("/profile/billing");
    revalidatePath("/", "layout");
    return { ok: true, plan: plan ?? "free" };
  } catch (err) {
    logError("revenuecat.sync", err);
    return { ok: false, error: "We couldn't check your purchases. Please try again in a moment." };
  }
}
