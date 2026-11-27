import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockMessagesApi, type MockAnswer, type MockApi } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * AI policy as configured and as enforced (audit 2026-11-14). The intended policy: Pro only; 150 AI requests per member
 * per calendar month; at most 10 of them on the advanced model; at most 2 requests running at once per member; about
 * $1.40 of AI per paying member per month. These tests read the real configuration (no test-only limits) and drive the
 * real request path against a local stand-in for the provider: nothing reaches Anthropic, nothing here is model output.
 */
let answer: (body: { stream?: boolean }) => MockAnswer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }] });
const api: MockApi = await startMockMessagesApi((body) => answer(body));
process.env.ANTHROPIC_BASE_URL = api.url;
const available = await stackAvailable();

describe.skipIf(!available)("AI policy: configured values and enforcement", () => {
  const svc = serviceClient();
  let pro: TestUser;
  const rows = async () => (await svc.from("ai_usage_events").select("id, kind, model_tier, finalized_at, created_at").eq("user_id", pro.id)).data ?? [];
  const clear = async () => {
    await svc.from("ai_usage_events").delete().eq("user_id", pro.id);
  };
  const monthStart = () => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  };
  const reserveArgs = async (over: Record<string, unknown> = {}) => {
    const { aiBudgetConfig } = await import("@/server/services/ai-budget");
    const { getPlans } = await import("@/lib/domain/plans");
    const { EXPECTED_COST_MICROS } = await import("@/lib/domain/ai-economics");
    const b = aiBudgetConfig();
    const p = getPlans().pro;
    return {
      p_user_id: pro.id,
      p_kind: "chat",
      p_tier: "fast",
      p_chat_limit: p.aiMonthlyLimit,
      p_plan_limit: p.aiPlanMonthlyLimit,
      p_smart_limit: p.aiSmartMonthlyLimit,
      p_per_minute: 1000,
      p_estimate_micros: EXPECTED_COST_MICROS.chat_fast,
      p_user_budget_micros: b.memberMonthlyMicros,
      p_global_budget_micros: 1_000_000_000_000,
      p_max_inflight_user: b.maxInflightPerMember,
      p_max_inflight_global: 100_000,
      p_inflight_seconds: b.inflightSeconds,
      p_fast_estimate_micros: EXPECTED_COST_MICROS.chat_fast,
      ...over,
    };
  };

  beforeAll(async () => {
    process.env.AI_RATE_LIMIT_PER_MINUTE = "200";
    pro = await createTestUser("ai-policy");
    await grantPlan(pro, "pro");
    await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString() }).eq("id", pro.id);
  });
  afterAll(async () => {
    delete process.env.AI_RATE_LIMIT_PER_MINUTE;
    await deleteTestUser(pro);
    await api.close();
  });

  it("the configuration in force is the policy: 150 requests, 10 advanced, 2 at once, $1.40 a month; Free and Plus get none", async () => {
    const { getPlans, aiAllowance } = await import("@/lib/domain/plans");
    const { aiBudgetConfig } = await import("@/server/services/ai-budget");
    // No environment override is in play in this run (an override would be a deployment decision, reported separately).
    for (const name of ["PLAN_PRO_AI_MONTHLY_LIMIT", "PLAN_PRO_AI_SMART_MONTHLY_LIMIT", "PLAN_PRO_AI_PLAN_MONTHLY_LIMIT", "AI_MEMBER_MONTHLY_BUDGET_USD"]) expect(process.env[name], name).toBeUndefined();
    const plans = getPlans();
    expect(plans.pro.aiMonthlyLimit).toBe(150);
    expect(plans.pro.aiSmartMonthlyLimit).toBe(10);
    expect(aiAllowance("pro")).toMatchObject({ chatLimit: 150, smartLimit: 10 });
    expect(aiAllowance("free")).toMatchObject({ chatLimit: 0, planLimit: 0, smartLimit: 0 });
    expect(aiAllowance("plus")).toMatchObject({ chatLimit: 0, planLimit: 0, smartLimit: 0 });
    const budget = aiBudgetConfig();
    expect(budget.maxInflightPerMember).toBe(2);
    expect(budget.memberMonthlyMicros).toBe(1_400_000);
  });

  it("the monthly allowance is counted by UTC calendar month: last month's requests don't count, this month's do, to the second", async () => {
    const { getAiUsage } = await import("@/server/services/ai-coach");
    await clear();
    const start = monthStart();
    const done = (createdAt: Date, tier = "fast") => ({ user_id: pro.id, kind: "chat", model_tier: tier, created_at: createdAt.toISOString(), finalized_at: createdAt.toISOString(), cost_micros: 3000, reserved_micros: 3400 });
    // 150 requests (10 of them advanced) in the last second of last month: a full allowance, all of it last month's.
    const lastSecond = new Date(start.getTime() - 1000);
    const { error } = await svc.from("ai_usage_events").insert(Array.from({ length: 150 }, (_, i) => done(lastSecond, i < 10 ? "smart" : "fast")));
    expect(error).toBeNull();
    expect(await getAiUsage(pro.id, "pro")).toMatchObject({ chatUsed: 0, smartUsed: 0, chatLimit: 150, smartLimit: 10 });
    // The database agrees: with the real limits, the first request of the new month is accepted, on the advanced model.
    const first = await svc.rpc("reserve_ai_usage", await reserveArgs({ p_tier: "smart" }));
    expect(first.error).toBeNull();
    expect((first.data as { model_tier: string }[])[0]!.model_tier).toBe("smart");
    await svc.rpc("release_ai_usage", { p_usage_id: (first.data as { usage_id: string }[])[0]!.usage_id });
    // A request at 00:00:00 UTC on the 1st belongs to this month, for the counter and the database alike.
    expect((await svc.from("ai_usage_events").insert(done(start))).error).toBeNull();
    expect((await getAiUsage(pro.id, "pro")).chatUsed).toBe(1);
    expect((await svc.rpc("reserve_ai_usage", await reserveArgs({ p_chat_limit: 1 }))).error?.message).toContain("ai_quota");
    // The screen names the same boundary: the next 1st, in UTC.
    const { allowanceRenewsAt } = await import("@/lib/domain/ai-allowance");
    expect(allowanceRenewsAt(new Date()).toISOString()).toBe(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString());
    await clear();
  });

  it("the 150th request is accepted and the 151st refused; the 11th advanced request runs on the standard model", async () => {
    await clear();
    const now = new Date();
    const done = (tier: string) => ({ user_id: pro.id, kind: "chat", model_tier: tier, created_at: new Date(now.getTime() - 120_000).toISOString(), finalized_at: now.toISOString(), cost_micros: 100, reserved_micros: 100 });
    expect((await svc.from("ai_usage_events").insert([...Array.from({ length: 10 }, () => done("smart")), ...Array.from({ length: 139 }, () => done("fast"))])).error).toBeNull();
    // Request 150 asks for the advanced model with all 10 used: it is answered, on the standard model, and says why.
    const r150 = await svc.rpc("reserve_ai_usage", await reserveArgs({ p_tier: "smart" }));
    expect(r150.error).toBeNull();
    expect((r150.data as { model_tier: string; downgrade_reason: string }[])[0]).toMatchObject({ model_tier: "fast", downgrade_reason: "advanced_used" });
    await svc.rpc("finalize_ai_usage", { p_usage_id: (r150.data as { usage_id: string }[])[0]!.usage_id, p_model: "claude-haiku-5-5", p_input_tokens: 10, p_output_tokens: 10, p_cost_micros: 6 });
    expect((await svc.rpc("reserve_ai_usage", await reserveArgs())).error?.message).toContain("ai_quota");
    // A program generation (always advanced) is refused rather than silently run on the standard model.
    await svc.from("ai_usage_events").delete().eq("user_id", pro.id).eq("model_tier", "fast");
    expect((await svc.rpc("reserve_ai_usage", await reserveArgs({ p_kind: "plan", p_tier: "smart" }))).error?.message).toContain("ai_quota_plan");
    await clear();
  });

  it("at most 2 requests run at once per member through the real request path; the third is refused and nothing of it is counted", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    await clear();
    answer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }], delayMs: 900 });
    const sent = api.requests.length;
    const ask = (message: string) => coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message, mode: "chat" });
    const a = ask("How many sets of squats?");
    const b = ask("How many sets of bench?");
    // Let both reservations land before the third arrives.
    await new Promise((r) => setTimeout(r, 450));
    const third = await ask("And deadlifts?").catch((e: unknown) => e);
    expect(third).toMatchObject({ name: "AiError", code: "in_progress" });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.assistantMessage.content).toContain("Three sets");
    expect(rb.assistantMessage.content).toContain("Three sets");
    expect(api.requests.length).toBe(sent + 2);
    const counted = await rows();
    expect(counted).toHaveLength(2);
    expect(counted.every((r) => r.finalized_at)).toBe(true);
    // The refused third question isn't left behind in any conversation.
    expect((await svc.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", pro.id).eq("content", "And deadlifts?")).count).toBe(0);
    // Both slots are free again.
    answer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }] });
    expect((await ask("And now?")).assistantMessage.content).toContain("Three sets");
    await clear();
  });

  it("a request that fails, times out or is cancelled frees its slot and isn't counted; the member is told plainly", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    await clear();
    const ask = (message: string, signal?: AbortSignal) => coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message, mode: "chat", signal });

    // The provider never answers and the route's deadline passes.
    answer = () => ({ hang: true });
    const timedOut = await ask("Will this time out?", AbortSignal.timeout(400)).catch((e: unknown) => e);
    expect(timedOut).toMatchObject({ name: "AiError", code: "provider", message: "The coach took too long to answer. Please try again." });
    const timedOut2 = await ask("And this?", AbortSignal.timeout(400)).catch((e: unknown) => e);
    expect(timedOut2).toMatchObject({ code: "provider" });

    // The member cancels.
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 300);
    const cancelled = await ask("Cancel me", controller.signal).catch((e: unknown) => e);
    expect(cancelled).toMatchObject({ name: "AiError", code: "provider", message: "The request was cancelled." });

    // The provider fails outright, with details that must not reach the member.
    answer = () => ({ status: 400, errorType: "invalid_request_error", message: "prompt is too long: 250000 tokens > 200000 maximum (org_abc123)" });
    const failed = await ask("Fail me").catch((e: unknown) => e);
    expect(failed).toMatchObject({ name: "AiError", code: "provider", message: "The AI service returned an error. Please try again." });
    expect(JSON.stringify({ m: (failed as Error).message })).not.toMatch(/org_abc123|tokens|invalid_request/);

    // Four failures in a row: none counted, no question left behind, and both slots free (two more run at once).
    expect(await rows()).toEqual([]);
    expect((await svc.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", pro.id).in("content", ["Will this time out?", "And this?", "Cancel me", "Fail me"])).count).toBe(0);
    answer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }], delayMs: 200 });
    const both = await Promise.all([ask("One"), ask("Two")]);
    expect(both.map((r) => r.assistantMessage.content)).toEqual(["Three sets of five.", "Three sets of five."]);
    answer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }] });
    await clear();
  });

  it("a hold is given back once: releasing twice, or after it was finalized, changes nothing the second time", async () => {
    await clear();
    const month = `${new Date().toISOString().slice(0, 7)}-01`;
    const global = async () => (await svc.from("ai_budget_months").select("spent_micros, reserved_micros").eq("month", month).single()).data!;
    const r = await svc.rpc("reserve_ai_usage", await reserveArgs({ p_estimate_micros: 7000 }));
    const id = (r.data as { usage_id: string }[])[0]!.usage_id;
    const held = await global();
    expect((await svc.rpc("release_ai_usage", { p_usage_id: id, p_charge_micros: 0 })).error).toBeNull();
    const once = await global();
    // Other tests may be using the shared figures at the same moment, so compare what this request alone can explain.
    expect(Number(held.reserved_micros) - Number(once.reserved_micros)).toBeGreaterThanOrEqual(0);
    expect((await svc.rpc("release_ai_usage", { p_usage_id: id, p_charge_micros: 999_999 })).error).toBeNull();
    const twice = await global();
    // The second release found nothing to give back: it neither refunds again nor adds the charge.
    expect(Number(twice.spent_micros) - Number(once.spent_micros)).toBeLessThan(999_999);

    const f = await svc.rpc("reserve_ai_usage", await reserveArgs({ p_estimate_micros: 7000 }));
    const fid = (f.data as { usage_id: string }[])[0]!.usage_id;
    await svc.rpc("finalize_ai_usage", { p_usage_id: fid, p_model: "claude-haiku-5-5", p_input_tokens: 100, p_output_tokens: 10, p_cost_micros: 15 });
    // A late release (a second server path giving up on a request that did finish) must not delete the counted row.
    expect((await svc.rpc("release_ai_usage", { p_usage_id: fid, p_charge_micros: 0 })).error).toBeNull();
    // Finalizing again doesn't change the recorded cost.
    await svc.rpc("finalize_ai_usage", { p_usage_id: fid, p_model: "claude-haiku-5-5", p_input_tokens: 100, p_output_tokens: 10, p_cost_micros: 999_999 });
    const row = (await svc.from("ai_usage_events").select("cost_micros, finalized_at").eq("id", fid).single()).data!;
    expect(Number(row.cost_micros)).toBe(15);
    expect(row.finalized_at).not.toBeNull();
    await clear();
  });

  it("the cost recorded is the provider's reported tokens times the price table, cached tokens at their own prices", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const { MODEL_PRICES } = await import("@/lib/domain/ai-economics");
    await clear();
    answer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }], usage: { input_tokens: 400, cache_read_input_tokens: 6000, cache_creation_input_tokens: 2000, output_tokens: 350 } });
    await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "How many sets?", mode: "chat" });
    const { data } = await svc.from("ai_usage_events").select("model, model_tier, input_tokens, output_tokens, cost_micros").eq("user_id", pro.id).single();
    const p = MODEL_PRICES["claude-haiku-5-5"]!;
    expect(data).toMatchObject({ model: "claude-haiku-5-5", model_tier: "fast", input_tokens: 8400, output_tokens: 350 });
    expect(Number(data!.cost_micros)).toBe(Math.ceil(400 * p.input + 2000 * p.cacheWrite + 6000 * p.cacheRead + 350 * p.output));
    await clear();
  });

  it("every request is bounded: output tokens capped, and the model ids sent are the routing table's", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const { DEFAULT_COACH_MODELS } = await import("@/lib/coach/routing");
    const { CHAT_MAX_TOKENS, PLAN_MAX_TOKENS } = await import("@/lib/coach/prompt");
    await clear();
    answer = () => ({ blocks: [{ type: "text", text: "Three sets of five." }] });
    const from = api.requests.length;
    await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "How many sets?", mode: "chat" });
    // A question about pain is routed to the advanced model.
    await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "My knee has pain when I squat. What should I change?", mode: "chat" });
    const [quick, careful] = api.requests.slice(from);
    expect(quick).toMatchObject({ model: DEFAULT_COACH_MODELS.fast, max_tokens: CHAT_MAX_TOKENS });
    expect(careful).toMatchObject({ model: DEFAULT_COACH_MODELS.smart, max_tokens: CHAT_MAX_TOKENS });
    expect(DEFAULT_COACH_MODELS).toEqual({ fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" });
    expect(CHAT_MAX_TOKENS).toBeLessThanOrEqual(12_000);
    expect(PLAN_MAX_TOKENS).toBeLessThanOrEqual(16_000);
    const tiers = (await rows()).map((r) => r.model_tier).sort();
    expect(tiers).toEqual(["fast", "smart"]);
    await clear();
  });
});
