import { afterAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * A web (Stripe) subscription's lifecycle through the real database (upsert_stripe_subscription, apply_entitlement):
 * the stored entitlement's plan AND its end date (`valid_until`) follow renewal, cancellation at the period end, the
 * end itself, and the trialing / paused statuses. Only the configured test prices are used, so nothing calls Stripe.
 */
const available = await stackAvailable();
const day = 86_400;

function stripeSub(userId: string, over: { status?: string; periodEnd?: number; price?: string; cancelAtPeriodEnd?: boolean; id?: string } = {}): Stripe.Subscription {
  return {
    id: over.id ?? `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
    object: "subscription",
    customer: `cus_${userId.replace(/-/g, "").slice(0, 16)}`,
    status: over.status ?? "active",
    cancel_at_period_end: over.cancelAtPeriodEnd ?? false,
    metadata: { user_id: userId },
    items: { object: "list", data: [{ id: "si_1", price: { id: over.price ?? "price_test_pro" }, current_period_end: over.periodEnd ?? Math.floor(Date.now() / 1000) + 30 * day }] },
  } as unknown as Stripe.Subscription;
}

describe.skipIf(!available)("subscription lifecycle: renewal, cancellation, expiry, trialing, paused", async () => {
  const { syncSubscription } = await import("@/server/services/billing");
  const svc = serviceClient();
  const users: TestUser[] = [];
  const newUser = async (label: string) => {
    const u = await createTestUser(label);
    users.push(u);
    return u;
  };
  const ent = async (u: TestUser) => (await svc.from("user_entitlements").select("plan, source, valid_until").eq("user_id", u.id).single()).data;
  /** Each sync is a newer read of Stripe than the one before (an older read never overwrites a newer one). */
  let clock = Date.now();
  const sync = (sub: Stripe.Subscription) => syncSubscription(sub, new Date((clock += 1000)));

  afterAll(async () => {
    for (const u of users) await deleteTestUser(u);
  });

  it("a renewal moves the entitlement's end date to the new period end", async () => {
    const u = await newUser("renewal");
    const firstEnd = Math.floor(Date.now() / 1000) + 3 * day;
    const sub = stripeSub(u.id, { periodEnd: firstEnd });
    await sync(sub);
    const before = await ent(u);
    expect(before).toMatchObject({ plan: "pro", source: "stripe" });
    expect(Date.parse(before!.valid_until!)).toBe(firstEnd * 1000);

    const renewedEnd = firstEnd + 30 * day;
    await sync(stripeSub(u.id, { id: sub.id, periodEnd: renewedEnd }));
    const after = await ent(u);
    expect(after).toMatchObject({ plan: "pro", source: "stripe" });
    expect(Date.parse(after!.valid_until!)).toBe(renewedEnd * 1000);
  });

  it("cancellation keeps Pro until the period end (stored as the end date), then the ended subscription removes it", async () => {
    const u = await newUser("cancel-at-end");
    const end = Math.floor(Date.now() / 1000) + 10 * day;
    const sub = stripeSub(u.id, { periodEnd: end });
    await sync(sub);
    await sync(stripeSub(u.id, { id: sub.id, periodEnd: end, cancelAtPeriodEnd: true }));
    const cancelling = await ent(u);
    expect(cancelling).toMatchObject({ plan: "pro" });
    expect(Date.parse(cancelling!.valid_until!)).toBe(end * 1000);
    expect((await svc.from("subscriptions").select("cancel_at_period_end, status").eq("stripe_subscription_id", sub.id).single()).data).toMatchObject({
      cancel_at_period_end: true,
      status: "active",
    });

    // At the period end Stripe ends the subscription (customer.subscription.deleted).
    await sync(stripeSub(u.id, { id: sub.id, periodEnd: Math.floor(Date.now() / 1000) - 60, status: "canceled", cancelAtPeriodEnd: true }));
    expect(await ent(u)).toMatchObject({ plan: "free", source: "default", valid_until: null });
  });

  it("an entitlement whose end date has passed counts as Free in the database even before any webhook arrives", async () => {
    const u = await newUser("lapsed");
    const sub = stripeSub(u.id);
    await sync(sub);
    // The renewal webhook never came: the stored end date passes.
    await svc.from("user_entitlements").update({ valid_until: new Date(Date.now() - 60_000).toISOString() }).eq("user_id", u.id);
    const { data: plan, error } = await svc.rpc("plan_of", { p_user_id: u.id });
    expect(error).toBeNull();
    expect(plan).toBe("free");
  });

  it("trialing grants Pro; paused (and incomplete) grant nothing", async () => {
    const trial = await newUser("trialing");
    await sync(stripeSub(trial.id, { status: "trialing", periodEnd: Math.floor(Date.now() / 1000) + 7 * day }));
    expect(await ent(trial)).toMatchObject({ plan: "pro", source: "stripe" });

    const paused = await newUser("paused");
    const sub = stripeSub(paused.id);
    await sync(sub);
    expect(await ent(paused)).toMatchObject({ plan: "pro" });
    await sync(stripeSub(paused.id, { id: sub.id, status: "paused" }));
    expect(await ent(paused)).toMatchObject({ plan: "free" });
    await sync(stripeSub(paused.id, { id: sub.id, status: "incomplete" }));
    expect(await ent(paused)).toMatchObject({ plan: "free" });
  });

  it("annual Pro stores the year-long end date", async () => {
    const u = await newUser("annual");
    const end = Math.floor(Date.now() / 1000) + 365 * day;
    await sync(stripeSub(u.id, { price: "price_test_pro_yearly", periodEnd: end }));
    const row = await ent(u);
    expect(row).toMatchObject({ plan: "pro" });
    expect(Date.parse(row!.valid_until!)).toBe(end * 1000);
  });
});
