// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Demo mode must stay inert everywhere except a demo deployment, and even there the Free/Pro switch only works for
 * accounts the server itself marked as demo accounts.
 */

const requireUser = vi.fn();
const upsert = vi.fn();
const createUser = vi.fn();
const signInWithPassword = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/server/auth", () => ({ requireUser: () => requireUser() }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabase: () => ({ from: () => ({ upsert: (...a: unknown[]) => (upsert(...a), Promise.resolve({ error: null })) }), auth: { admin: { createUser } } }),
  getServerSupabase: async () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/server/log", () => ({ logError: vi.fn() }));

const demoUser = { id: "demo-user", app_metadata: { demo: true }, user_metadata: {} };
const realUser = { id: "real-user", app_metadata: {}, user_metadata: { demo: true } };
const form = (plan: string) => {
  const f = new FormData();
  f.set("plan", plan);
  return f;
};

beforeEach(() => {
  vi.resetModules();
  for (const fn of [requireUser, upsert, createUser, signInWithPassword, revalidatePath]) fn.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("demo helpers", () => {
  it("are off unless DEMO_MODE is exactly 'true'", async () => {
    for (const v of ["", "1", "TRUE", "yes"]) {
      vi.stubEnv("DEMO_MODE", v);
      const { isDemoMode } = await import("@/server/demo");
      expect(isDemoMode()).toBe(false);
    }
    vi.stubEnv("DEMO_MODE", "true");
    expect((await import("@/server/demo")).isDemoMode()).toBe(true);
  });

  it("only trusts app_metadata (set by the server), never user_metadata (set by the member)", async () => {
    const { isDemoUser } = await import("@/server/demo");
    expect(isDemoUser(demoUser)).toBe(true);
    expect(isDemoUser(realUser)).toBe(false);
    expect(isDemoUser({ app_metadata: { demo: "true" } })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
  });

  it("offers the sample account and simulated AI only in demo mode", async () => {
    vi.stubEnv("DEMO_ACCOUNT_EMAIL", "sample@demo.invalid");
    vi.stubEnv("DEMO_ACCOUNT_PASSWORD", "pw");
    vi.stubEnv("DEMO_MODE", "");
    let demo = await import("@/server/demo");
    expect(demo.demoAccount()).toBeNull();
    expect(demo.demoAiSimulated()).toBe(false);
    vi.stubEnv("DEMO_MODE", "true");
    vi.resetModules();
    demo = await import("@/server/demo");
    expect(demo.demoAccount()).toEqual({ email: "sample@demo.invalid", password: "pw" });
    expect(demo.demoAiSimulated()).toBe(true);
  });
});

describe("payments in demo mode", () => {
  it("ignores Stripe and RevenueCat secrets, so checkout and store purchases are unavailable", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_rc");
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH", "Bearer x");
    const env = await import("@/server/env");
    expect(env.serverEnv.stripeSecretKey).toBe("");
    expect(env.serverEnv.stripeWebhookSecret).toBe("");
    expect(env.serverEnv.revenueCatSecretKey).toBe("");
    expect(env.serverEnv.revenueCatWebhookAuth).toBe("");
    expect(env.isStripeConfigured()).toBe(false);
  });

  it("leaves a normal deployment's test keys alone", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    const env = await import("@/server/env");
    expect(env.serverEnv.stripeSecretKey).toBe("sk_test_123");
    expect(env.serverEnv.stripeWebhookSecret).toBe("whsec_123");
  });
});

describe("setDemoPlanAction (the demo's Free/Pro switch)", () => {
  it("does nothing outside demo mode, even for a demo account", async () => {
    vi.stubEnv("DEMO_MODE", "");
    requireUser.mockResolvedValue(demoUser);
    const { setDemoPlanAction } = await import("@/server/actions/demo");
    await setDemoPlanAction(form("pro"));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does nothing for an account the server didn't mark as a demo account", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    requireUser.mockResolvedValue(realUser);
    const { setDemoPlanAction } = await import("@/server/actions/demo");
    await setDemoPlanAction(form("pro"));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("only accepts Free or Pro", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    requireUser.mockResolvedValue(demoUser);
    const { setDemoPlanAction } = await import("@/server/actions/demo");
    for (const p of ["plus", "admin", ""]) await setDemoPlanAction(form(p));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("writes a server-held test entitlement for a demo account in demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    requireUser.mockResolvedValue(demoUser);
    const { setDemoPlanAction } = await import("@/server/actions/demo");
    await setDemoPlanAction(form("pro"));
    expect(upsert).toHaveBeenCalledWith({ user_id: "demo-user", plan: "pro", source: "admin", valid_until: null }, { onConflict: "user_id" });
    await setDemoPlanAction(form("free"));
    expect(upsert).toHaveBeenLastCalledWith({ user_id: "demo-user", plan: "free", source: "default", valid_until: null }, { onConflict: "user_id" });
  });
});

describe("demo sign-in actions", () => {
  it("refuse outside demo mode without signing in or creating accounts", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("DEMO_ACCOUNT_EMAIL", "sample@demo.invalid");
    vi.stubEnv("DEMO_ACCOUNT_PASSWORD", "pw");
    const { enterDemoAction, startFreshDemoAction } = await import("@/server/actions/demo");
    expect((await enterDemoAction({ ok: false })).ok).toBe(false);
    expect((await startFreshDemoAction({ ok: false })).ok).toBe(false);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("marks fresh demo accounts as demo accounts in app_metadata and starts them on Free", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    createUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    signInWithPassword.mockResolvedValue({ error: null });
    const { startFreshDemoAction } = await import("@/server/actions/demo");
    await expect(startFreshDemoAction({ ok: false })).rejects.toThrow("redirect:/onboarding");
    const arg = createUser.mock.calls[0]![0] as { email: string; app_metadata: unknown; user_metadata: { legal_acceptances: unknown[] } };
    expect(arg.app_metadata).toEqual({ demo: true });
    expect(arg.email).toMatch(/@demo\.narrowgatefitness\.invalid$/);
    expect(arg.user_metadata.legal_acceptances.length).toBeGreaterThan(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("AI in demo mode", () => {
  it("is always simulated, ignores a real AI key and still counts as configured", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-real-key");
    const env = await import("@/server/env");
    const demo = await import("@/server/demo");
    expect(env.serverEnv.anthropicApiKey).toBe("");
    expect(env.isAiConfigured()).toBe(true);
    expect(demo.demoAiSimulated()).toBe(true);
  });

  it("is untouched outside demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const env = await import("@/server/env");
    const demo = await import("@/server/demo");
    expect(env.isAiConfigured()).toBe(false);
    expect(demo.demoAiSimulated()).toBe(false);
  });

  it("answers the SDK in-process with a labelled stream", async () => {
    const { simulatedFetch } = await import("@/lib/demo/simulated-ai");
    const res = await simulatedFetch("https://demo.invalid/v1/messages?beta=true", {
      method: "POST",
      body: JSON.stringify({ model: "m", stream: true, messages: [{ role: "user", content: "hello" }] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: message_stop");
    const reply = text
      .split("\n")
      .filter((l: string) => l.startsWith("data: "))
      .map((l: string) => (JSON.parse(l.slice(6)) as { delta?: { text?: string } }).delta?.text ?? "")
      .join("");
    expect(reply).toContain("Simulated demo reply — written by a script, not an AI model.");
    expect((await simulatedFetch("https://demo.invalid/v1/models", { method: "GET" })).status).toBe(404);
  });

  it("drives the real Anthropic SDK without any network request", async () => {
    const realFetch = globalThis.fetch;
    const spy = vi.fn(() => Promise.reject(new Error("network used")));
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const { simulatedFetch } = await import("@/lib/demo/simulated-ai");
      const client = new Anthropic({ apiKey: "demo-simulated", baseURL: "https://demo.invalid", fetch: simulatedFetch, maxRetries: 0 });
      const msg = await client.messages.create({ model: "m", max_tokens: 100, messages: [{ role: "user", content: "hello" }] });
      expect(JSON.stringify(msg.content)).toContain("Simulated demo reply");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
