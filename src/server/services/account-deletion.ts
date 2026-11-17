import type { SupabaseClient } from "@supabase/supabase-js";
import { removeUserStorage } from "@/server/services/account";
import { hashKey } from "@/server/rate-limit";

/**
 * Permanent account deletion, in an order that never leaves a person billed for an account that is gone:
 *
 *   1. Cancel active Stripe subscriptions. If this fails nothing else happens, so the account and the
 *      subscription stay exactly as they were.
 *   2. Remove stored files (progress photos, avatars). Storage objects don't cascade with the user.
 *   3. Delete the Supabase auth user. Every personal table references auth.users with `on delete cascade`
 *      (enforced by tests/unit/account-coverage.test.ts), so workouts, nutrition, journals, AI conversations
 *      and everything else go with it.
 *   3b. Remove the shared rate-limit counters keyed by the account ID or the hashed sign-in email. They have no foreign
 *      key, so nothing cascades to them; otherwise they would linger until the limiter's occasional clean-up. Best
 *      effort: a failure is logged, the account is already gone.
 *   4. Delete the Stripe customer record (name, email, payment methods) and the RevenueCat customer (App Store /
 *      Google Play purchase history). Best effort: the account is already gone, so a failure here is logged for
 *      follow-up instead of shown as a failed deletion. Store subscriptions can only be cancelled by the person
 *      in their App Store / Google Play settings; the deletion screen tells them so.
 *
 * Each step's failure is reported separately so the person is told exactly what did and didn't happen.
 */
export type DeletionFailure = "billing" | "storage" | "auth";

export type DeletionResult =
  | { ok: true; stripeCustomerDeleted: boolean | null }
  | { ok: false; stage: DeletionFailure; subscriptionsCancelled: boolean; filesRemoved: boolean };

export interface DeletionDeps {
  /** Service-role client. */
  admin: SupabaseClient;
  cancelSubscriptions: (userId: string) => Promise<void>;
  /** Deletes the Stripe customer; null when Stripe isn't configured. */
  deleteStripeCustomer: ((customerId: string) => Promise<void>) | null;
  /** Deletes the RevenueCat customer; null/absent when RevenueCat isn't configured. */
  deleteStoreCustomer?: ((userId: string) => Promise<void>) | null;
  removeStorage?: (admin: SupabaseClient, userId: string) => Promise<void>;
  /** Removes rate-limit counters keyed by the member (defaults to removeRateLimitCounters). */
  removeRateLimits?: (admin: SupabaseClient, userId: string, email: string | null) => Promise<void>;
  log: (scope: string, err: unknown, context?: Record<string, string | number | boolean | null>) => void;
}

export async function deleteUserAccount(userId: string, deps: DeletionDeps): Promise<DeletionResult> {
  const removeStorage = deps.removeStorage ?? removeUserStorage;

  // Read the Stripe customer id before the row cascades away with the user.
  // A failed read must stop the deletion: without the customer id the Stripe customer (and any subscription that
  // hasn't reached the local table yet) would outlive the account.
  const { data: customer, error: customerErr } = await deps.admin.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (customerErr) {
    deps.log("account.delete.billing_customer", customerErr);
    return { ok: false, stage: "billing", subscriptionsCancelled: false, filesRemoved: false };
  }
  const customerId = (customer?.stripe_customer_id as string | undefined) ?? null;

  try {
    await deps.cancelSubscriptions(userId);
  } catch (err) {
    deps.log("account.delete.billing", err);
    return { ok: false, stage: "billing", subscriptionsCancelled: false, filesRemoved: false };
  }

  try {
    await removeStorage(deps.admin, userId);
  } catch (err) {
    deps.log("account.delete.storage", err);
    return { ok: false, stage: "storage", subscriptionsCancelled: true, filesRemoved: false };
  }

  // The sign-in email, read while the auth user still exists, to find the counters keyed by its hash.
  const email = await accountEmail(deps.admin, userId);

  const { error } = await deps.admin.auth.admin.deleteUser(userId);
  if (error) {
    deps.log("account.delete.auth", error);
    return { ok: false, stage: "auth", subscriptionsCancelled: true, filesRemoved: true };
  }

  try {
    await (deps.removeRateLimits ?? removeRateLimitCounters)(deps.admin, userId, email);
  } catch (err) {
    deps.log("account.delete.rate_limits", err, { userId });
  }

  let stripeCustomerDeleted: boolean | null = null;
  if (customerId && deps.deleteStripeCustomer) {
    try {
      await deps.deleteStripeCustomer(customerId);
      stripeCustomerDeleted = true;
    } catch (err) {
      // Logged with the customer id so support can remove it by hand.
      deps.log("account.delete.stripe_customer", err, { customerId });
      stripeCustomerDeleted = false;
    }
  }
  if (deps.deleteStoreCustomer) {
    try {
      await deps.deleteStoreCustomer(userId);
    } catch (err) {
      deps.log("account.delete.revenuecat_customer", err, { userId });
    }
  }
  return { ok: true, stripeCustomerDeleted };
}

async function accountEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete the shared rate-limit counters (`rate_limit_counters`, migration 046) that name this member: keys of the form
 * `<action>:<account id>` (src/server/rate-limit.ts callers) and `<action>:<hashed email>[:ip:<hashed address>]`
 * (src/server/actions/auth.ts). Counters keyed only by a hashed IP address can't be tied to the member and are left
 * to the limiter's own clean-up. Service-role client only.
 */
export async function removeRateLimitCounters(admin: SupabaseClient, userId: string, email: string | null): Promise<void> {
  for (const part of email ? [userId, hashKey(email)] : [userId]) {
    const { error } = await admin.from("rate_limit_counters").delete().like("key", `%${part}%`);
    if (error) throw error;
  }
}

/** What to tell the person when deletion stops part-way. */
export function deletionFailureMessage(r: Extract<DeletionResult, { ok: false }>): string {
  if (r.stage === "billing") {
    return "We couldn't cancel your subscription, so nothing was deleted. Please try again in a few minutes, or cancel your plan from Billing first.";
  }
  const done = r.filesRemoved
    ? "Your subscription was cancelled and your photos were removed, but your account and the rest of your data still exist."
    : // Storage is emptied bucket by bucket, so a failure part-way can leave some photos already removed.
      "Your subscription was cancelled, but your account and your data still exist (some of your photos may already have been removed).";
  return `${done} Please try again. If it keeps failing, contact support and we'll finish the deletion for you.`;
}
