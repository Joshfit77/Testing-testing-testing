// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The first TestFlight build runs with no AI key (review 2026-11-20, "test with AI disabled"). With no provider
 * configured, every AI path refuses as "not configured" before anything leaves the server: no request to the AI
 * provider, no usage reserved, no callback run. Both ways in are checked: the coach (chat and plan generation) and
 * withAiRequest, which every other AI feature (food photos, labels, Bible helper's server side, etc.) goes through.
 * The browser side ("says honestly when the coach isn't configured") is e2e/coach.spec.ts.
 */
const saved = { key: process.env.ANTHROPIC_API_KEY, demo: process.env.DEMO_MODE };
process.env.ANTHROPIC_API_KEY = "";
delete process.env.DEMO_MODE;

const serviceCalls = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabase: () => {
    serviceCalls();
    throw new Error("the service database must not be touched when AI isn't configured");
  },
  getServerSupabase: async () => {
    throw new Error("unused");
  },
}));
vi.mock("@/server/flags", () => ({ isFlagEnabled: vi.fn(async () => true) }));
vi.mock("@/server/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const fetchSpy = vi.spyOn(globalThis, "fetch");
const { isAiConfigured } = await import("@/server/env");
const { assertAiAllowed, coachTurn, withAiRequest, AiError } = await import("@/server/services/ai-coach");

/** A member who has allowed AI use (so the only thing stopping the request is the missing provider). */
const consentingMember = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ai_data_consent_at: "2026-11-01T00:00:00Z" }, error: null }) }) }),
  }),
} as never;

beforeEach(() => {
  fetchSpy.mockClear();
  serviceCalls.mockClear();
});
afterAll(() => {
  process.env.ANTHROPIC_API_KEY = saved.key;
  if (saved.demo !== undefined) process.env.DEMO_MODE = saved.demo;
  fetchSpy.mockRestore();
});

describe("AI with no provider configured", () => {
  it("is reported as not configured", () => {
    expect(isAiConfigured()).toBe(false);
  });

  it("the eligibility check refuses first, for a Pro member too", async () => {
    await expect(assertAiAllowed("member-1", "pro", "chat")).rejects.toMatchObject({ code: "not_configured" });
    await expect(assertAiAllowed("member-1", "pro", "plan")).rejects.toBeInstanceOf(AiError);
    expect(serviceCalls).not.toHaveBeenCalled();
  });

  it("a coach message and a plan request send nothing to the provider", async () => {
    for (const mode of ["chat", "plan"] as const) {
      await expect(coachTurn({ supabase: consentingMember, userId: "member-1", plan: "pro", conversationId: null, message: "Plan my week", mode })).rejects.toMatchObject({
        code: "not_configured",
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(serviceCalls).not.toHaveBeenCalled();
  });

  it("every other AI feature (withAiRequest) never runs its request", async () => {
    const run = vi.fn();
    await expect(withAiRequest({ supabase: consentingMember, userId: "member-1", plan: "pro", kind: "food_photo" as never }, run)).rejects.toMatchObject({ code: "not_configured" });
    expect(run).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
