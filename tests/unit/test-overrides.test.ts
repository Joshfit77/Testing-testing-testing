import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { anthropicBaseUrl, authRateLimitScale, isLoopbackUrl, localStandIn, openFoodFactsOrigin } = await import("@/server/test-overrides");

describe("test-only overrides never reach another host in production", () => {
  it("honours a stand-in only on this machine", () => {
    expect(localStandIn("http://127.0.0.1:4613")).toBe("http://127.0.0.1:4613");
    expect(localStandIn("http://localhost:4611/")).toBe("http://localhost:4611");
    expect(localStandIn("https://evil.example.com")).toBeNull();
    expect(localStandIn("http://10.0.0.5:4613")).toBeNull();
    expect(localStandIn("http://127.0.0.1.evil.com")).toBeNull();
    expect(localStandIn("not a url")).toBeNull();
    expect(localStandIn(undefined)).toBeNull();
    expect(isLoopbackUrl("ftp://localhost")).toBe(false);
  });

  it("the AI client always gets an explicit base URL, so the SDK can't read a remote one from the environment", () => {
    expect(anthropicBaseUrl("http://127.0.0.1:4777")).toBe("http://127.0.0.1:4777");
    expect(anthropicBaseUrl("https://attacker.example")).toBe("https://api.anthropic.com");
    expect(anthropicBaseUrl(undefined)).toBe("https://api.anthropic.com");
  });

  it("Open Food Facts: local stand-in or an https mirror; plain http elsewhere is refused", () => {
    expect(openFoodFactsOrigin(undefined)).toBe("https://world.openfoodfacts.org");
    expect(openFoodFactsOrigin("http://127.0.0.1:4778/")).toBe("http://127.0.0.1:4778");
    expect(openFoodFactsOrigin("https://mirror.example.org/")).toBe("https://mirror.example.org");
    expect(openFoodFactsOrigin("http://mirror.example.org")).toBe("https://world.openfoodfacts.org");
  });

  it("the sign-in limit scale is ignored in production and capped elsewhere", () => {
    expect(authRateLimitScale({ AUTH_RATE_LIMIT_SCALE: "50" })).toBe(50);
    expect(authRateLimitScale({ AUTH_RATE_LIMIT_SCALE: "100000" })).toBe(100);
    expect(authRateLimitScale({ AUTH_RATE_LIMIT_SCALE: "50", VERCEL_ENV: "production" })).toBe(1);
    expect(authRateLimitScale({ AUTH_RATE_LIMIT_SCALE: "50", STRIPE_LIVE_APPROVED: "true" })).toBe(1);
    expect(authRateLimitScale({ AUTH_RATE_LIMIT_SCALE: "-3" })).toBe(1);
    expect(authRateLimitScale({})).toBe(1);
  });
});
