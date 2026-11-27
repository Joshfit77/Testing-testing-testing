import { describe, expect, it } from "vitest";
import { demoModeOn, demoModeRefused } from "@/lib/demo/mode";

describe("demo mode is refused on production and real-money deployments", () => {
  it("is off without DEMO_MODE=true", () => {
    expect(demoModeOn({})).toBe(false);
    expect(demoModeOn({ DEMO_MODE: "1" })).toBe(false);
  });
  it("is on for a local demo and a Vercel preview", () => {
    expect(demoModeOn({ DEMO_MODE: "true" })).toBe(true);
    expect(demoModeOn({ DEMO_MODE: "true", VERCEL_ENV: "preview" })).toBe(true);
  });
  it("is refused on Vercel production and when live Stripe charges are approved", () => {
    expect(demoModeOn({ DEMO_MODE: "true", VERCEL_ENV: "production" })).toBe(false);
    expect(demoModeOn({ DEMO_MODE: "true", STRIPE_LIVE_APPROVED: "true" })).toBe(false);
    expect(demoModeRefused({ DEMO_MODE: "true", VERCEL_ENV: "production" })).toBe(true);
    expect(demoModeRefused({ DEMO_MODE: "true" })).toBe(false);
  });
});
