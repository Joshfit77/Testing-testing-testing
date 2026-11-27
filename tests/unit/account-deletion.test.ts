import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteUserAccount, deletionFailureMessage, type DeletionDeps } from "@/server/services/account-deletion";

function fakeAdmin(opts: { customerId?: string | null; deleteError?: unknown; readError?: unknown } = {}) {
  const calls: string[] = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => (opts.readError ? { data: null, error: opts.readError } : { data: opts.customerId ? { stripe_customer_id: opts.customerId } : null, error: null }) }) }),
    }),
    auth: {
      admin: {
        deleteUser: async () => {
          calls.push("auth");
          return { error: opts.deleteError ?? null };
        },
      },
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

function deps(over: Partial<DeletionDeps> & { calls: string[]; admin: SupabaseClient }): DeletionDeps {
  return {
    cancelSubscriptions: async () => void over.calls.push("billing"),
    removeStorage: async () => void over.calls.push("storage"),
    removeRateLimits: async () => void over.calls.push("rate_limits"),
    deleteStripeCustomer: async () => void over.calls.push("customer"),
    log: () => undefined,
    ...over,
  };
}

describe("account deletion order and failures", () => {
  it("stops before touching anything when the Stripe customer can't be read (no subscription may outlive the account)", async () => {
    const { admin, calls } = fakeAdmin({ readError: { message: "timeout" } });
    const r = await deleteUserAccount("u1", deps({ admin, calls }));
    expect(r).toEqual({ ok: false, stage: "billing", subscriptionsCancelled: false, filesRemoved: false });
    expect(calls).toEqual([]);
  });

  it("cancels billing, removes files, deletes the user, clears its rate-limit counters, then removes the Stripe customer", async () => {
    const { admin, calls } = fakeAdmin({ customerId: "cus_123" });
    const r = await deleteUserAccount("u1", deps({ admin, calls }));
    expect(r).toEqual({ ok: true, stripeCustomerDeleted: true });
    expect(calls).toEqual(["billing", "storage", "auth", "rate_limits", "customer"]);
  });

  it("deletes nothing when billing can't be cancelled", async () => {
    const { admin, calls } = fakeAdmin();
    const r = await deleteUserAccount("u1", deps({ admin, calls, cancelSubscriptions: async () => Promise.reject(new Error("stripe down")) }));
    expect(r).toMatchObject({ ok: false, stage: "billing", subscriptionsCancelled: false });
    expect(calls).toEqual([]);
    if (!r.ok) expect(deletionFailureMessage(r)).toMatch(/nothing was deleted/);
  });

  it("keeps the account when stored files can't be removed, and says the subscription was cancelled", async () => {
    const { admin, calls } = fakeAdmin();
    const r = await deleteUserAccount("u1", deps({ admin, calls, removeStorage: async () => Promise.reject(new Error("storage")) }));
    expect(r).toMatchObject({ ok: false, stage: "storage", subscriptionsCancelled: true, filesRemoved: false });
    expect(calls).toEqual(["billing"]);
    if (!r.ok) {
      // Storage is emptied bucket by bucket, so the message must not claim that no file was touched.
      expect(deletionFailureMessage(r)).toMatch(/subscription was cancelled, but your account and your data still exist/);
      expect(deletionFailureMessage(r)).toMatch(/some of your photos may already have been removed/);
    }
  });

  it("reports an auth failure after files were removed", async () => {
    const { admin, calls } = fakeAdmin({ deleteError: new Error("auth") });
    const r = await deleteUserAccount("u1", deps({ admin, calls }));
    expect(r).toMatchObject({ ok: false, stage: "auth", filesRemoved: true });
    // The account still exists, so its counters (including the delete-attempt limit) stay.
    expect(calls).toEqual(["billing", "storage", "auth"]);
    if (!r.ok) expect(deletionFailureMessage(r)).toMatch(/photos were removed, but your account/);
  });

  it("treats a failed Stripe customer removal as logged follow-up, not a failed deletion", async () => {
    const { admin, calls } = fakeAdmin({ customerId: "cus_9" });
    const log = vi.fn();
    const r = await deleteUserAccount("u1", deps({ admin, calls, log, deleteStripeCustomer: async () => Promise.reject(new Error("x")) }));
    expect(r).toEqual({ ok: true, stripeCustomerDeleted: false });
    expect(log).toHaveBeenCalledWith("account.delete.stripe_customer", expect.anything(), expect.objectContaining({ customerId: "cus_9" }));
  });

  it("skips the Stripe customer step when there is no customer or Stripe isn't configured", async () => {
    const a = fakeAdmin();
    expect(await deleteUserAccount("u1", deps({ admin: a.admin, calls: a.calls }))).toEqual({ ok: true, stripeCustomerDeleted: null });
    const b = fakeAdmin({ customerId: "cus_1" });
    expect(await deleteUserAccount("u1", deps({ admin: b.admin, calls: b.calls, deleteStripeCustomer: null }))).toEqual({ ok: true, stripeCustomerDeleted: null });
  });

  it("treats a failed rate-limit clean-up as logged follow-up, not a failed deletion", async () => {
    const { admin, calls } = fakeAdmin({ customerId: "cus_7" });
    const log = vi.fn();
    const r = await deleteUserAccount("u1", deps({ admin, calls, log, removeRateLimits: async () => Promise.reject(new Error("db")) }));
    expect(r).toEqual({ ok: true, stripeCustomerDeleted: true });
    expect(calls).toEqual(["billing", "storage", "auth", "customer"]);
    expect(log).toHaveBeenCalledWith("account.delete.rate_limits", expect.anything(), expect.objectContaining({ userId: "u1" }));
  });
});
