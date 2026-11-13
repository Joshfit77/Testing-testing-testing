import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockMessagesApi, type MockAnswer, type MockApi } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Free has no generative AI (owner brief 2026-11-13): every AI entry point refuses a Free account on the server before
 * anything is reserved or sent, while Pro requests are metered. A local stand-in for the Messages API counts what
 * reaches the "provider": nothing reaches Anthropic.
 */
let answer: () => MockAnswer = () => ({ blocks: [{ type: "text", text: "Romans 5:8 shows God's love [Romans 5:8]." }], usage: { input_tokens: 1800, output_tokens: 220 } });
const api: MockApi = await startMockMessagesApi(() => answer());
process.env.ANTHROPIC_BASE_URL = api.url;
const available = await stackAvailable();

describe.skipIf(!available)("AI access: Free reaches no AI provider; Pro is metered", () => {
  const svc = serviceClient();
  let free: TestUser;
  let pro: TestUser;
  const usageRows = async (u: TestUser) => (await svc.from("ai_usage_events").select("kind, model_tier, cost_micros, finalized_at").eq("user_id", u.id)).data ?? [];

  beforeAll(async () => {
    [free, pro] = await Promise.all([createTestUser("access-free"), createTestUser("access-pro")]);
    await grantPlan(pro, "pro");
    const now = new Date().toISOString();
    // Both have given every consent: only the plan can stop the Free member.
    await svc.from("profiles").update({ ai_data_consent_at: now, food_photo_consent_at: now, wellness_consent_at: now }).in("id", [free.id, pro.id]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(free), deleteTestUser(pro)]);
    await api.close();
  });

  it("refuses a Free account at every AI entry point, before anything is reserved or sent", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const { askBible } = await import("@/server/services/bible-ai");
    const { draftAiMealPlan } = await import("@/server/services/ai-meal-plan");
    const { analyzeFoodPhoto } = await import("@/server/services/food-photo");
    const { readLabelPhoto } = await import("@/server/services/label-photo");
    const before = api.requests.length;
    const photo = { base64: "AAAA", mediaType: "image/jpeg" as const };

    await expect(coachTurn({ supabase: free.client, userId: free.id, plan: "free", conversationId: null, message: "How do I squat?", mode: "chat" })).rejects.toMatchObject({ code: "not_entitled" });
    await expect(coachTurn({ supabase: free.client, userId: free.id, plan: "free", conversationId: null, message: "Write me a plan", mode: "plan" })).rejects.toMatchObject({ code: "not_entitled" });
    expect(await askBible(free.id, "free", "What does John 3:16 mean?", crypto.randomUUID())).toMatchObject({ ok: false, code: "not_entitled" });
    // (Refused for missing targets or for the plan, whichever comes first: either way nothing is sent.)
    await expect(draftAiMealPlan(free.client, free.id, "free", { startDate: "2026-11-16", days: 3, focus: "balanced" as never, notes: null })).rejects.toBeTruthy();
    await expect(analyzeFoodPhoto(free.client, free.id, "free", photo, "")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(readLabelPhoto(free.client, free.id, "free", photo)).rejects.toMatchObject({ code: "not_entitled" });
    // Legacy Plus (the paid toolkit without AI) is refused too.
    await expect(coachTurn({ supabase: free.client, userId: free.id, plan: "plus", conversationId: null, message: "Hi", mode: "chat" })).rejects.toMatchObject({ code: "not_entitled" });

    expect(api.requests.length).toBe(before);
    expect(await usageRows(free)).toEqual([]);
    expect((await svc.from("bible_ai_usage").select("id").eq("user_id", free.id)).data ?? []).toEqual([]);
  });

  it("a Free member can't reserve AI usage or write usage rows from their own session", async () => {
    expect((await free.client.rpc("reserve_ai_usage", { p_user_id: free.id, p_kind: "chat", p_tier: "fast", p_chat_limit: 999, p_plan_limit: 9, p_smart_limit: 9, p_per_minute: 99, p_estimate_micros: 0, p_user_budget_micros: 9e9, p_global_budget_micros: 9e12, p_max_inflight_user: 9, p_max_inflight_global: 99, p_inflight_seconds: 180 })).error).not.toBeNull();
    expect((await free.client.rpc("reserve_bible_ai_usage", { p_user_id: free.id, p_per_minute: 9, p_daily: 9, p_monthly: 9 })).error).not.toBeNull();
    expect((await free.client.from("ai_usage_events").insert({ user_id: free.id, kind: "chat" })).error).not.toBeNull();
  });

  it("a Pro Bible question is answered and metered like every other AI request (allowance, cost, budgets)", async () => {
    const { askBible } = await import("@/server/services/bible-ai");
    const before = api.requests.length;
    const r = await askBible(pro.id, "pro", "What does Romans 5:8 say about God's love?", crypto.randomUUID());
    expect(r.ok).toBe(true);
    expect(api.requests.length).toBe(before + 1);
    const rows = await usageRows(pro);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "bible_study", model_tier: "fast" });
    expect(rows[0]!.finalized_at).not.toBeNull();
    // 1,800 input + 220 output tokens on the fast model's price table.
    expect(Number(rows[0]!.cost_micros)).toBe(Math.ceil(1800 * 0.1 + 220 * 0.5));
  });

  it("a provider failure gives the Bible question back: nothing counted against the member", async () => {
    const { askBible } = await import("@/server/services/bible-ai");
    await svc.from("ai_usage_events").delete().eq("user_id", pro.id);
    answer = () => ({ status: 500, errorType: "api_error" });
    const r = await askBible(pro.id, "pro", "Who wrote Hebrews?", crypto.randomUUID());
    expect(r).toMatchObject({ ok: false });
    expect(await usageRows(pro)).toEqual([]);
    answer = () => ({ blocks: [{ type: "text", text: "ok" }] });
  });
});
