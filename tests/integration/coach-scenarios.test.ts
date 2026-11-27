import { afterAll, describe, expect, it } from "vitest";
import { startMockMessagesApi, type MockAnswer, type MockApi, type MockRequestBody } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, snapshotAiBudgets, stackAvailable, type TestUser } from "./helpers";

/**
 * The owner's real-world scenarios (brief 2026-11-13, Priority 11), on synthetic members in the local database, with a
 * local stand-in for the Messages API. These check the machinery around the model: what data reaches it, what is
 * metered, what is refused, what is kept private. They say nothing about the quality of a real model's answers (the
 * stand-in's replies are scripted); that needs the live evaluation in docs/ai-eval.
 */
type Handler = (body: MockRequestBody, index: number) => MockAnswer;
let handler: Handler = () => ({ blocks: [{ type: "text", text: "ok" }] });
const api: MockApi = await startMockMessagesApi((body, i) => handler(body, i));
process.env.ANTHROPIC_BASE_URL = api.url;
const available = await stackAvailable();
const DAY = 86_400_000;

/** The tool results the coach sent back to the model in a request, parsed. */
function toolResults(body: MockRequestBody): unknown[] {
  return body.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []).filter((c) => c.type === "tool_result").map((c) => JSON.parse(String((c as unknown as { content: unknown }).content))));
}
/** A scripted turn: call one tool, then answer. */
function toolThenAnswer(tool: string, input: Record<string, unknown>, text: string): Handler {
  return (body) => (toolResults(body).length ? { blocks: [{ type: "text", text }], usage: { input_tokens: 4000, output_tokens: 300, cache_read_input_tokens: 9000 } } : { blocks: [{ type: "tool_use", id: `t_${tool}`, name: tool, input }], stop: "tool_use", usage: { input_tokens: 3500, output_tokens: 60, cache_read_input_tokens: 9000 } });
}

describe.skipIf(!available)("AI coach scenarios (synthetic members, scripted provider)", async () => {
  const { coachTurn } = await import("@/server/services/ai-coach");
  const svc = serviceClient();
  const users: TestUser[] = [];
  const pro = async (label: string, consents: Record<string, unknown> = {}) => {
    const u = await createTestUser(label);
    users.push(u);
    await grantPlan(u, "pro");
    await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString(), ...consents }).eq("id", u.id);
    return u;
  };
  const ask = (u: TestUser, message: string, conversationId: string | null = null) => coachTurn({ supabase: u.client, userId: u.id, plan: "pro", conversationId, message, mode: "chat" });
  const seedBench = async (u: TestUser, weeks: number, kgFor: (i: number) => number) => {
    const { "bench-press": bench } = await exerciseIds(["bench-press"]);
    const n = weeks * 2;
    const { data: sessions } = await svc
      .from("workout_sessions")
      .insert(Array.from({ length: n }, (_, i) => ({ user_id: u.id, client_id: crypto.randomUUID(), name: "Upper", status: "completed", started_at: new Date(Date.now() - (weeks * 7 - i * 3.5) * DAY).toISOString(), ended_at: new Date(Date.now() - (weeks * 7 - i * 3.5) * DAY + 3_600_000).toISOString() })))
      .select("id, started_at");
    const ordered = [...sessions!].sort((a, b) => (a.started_at as string).localeCompare(b.started_at as string));
    const { data: wes } = await svc.from("workout_exercises").insert(ordered.map((s) => ({ session_id: s.id, user_id: u.id, exercise_id: bench, position: 0 }))).select("id, session_id");
    const byS = new Map(wes!.map((w) => [w.session_id as string, w.id as string]));
    await svc.from("workout_sets").insert(ordered.flatMap((s, i) => [1, 2, 3].map((k) => ({ workout_exercise_id: byS.get(s.id as string), user_id: u.id, set_number: k, reps: 5, weight_kg: kgFor(i), rpe: 8, completed: true, is_warmup: false }))));
  };

  afterAll(async () => {
    await Promise.all(users.map((u) => deleteTestUser(u)));
    await api.close();
  });

  it("1. a new beginner with no history: the coach is told there is no history, and analysis says so instead of inventing a trend", async () => {
    const u = await pro("sc-beginner");
    handler = toolThenAnswer("analyze_lift_progress", { exercise: "bench press", weeks: null }, "You haven't logged a bench session yet, so there's no trend to read. Start with an empty bar for 3×8.");
    const before = api.requests.length;
    const r = await ask(u, "Why isn't my bench press improving?");
    const result = toolResults(api.requests.at(-1)!)[0] as { findings: { id: string }[] };
    expect(result.findings.map((f) => f.id)).toEqual(["insufficient_data"]);
    expect(api.requests.length - before).toBe(2);
    expect(r.assistantMessage.content).toContain("haven't logged");
  });

  it("2–3. an experienced lifter with six months of records, now stalled: the plateau and its evidence reach the model", async () => {
    const u = await pro("sc-lifter");
    // 26 weeks: steady progress for 18 weeks, then 8 weeks stuck at the same load.
    await seedBench(u, 26, (i) => Math.min(60 + i * 1.25, 105));
    handler = toolThenAnswer("analyze_lift_progress", { exercise: "bench press", weeks: 12 }, "Your bench has been at 105 kg for about eight weeks.");
    await ask(u, "Why isn't my bench press improving?");
    const result = toolResults(api.requests.at(-1)!)[0] as { findings: { id: string; evidence: string }[] };
    expect(result.findings.map((f) => f.id)).toContain("plateau");
    expect(result.findings.find((f) => f.id === "plateau")!.evidence).toMatch(/session/);
  });

  it("4. a runner returning after missed sessions: the running summary reports the gap from recorded runs only", async () => {
    const u = await pro("sc-runner");
    const runAt = new Date(Date.now() - 30 * DAY).toISOString();
    expect((await svc.from("activities").insert({ user_id: u.id, kind: "run", source: "gps", started_at: runAt, distance_m: 5000, elapsed_s: 1850, moving_s: 1800 })).error).toBeNull();
    handler = toolThenAnswer("get_running_summary", { weeks: 8 }, "Your last run was a while ago; ease back in.");
    await ask(u, "I've missed a few weeks of running. How should I restart?");
    const result = toolResults(api.requests.at(-1)!)[0] as Record<string, unknown>;
    expect(JSON.stringify(result)).toMatch(/"days_since_last_run":\s*(29|30)/);
    expect(JSON.stringify(result)).not.toMatch(/heart_rate|"hr"/i);
  });

  it("5. inconsistent sleep records: recorded and self-reported nights are labelled, and it is not a diagnosis", async () => {
    const u = await pro("sc-sleep", { wellness_consent_at: new Date().toISOString() });
    const nights = [1, 2, 6, 9].map((d, i) => {
      const end = new Date(Date.now() - d * DAY);
      const start = new Date(end.getTime() - (i % 2 ? 5 : 8) * 3_600_000);
      return { id: crypto.randomUUID(), user_id: u.id, started_at: start.toISOString(), ended_at: end.toISOString(), overlap_until: end.toISOString(), timezone: "UTC", night_of: end.toISOString().slice(0, 10), source: i % 2 ? "manual" : "apple_health", source_id: i % 2 ? null : `hk-${crypto.randomUUID()}`, kind: "night" };
    });
    expect((await svc.from("sleep_sessions").insert(nights)).error).toBeNull();
    handler = toolThenAnswer("get_recovery_summary", { days: 14 }, "Your sleep has been uneven.");
    await ask(u, "Am I recovering well?");
    const result = toolResults(api.requests.at(-1)!)[0] as Record<string, unknown>;
    expect(result.not_a_diagnosis).toBe(true);
    expect(JSON.stringify(result)).toMatch(/self_reported|self-reported|recorded/);
  });

  it("6. a personalized nutrition question: the nutrition summary carries only what was logged", async () => {
    const u = await pro("sc-nutrition");
    handler = toolThenAnswer("get_nutrition_summary", { days: 7 }, "You haven't logged food this week, so I can't judge your protein yet.");
    await ask(u, "Make me a nutrition plan for building muscle.");
    const result = toolResults(api.requests.at(-1)!)[0] as Record<string, unknown>;
    expect(JSON.stringify(result)).not.toMatch(/"calories":\s*[1-9]/);
  });

  it("7–8. remembering a preference needs the member; withdrawing memory consent removes memories and recall from the coach", async () => {
    const u = await pro("sc-memory", { coach_memory_enabled: true, coach_memory_consent_at: new Date().toISOString() });
    handler = (body) =>
      toolResults(body).length
        ? { blocks: [{ type: "text", text: "I've suggested that as a memory; save it if you'd like me to keep it." }] }
        : { blocks: [{ type: "tool_use", id: "t_mem", name: "propose_memory", input: { category: "schedule", content: "Trains at 6am before work" } }], stop: "tool_use" };
    const r = await ask(u, "Remember that I train at 6am before work.");
    // Only a proposal: nothing is stored until the member saves it.
    expect(r.assistantMessage.proposal).toMatchObject({ kind: "memory", content: "Trains at 6am before work" });
    expect((await svc.from("coach_memories").select("id").eq("user_id", u.id)).data).toEqual([]);

    // With memory switched off, recall is refused and the coach is told memory is off.
    await svc.from("profiles").update({ coach_memory_enabled: false }).eq("id", u.id);
    handler = toolThenAnswer("recall_conversations", { query: "6am" }, "Memory is off, so I can't look back.");
    await ask(u, "What did we talk about last time?");
    const last = api.requests.at(-1)!;
    const systemText = JSON.stringify(last.system);
    expect(systemText).toContain("Coaching memory: switched off by the athlete");
    const toolResult = last.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((c) => c.type === "tool_result") as unknown as { content: string; is_error?: boolean };
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toMatch(/memory is off/i);
  });

  it("12. simultaneous requests near the global limit can't overshoot it", async () => {
    const month = `${new Date().toISOString().slice(0, 7)}-01`;
    const restoreBudgets = await snapshotAiBudgets();
    try {
      const members = await Promise.all(Array.from({ length: 6 }, (_, i) => pro(`sc-burst-${i}`)));
      await svc.from("ai_budget_months").upsert({ month, budget_micros: 10_000, spent_micros: 0, reserved_micros: 0 });
      const results = await Promise.all(
        members.map((m) =>
          svc.rpc("reserve_ai_usage", { p_user_id: m.id, p_kind: "chat", p_tier: "fast", p_chat_limit: 150, p_plan_limit: 10, p_smart_limit: 10, p_per_minute: 6, p_estimate_micros: 3400, p_user_budget_micros: 1_400_000, p_global_budget_micros: 10_000, p_global_daily_budget_micros: 1_000_000_000, p_max_inflight_user: 2, p_max_inflight_global: 20, p_inflight_seconds: 180 }),
        ),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(2); // 2 × 3,400 ≤ 10,000 < 3 × 3,400
      expect(results.filter((r) => r.error?.message.includes("ai_budget_global"))).toHaveLength(4);
      const row = (await svc.from("ai_budget_months").select("spent_micros, reserved_micros").eq("month", month).single()).data!;
      expect(Number(row.spent_micros) + Number(row.reserved_micros)).toBeLessThanOrEqual(10_000);
      for (const m of members) await svc.from("ai_usage_events").delete().eq("user_id", m.id);
    } finally {
      await restoreBudgets();
    }
  });

  it("13. a yearly member gets a monthly allowance: last month's use doesn't count, this month's does", async () => {
    const { getAiUsage } = await import("@/server/services/ai-coach");
    const u = await pro("sc-yearly");
    const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) - DAY).toISOString();
    await svc.from("ai_usage_events").insert(Array.from({ length: 150 }, () => ({ user_id: u.id, kind: "chat", model_tier: "fast", created_at: lastMonth, finalized_at: lastMonth })));
    expect(await getAiUsage(u.id, "pro")).toMatchObject({ chatUsed: 0, chatLimit: 150, smartLimit: 10 });
  });

  it("16. cost accounting: the recorded cost equals the provider's reported tokens at the published prices", async () => {
    const u = await pro("sc-cost");
    handler = () => ({ blocks: [{ type: "text", text: "Squeeze the bar and keep your shoulder blades back." }], usage: { input_tokens: 2100, output_tokens: 180, cache_read_input_tokens: 12_000, cache_creation_input_tokens: 0 } });
    await ask(u, "Quick bench cue?");
    const { data } = await svc.from("ai_usage_events").select("model, cost_micros, input_tokens, output_tokens").eq("user_id", u.id).single();
    expect(data!.model).toBe("claude-haiku-5-5");
    // Haiku 5.5: $0.10/M input, $0.01/M cache read, $0.50/M output (ai-economics.ts).
    expect(Number(data!.cost_micros)).toBe(Math.ceil(2100 * 0.1 + 12_000 * 0.01 + 180 * 0.5));
    // Migration 081: the cache split, the uncached-equivalent cost and why the standard model was used.
    const { data: rec } = await svc.from("ai_usage_events").select("input_tokens, cache_read_tokens, cache_write_tokens, no_cache_cost_micros, route_reason, downgrade_reason").eq("user_id", u.id).single();
    expect(rec).toMatchObject({ input_tokens: 2100 + 12_000, cache_read_tokens: 12_000, cache_write_tokens: 0, route_reason: "quick", downgrade_reason: null });
    // Uncached, all 14,100 input tokens would be at the plain input price: the saving is measured, not assumed.
    expect(Number(rec!.no_cache_cost_micros)).toBe(Math.ceil(14_100 * 0.1 + 180 * 0.5));
  });

  it("17. the daily app-wide limit: a request that would pass today's limit is refused before the provider is called, and says when it resumes", async () => {
    const u = await pro("sc-daily");
    const before = api.requests.length;
    const prev = process.env.AI_GLOBAL_DAILY_BUDGET_USD;
    const restoreBudgets = await snapshotAiBudgets();
    process.env.AI_GLOBAL_DAILY_BUDGET_USD = "0.001"; // 1,000 micro-USD: less than one standard request's hold (3,400)
    try {
      await svc.from("ai_budget_day_alerts").delete().eq("day", new Date().toISOString().slice(0, 10));
      await expect(ask(u, "Quick bench cue?")).rejects.toMatchObject({ code: "budget_global", message: expect.stringMatching(/rest of today.*midnight UTC/) });
      expect(api.requests.length).toBe(before);
      const { count } = await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", u.id);
      expect(count).toBe(0);
      // The member's question isn't left behind either.
      const { count: msgs } = await svc.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", u.id);
      expect(msgs).toBe(0);
      // Operators are told the day's budget is used up, once.
      const { data: alerts } = await svc.from("ai_budget_day_alerts").select("threshold").eq("day", new Date().toISOString().slice(0, 10));
      expect(alerts!.map((x) => x.threshold)).toEqual([100]);
    } finally {
      await restoreBudgets();
      if (prev === undefined) delete process.env.AI_GLOBAL_DAILY_BUDGET_USD;
      else process.env.AI_GLOBAL_DAILY_BUDGET_USD = prev;
    }
  });

  it("18. the per-request ceiling holds within a round: near the ceiling the next round is a short final answer with no more tools", async () => {
    const u = await pro("sc-ceiling");
    const before = api.requests.length;
    // Round 1 costs 6,000 (60,000 input tokens) + 3,000 (6,000 output) = 9,000 of the standard model's 15,000 ceiling and
    // asks for a tool. Round 2's input will cost at least 6,000 again, so nothing is left for a normal round.
    handler = (_body, i) =>
      i === before
        ? { blocks: [{ type: "tool_use", id: "t1", name: "get_recent_workouts", input: { days: 14, limit: 5 } }], stop: "tool_use", usage: { input_tokens: 60_000, output_tokens: 6_000 } }
        : { blocks: [{ type: "text", text: "Here is what I found." }], usage: { input_tokens: 61_000, output_tokens: 200 } };
    const res = await ask(u, "How was my training this fortnight?");
    const bodies = api.requests.slice(before) as (MockRequestBody & { tool_choice?: { type: string } })[];
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.max_tokens).toBe(12_000);
    expect(bodies[0]!.tool_choice?.type).toBe("auto");
    expect(bodies[1]!.max_tokens).toBe(2_000);
    expect(bodies[1]!.tool_choice?.type).toBe("none");
    expect(res.assistantMessage.content).toContain("Here is what I found.");
  });
});
