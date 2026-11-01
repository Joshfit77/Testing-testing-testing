// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The shared limiter's decisions come from the database; if the database can't be used it falls back to the
 * per-instance limiter instead of failing open or blocking everyone.
 */
const rpc = vi.fn();
let serviceRole = true;
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: () => ({ rpc }) }));
vi.mock("@/server/env", () => ({ isServiceRoleConfigured: () => serviceRole }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));

beforeEach(() => {
  rpc.mockReset();
  serviceRole = true;
});

describe("shared rate limiter", () => {
  it("uses the database's decision and its retry time", async () => {
    const { rateLimit } = await import("@/server/rate-limit");
    rpc.mockResolvedValueOnce({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    expect(await rateLimit("food:u1", 5, 60_000)).toEqual({ ok: true, retryAfterSeconds: 0 });
    rpc.mockResolvedValueOnce({ data: [{ allowed: false, retry_after_seconds: 42 }], error: null });
    expect(await rateLimit("food:u1", 5, 60_000)).toEqual({ ok: false, retryAfterSeconds: 42 });
    expect(rpc).toHaveBeenLastCalledWith("rate_limit_hit", { p_key: "food:u1", p_limit: 5, p_window_seconds: 60 });
  });

  it("falls back to the per-instance limiter when the database errors or isn't configured", async () => {
    const { rateLimit } = await import("@/server/rate-limit");
    rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const key = `fallback:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60_000));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    serviceRole = false;
    const key2 = `local:${Math.random()}`;
    expect((await rateLimit(key2, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key2, 1, 60_000)).ok).toBe(false);
  });

  it("checks several limits and stops at the first exceeded; keys never hold the address or email in clear", async () => {
    const { rateLimitAll, hashKey, clientIp } = await import("@/server/rate-limit");
    rpc.mockResolvedValueOnce({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null }).mockResolvedValueOnce({ data: [{ allowed: false, retry_after_seconds: 9 }], error: null });
    expect(await rateLimitAll([{ key: "a", limit: 1, windowMs: 1000 }, { key: "b", limit: 1, windowMs: 1000 }, { key: "c", limit: 1, windowMs: 1000 }])).toEqual({ ok: false, retryAfterSeconds: 9 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(await clientIp()).toBe("203.0.113.7");
    const h = hashKey("Member@Example.com ");
    expect(h).toBe(hashKey("member@example.com"));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain("example");
  });
});

describe("webhook failure codes", () => {
  it("record the error's class and code only, never its message", async () => {
    const { webhookErrorCode } = await import("@/server/services/webhook-events");
    const err = Object.assign(new Error("Customer jane@example.com card 4242 declined"), { name: "StripeCardError", code: "card_declined", statusCode: 402 });
    const code = webhookErrorCode(err);
    expect(code).toBe("StripeCardError:card_declined:402");
    expect(code).not.toMatch(/jane|4242|declined /);
    expect(webhookErrorCode(undefined)).toBe("Error");
  });
});
