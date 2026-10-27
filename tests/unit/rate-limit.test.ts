import { hashKey, rateLimit, rateLimitAll, rateLimitLocal } from "@/server/rate-limit";

// No SUPABASE_SERVICE_ROLE_KEY in unit tests, so rateLimit() uses the per-instance fallback.
describe("rate limiting", () => {
  it("allows up to the limit, then reports when to retry", () => {
    const key = `local:${Math.random()}`;
    expect(rateLimitLocal(key, 2, 60_000).ok).toBe(true);
    expect(rateLimitLocal(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimitLocal(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("falls back to the local limiter when the shared store isn't configured", async () => {
    const key = `shared:${Math.random()}`;
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
  });

  it("stops at the first exceeded limit", async () => {
    const tight = `tight:${Math.random()}`;
    const loose = `loose:${Math.random()}`;
    await rateLimit(tight, 1, 60_000);
    const r = await rateLimitAll([
      { key: loose, limit: 100, windowMs: 60_000 },
      { key: tight, limit: 1, windowMs: 60_000 },
    ]);
    expect(r.ok).toBe(false);
  });

  it("hashes identifiers so counters never hold raw email addresses", () => {
    expect(hashKey(" Someone@Example.com ")).toBe(hashKey("someone@example.com"));
    expect(hashKey("someone@example.com")).not.toContain("@");
    expect(hashKey("a@example.com")).not.toBe(hashKey("b@example.com"));
  });
});
