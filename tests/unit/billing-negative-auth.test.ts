import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Negative authorization for the billing entry points a member (or a stranger) can reach, with the services mocked:
 * the in-app purchase sync only ever syncs the signed-in member, refuses without a session, when rate-limited or when
 * the server isn't configured; the RevenueCat webhook refuses when it isn't configured; and only admins can change
 * the sandbox tester list. (Database-level refusals are covered in tests/integration/billing-integrity.test.ts,
 * pro-bypass.test.ts and store-billing.test.ts.)
 */
const state = { user: null as { id: string } | null, admin: false, configured: true, webhookConfigured: true, rateOk: true };
const syncStoreSubscriber = vi.fn(async (_id: string) => "pro" as const);
const handleRevenueCatEvent = vi.fn(async () => "processed" as const);
const addSandboxTester = vi.fn();
const removeSandboxTester = vi.fn();
class Redirect extends Error {}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => {
    if (!state.user) throw new Redirect("/login");
    return state.user;
  }),
  requireAdmin: vi.fn(async () => {
    if (!state.user) throw new Redirect("/login");
    if (!state.admin) throw new Redirect("/home");
    return { user: state.user, profile: { role: "admin" } };
  }),
}));
vi.mock("@/server/env", () => ({
  isRevenueCatConfigured: () => state.configured,
  isServiceRoleConfigured: () => state.configured,
  isRevenueCatWebhookConfigured: () => state.webhookConfigured,
  serverEnv: {},
}));
vi.mock("@/server/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: state.rateOk })) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@/server/services/store-billing", () => ({
  syncStoreSubscriber: (id: string) => syncStoreSubscriber(id),
  handleRevenueCatEvent: () => handleRevenueCatEvent(),
  webhookAuthorized: (h: string | null) => h === "Bearer right",
}));
vi.mock("@/server/services/sandbox-testers", () => ({
  addSandboxTester: (...a: unknown[]) => addSandboxTester(...a),
  removeSandboxTester: (...a: unknown[]) => removeSandboxTester(...a),
  resolveAccount: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" })),
}));
vi.mock("@/server/services/billing", () => ({ recomputeEntitlement: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: vi.fn(() => ({ from: () => ({ insert: vi.fn(async () => ({ error: null })) }) })) }));

const { syncStorePurchasesAction } = await import("@/server/actions/store-billing");
const { POST: webhook } = await import("@/app/api/revenuecat/webhook/route");
const { addSandboxTesterAction, removeSandboxTesterAction } = await import("@/server/actions/admin-sandbox-testers");
const { NextRequest } = await import("next/server");

const ME = "3f1c6a52-1b2c-4d3e-8f90-123456789abc";
const VICTIM = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

beforeEach(() => {
  Object.assign(state, { user: { id: ME }, admin: false, configured: true, webhookConfigured: true, rateOk: true });
  vi.clearAllMocks();
});

describe("in-app purchase sync (syncStorePurchasesAction)", () => {
  it("refuses without a session and touches nothing", async () => {
    state.user = null;
    await expect(syncStorePurchasesAction()).rejects.toBeInstanceOf(Redirect);
    expect(syncStoreSubscriber).not.toHaveBeenCalled();
  });
  it("only ever syncs the signed-in member, whatever the caller passes", async () => {
    const call = syncStorePurchasesAction as unknown as (...a: unknown[]) => ReturnType<typeof syncStorePurchasesAction>;
    await expect(call(VICTIM, { userId: VICTIM })).resolves.toEqual({ ok: true, plan: "pro" });
    expect(syncStoreSubscriber.mock.calls).toEqual([[ME]]);
  });
  it("is rate-limited per member, and refuses when billing isn't configured", async () => {
    state.rateOk = false;
    expect(await syncStorePurchasesAction()).toMatchObject({ ok: false });
    state.rateOk = true;
    state.configured = false;
    expect(await syncStorePurchasesAction()).toMatchObject({ ok: false, error: expect.stringMatching(/aren't configured/) });
    expect(syncStoreSubscriber).not.toHaveBeenCalled();
  });
});

describe("RevenueCat webhook", () => {
  const post = (auth?: string) =>
    webhook(
      new NextRequest("http://localhost/api/revenuecat/webhook", {
        method: "POST",
        body: JSON.stringify({ api_version: "1.0", event: { id: "e1", type: "INITIAL_PURCHASE", app_user_id: VICTIM } }),
        headers: auth ? { authorization: auth } : {},
      }),
    );
  it("returns 503 and processes nothing while it isn't configured (even with a 'valid' header)", async () => {
    state.webhookConfigured = false;
    expect((await post("Bearer right")).status).toBe(503);
    expect(handleRevenueCatEvent).not.toHaveBeenCalled();
  });
  it("refuses a missing or wrong Authorization header", async () => {
    expect((await post()).status).toBe(401);
    expect((await post("Bearer wrong")).status).toBe(401);
    expect(handleRevenueCatEvent).not.toHaveBeenCalled();
  });
});

describe("sandbox tester list (admin only)", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  it("a member who isn't an admin can't add or remove testers (including themselves)", async () => {
    await expect(addSandboxTesterAction({ ok: true } as never, form({ account: ME, note: "me" }))).rejects.toBeInstanceOf(Redirect);
    await expect(removeSandboxTesterAction(form({ userId: ME }))).rejects.toBeInstanceOf(Redirect);
    state.user = null;
    await expect(addSandboxTesterAction({ ok: true } as never, form({ account: ME }))).rejects.toBeInstanceOf(Redirect);
    expect(addSandboxTester).not.toHaveBeenCalled();
    expect(removeSandboxTester).not.toHaveBeenCalled();
  });
});

describe("sandbox purchases on a production deployment", () => {
  it("blanket sandbox / Test Store acceptance is ignored once real charges are approved", async () => {
    vi.resetModules();
    vi.doUnmock("@/server/env");
    const prev = { ...process.env };
    try {
      process.env.REVENUECAT_ALLOW_SANDBOX = "true";
      process.env.REVENUECAT_ALLOW_TEST_STORE = "true";
      process.env.STRIPE_LIVE_APPROVED = "";
      let env = (await import("@/server/env")).serverEnv;
      expect([env.revenueCatAllowSandbox, env.revenueCatAllowTestStore]).toEqual([true, true]); // a test deployment
      vi.resetModules();
      process.env.STRIPE_LIVE_APPROVED = "true";
      env = (await import("@/server/env")).serverEnv;
      expect([env.revenueCatAllowSandbox, env.revenueCatAllowTestStore]).toEqual([false, false]);
    } finally {
      process.env = prev;
      vi.resetModules();
    }
  });
});
