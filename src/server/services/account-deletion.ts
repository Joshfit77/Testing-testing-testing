import type { SupabaseClient } from "@supabase/supabase-js";
import { removeUserStorage } from "@/server/services/account";

/**
 * Permanent account deletion, in an order that never leaves a person billed for an account that is gone:
 *
 *   1. Cancel active Stripe subscriptions. If this fails nothing else happens, so the account and the
 *      subscription stay exactly as they were.
 *   2. Remove stored files (progress photos, avatars). Storage objects don't cascade with the user.
 *   3. Delete the Supabase auth user. Every personal table references auth.users with `on delete cascade`
 *      (enforced by tests/unit/account-coverage.test.ts), so workouts, nutrition, journals, AI conversations
 *      and everything else go with it.
 *   4. Delete the Stripe customer record (name, email, payment methods). Best effort: the account is
 *      already gone, so a failure here is logged for follow-up instead of shown as a failed deletion.
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
  removeStorage?: (admin: SupabaseClient, userId: string) => Promise<void>;
  log: (scope: string, err: unknown) => void;
}

export async function deleteUserAccount(userId: string, deps: DeletionDeps): Promise<DeletionResult> {
  const removeStorage = deps.removeStorage ?? removeUserStorage;

  // Read the Stripe customer id before the row cascades away with the user.
  const { data: customer } = await deps.admin.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
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

  const { error } = await deps.admin.auth.admin.deleteUser(userId);
  if (error) {
    deps.log("account.delete.auth", error);
    return { ok: false, stage: "auth", subscriptionsCancelled: true, filesRemoved: true };
  }

  let stripeCustomerDeleted: boolean | null = null;
  if (customerId && deps.deleteStripeCustomer) {
    try {
      await deps.deleteStripeCustomer(customerId);
      stripeCustomerDeleted = true;
    } catch (err) {
      // Logged with the customer id so support can remove it by hand.
      deps.log("account.delete.stripe_customer", { customerId, err });
      stripeCustomerDeleted = false;
    }
  }
  return { ok: true, stripeCustomerDeleted };
}

/** What to tell the person when deletion stops part-way. */
export function deletionFailureMessage(r: Extract<DeletionResult, { ok: false }>): string {
  if (r.stage === "billing") {
    return "We couldn't cancel your subscription, so nothing was deleted. Please try again in a few minutes, or cancel your plan from Billing first.";
  }
  const done = r.filesRemoved
    ? "Your subscription was cancelled and your photos were removed, but your account and the rest of your data still exist."
    : "Your subscription was cancelled, but nothing else was deleted.";
  return `${done} Please try again. If it keeps failing, contact support and we'll finish the deletion for you.`;
}
