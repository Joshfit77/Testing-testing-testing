import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockMessagesApi, type MockAnswer, type MockApi } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Audit 2026-11-14: an AI request the provider answered (and billed) but that still failed for the member: a
 * refusal, an answer cut short, or structured output that couldn't be read. The member gets the request back (it isn't
 * counted against the 150 a month or their money budget), and the cost still reaches the app's own spend figures, so the
 * global budget and its alerts see real spend. Before this, such requests cost money that no counter saw.
 *
 * A local stand-in answers for the provider; nothing reaches Anthropic and nothing here is model output.
 */
let answer: () => MockAnswer = () => ({ blocks: [{ type: "text", text: "ok" }] });
const api: MockApi = await startMockMessagesApi(() => answer());
process.env.ANTHROPIC_BASE_URL = api.url;
const available = await stackAvailable();

describe.skipIf(!available)("AI requests that are billed but fail for the member", () => {
  const svc = serviceClient();
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  let pro: TestUser;
  const photo = { base64: "AAAA", mediaType: "image/jpeg" as const };
  const spent = async () => Number((await svc.from("ai_budget_months").select("spent_micros").eq("month", month).maybeSingle()).data?.spent_micros ?? 0);
  const rows = async () => (await svc.from("ai_usage_events").select("id, kind, finalized_at").eq("user_id", pro.id)).data ?? [];
  const tick = () => new Promise((r) => setTimeout(r, 30));

  beforeAll(async () => {
    process.env.AI_RATE_LIMIT_PER_MINUTE = "100";
    pro = await createTestUser("billed-failures");
    await grantPlan(pro, "pro");
    const now = new Date().toISOString();
    await svc.from("profiles").update({ ai_data_consent_at: now, food_photo_consent_at: now }).eq("id", pro.id);
  });
  afterAll(async () => {
    delete process.env.AI_RATE_LIMIT_PER_MINUTE;
    await deleteTestUser(pro);
    await api.close();
  });

  it("a refused meal photo: not counted for the member, its real cost counted for the app", async () => {
    const { analyzeFoodPhoto } = await import("@/server/services/food-photo");
    answer = () => ({ blocks: [], stop: "refusal", usage: { input_tokens: 1500, output_tokens: 40 } });
    const before = await spent();
    const sent = api.requests.length;
    await expect(analyzeFoodPhoto(pro.client, pro.id, "pro", photo, "")).rejects.toMatchObject({ code: "provider" });
    await tick();
    expect(api.requests.length).toBe(sent + 1);
    expect(await rows()).toEqual([]);
    // 1,500 input + 40 output tokens on the fast model: ceil(1500 × 0.1 + 40 × 0.5) = 170 micro-USD.
    expect((await spent()) - before).toBeGreaterThanOrEqual(170);
  });

  it("a label the model answered with nothing usable (cut off at its output limit): the same", async () => {
    const { readLabelPhoto } = await import("@/server/services/label-photo");
    answer = () => ({ blocks: [], stop: "max_tokens", usage: { input_tokens: 1200, output_tokens: 2500 } });
    const before = await spent();
    await expect(readLabelPhoto(pro.client, pro.id, "pro", photo)).rejects.toMatchObject({ code: "provider" });
    await tick();
    expect(await rows()).toEqual([]);
    // ceil(1200 × 0.1 + 2500 × 0.5) = 1,370 micro-USD.
    expect((await spent()) - before).toBeGreaterThanOrEqual(1370);
  });

  it("structured output that can't be read: a clean message, the request given back, the expected cost counted", async () => {
    const { analyzeFoodPhoto } = await import("@/server/services/food-photo");
    const { EXPECTED_COST_MICROS } = await import("@/lib/domain/ai-economics");
    answer = () => ({ blocks: [{ type: "text", text: "{ this is not json" }], usage: { input_tokens: 1500, output_tokens: 300 } });
    const before = await spent();
    const err = await analyzeFoodPhoto(pro.client, pro.id, "pro", photo, "").catch((e: unknown) => e);
    await tick();
    expect(err).toMatchObject({ name: "AiError", code: "provider" });
    // Nothing of the provider's or the SDK's own wording reaches the member.
    expect(String((err as Error).message)).not.toMatch(/json|parse|anthropic|sdk|unexpected token/i);
    expect(await rows()).toEqual([]);
    expect((await spent()) - before).toBeGreaterThanOrEqual(EXPECTED_COST_MICROS.food_photo);
  });

  it("any feature using the shared wrapper: a billed failure reported by the feature is counted once, never against the member", async () => {
    const { AiError, withAiRequest } = await import("@/server/services/ai-coach");
    const before = await spent();
    await expect(
      withAiRequest({ supabase: svc, userId: pro.id, plan: "pro", kind: "meal_plan", tier: "fast" }, async () => {
        throw new AiError("provider", "The AI couldn't draft a plan that time. Please try again.", undefined, 4321);
      }),
    ).rejects.toMatchObject({ code: "provider" });
    await tick();
    expect(await rows()).toEqual([]);
    const after = await spent();
    expect(after - before).toBeGreaterThanOrEqual(4321);
    // An unreadable structured answer inside any feature (the SDK's own error) is turned into a clean message too.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const err = await withAiRequest({ supabase: svc, userId: pro.id, plan: "pro", kind: "meal_plan", tier: "fast" }, async () => {
      throw new Anthropic.AnthropicError("Failed to parse structured output: Unexpected token");
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ name: "AiError", code: "provider" });
    expect(String((err as Error).message)).not.toMatch(/parse|token/i);
    expect(await rows()).toEqual([]);
  });

  it("a provider outage (HTTP 500) is still free for everyone: nothing counted, nothing added to spend by this request", async () => {
    const { readLabelPhoto } = await import("@/server/services/label-photo");
    answer = () => ({ status: 500, errorType: "api_error", message: "upstream exploded: secret-internal-detail" });
    const err = await readLabelPhoto(pro.client, pro.id, "pro", photo).catch((e: unknown) => e);
    expect(err).toMatchObject({ name: "AiError", code: "provider" });
    expect(String((err as Error).message)).not.toContain("secret-internal-detail");
    expect(await rows()).toEqual([]);
  });
});
