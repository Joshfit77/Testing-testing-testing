import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const noLog = () => undefined;

/**
 * Account deletion must never leave a person billed for an account that is gone. Cancelling their Stripe
 * subscriptions is the first step, and the deletion stops if it fails. A deployment on which Stripe can't be used
 * (key missing, or a live key not approved for charges: src/server/env.ts) can't cancel anything, so a member with
 * an open Stripe subscription on record must not be deleted there: the subscription would keep charging them, with
 * no account, customer link or subscription row left to trace it by.
 */
describe.skipIf(!available)("account deletion: an open Stripe subscription that can't be cancelled stops the deletion", async () => {
  const { serverEnv } = await import("@/server/env");
  const { cancelStripeSubscriptionsForUser } = await import("@/server/services/billing");
  const { deleteUserAccount } = await import("@/server/services/account-deletion");
  const admin = serviceClient();
  const configuredKey = serverEnv.stripeSecretKey;
  let subscriber: TestUser;
  let lapsed: TestUser;
  let plain: TestUser;

  const subscription = (u: TestUser, status: string) => ({
    user_id: u.id,
    stripe_subscription_id: `sub_del_${u.id.replace(/-/g, "").slice(0, 16)}`,
    stripe_price_id: "price_test_pro",
    plan: "pro",
    status,
    current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  });

  beforeAll(async () => {
    [subscriber, lapsed, plain] = await Promise.all([createTestUser("del-subscriber"), createTestUser("del-lapsed"), createTestUser("del-plain")]);
    for (const u of [subscriber, lapsed]) {
      const { error } = await admin.from("billing_customers").insert({ user_id: u.id, stripe_customer_id: `cus_del_${u.id.replace(/-/g, "").slice(0, 16)}` });
      if (error) throw error;
    }
    const { error } = await admin.from("subscriptions").insert([subscription(subscriber, "active"), subscription(lapsed, "canceled")]);
    if (error) throw error;
    // This deployment can't reach Stripe (as when STRIPE_SECRET_KEY is unset or a live key isn't approved).
    serverEnv.stripeSecretKey = "";
  });

  afterAll(async () => {
    serverEnv.stripeSecretKey = configuredKey;
    await Promise.all([subscriber, lapsed, plain].map((u) => admin.auth.admin.deleteUser(u.id).catch(() => null)));
  });

  it("refuses to treat an open subscription as cancelled when Stripe can't be used", async () => {
    await expect(cancelStripeSubscriptionsForUser(subscriber.id)).rejects.toThrow(/stripe/i);
  });

  it("deletes nothing of a member whose open subscription couldn't be cancelled", async () => {
    const r = await deleteUserAccount(subscriber.id, { admin, cancelSubscriptions: cancelStripeSubscriptionsForUser, deleteStripeCustomer: null, log: noLog });
    expect(r).toEqual({ ok: false, stage: "billing", subscriptionsCancelled: false, filesRemoved: false });
    expect((await admin.auth.admin.getUserById(subscriber.id)).data.user?.id).toBe(subscriber.id);
    const { data: sub } = await admin.from("subscriptions").select("status").eq("user_id", subscriber.id).single();
    expect(sub?.status).toBe("active");
  });

  it("still deletes members with nothing left to cancel: no billing record, or only an ended subscription", async () => {
    await expect(cancelStripeSubscriptionsForUser(plain.id)).resolves.toBeUndefined();
    await expect(cancelStripeSubscriptionsForUser(lapsed.id)).resolves.toBeUndefined();
    for (const u of [plain, lapsed]) {
      const r = await deleteUserAccount(u.id, { admin, cancelSubscriptions: cancelStripeSubscriptionsForUser, deleteStripeCustomer: null, log: noLog });
      expect(r).toEqual({ ok: true, stripeCustomerDeleted: null });
      expect((await admin.auth.admin.getUserById(u.id)).data.user).toBeNull();
    }
  });

  // Kept last: cleans up the member the tests above deliberately left in place.
  it("the member is deleted once nothing is open any more", async () => {
    await admin.from("subscriptions").update({ status: "canceled" }).eq("user_id", subscriber.id);
    const r = await deleteUserAccount(subscriber.id, { admin, cancelSubscriptions: cancelStripeSubscriptionsForUser, deleteStripeCustomer: null, log: noLog });
    expect(r).toEqual({ ok: true, stripeCustomerDeleted: null });
    await deleteTestUser(subscriber).catch(() => null);
  });
});
