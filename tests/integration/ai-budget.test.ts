import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Money limits on AI (migration 066), enforced by the database before any provider call: the per-member monthly
 * budget, the global monthly budget, in-flight limits, operator alerts at 50/75/90/100% and the switch to the fast
 * model as budgets run low. The global figures for the current month are snapshotted and restored around the suite.
 */
describe.skipIf(!available)("AI spending caps", () => {
  const svc = serviceClient();
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  let a: TestUser;
  let b: TestUser;
  let savedMonth: Record<string, unknown> | null = null;
  let savedAlerts: Record<string, unknown>[] = [];

  const reserve = (user: TestUser, over: Record<string, unknown> = {}) =>
    svc.rpc("reserve_ai_usage", {
      p_user_id: user.id,
      p_kind: "chat",
      p_tier: "fast",
      p_chat_limit: 1000,
      p_plan_limit: 100,
      p_smart_limit: 100,
      p_per_minute: 1000,
      p_estimate_micros: 1000,
      p_user_budget_micros: 1_000_000_000,
      p_global_budget_micros: 1_000_000_000_000,
      p_max_inflight_user: 1000,
      p_max_inflight_global: 100000,
      p_inflight_seconds: 180,
      ...over,
    });
  const finalize = (usageId: string, cost: number) =>
    svc.rpc("finalize_ai_usage", { p_usage_id: usageId, p_model: "claude-haiku-5-5", p_input_tokens: 100, p_output_tokens: 10, p_cost_micros: cost });
  const usageId = (r: { data: unknown }) => (r.data as { usage_id: string }[])[0]!.usage_id;
  const monthRow = async () => (await svc.from("ai_budget_months").select("budget_micros, spent_micros, reserved_micros").eq("month", month).single()).data!;
  const clear = async (u: TestUser) => {
    await svc.from("ai_usage_events").delete().eq("user_id", u.id);
  };
  /** Start the month's global figures from a known state. */
  const resetMonth = async (budget: number) => {
    await svc.from("ai_budget_months").upsert({ month, budget_micros: budget, spent_micros: 0, reserved_micros: 0 });
    await svc.from("ai_budget_alerts").delete().eq("month", month);
  };

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser("budget-a"), createTestUser("budget-b")]);
    savedMonth = (await svc.from("ai_budget_months").select("*").eq("month", month).maybeSingle()).data;
    savedAlerts = (await svc.from("ai_budget_alerts").select("*").eq("month", month)).data ?? [];
  });
  afterAll(async () => {
    await svc.from("ai_budget_alerts").delete().eq("month", month);
    if (savedAlerts.length) await svc.from("ai_budget_alerts").insert(savedAlerts);
    if (savedMonth) await svc.from("ai_budget_months").upsert(savedMonth);
    else await svc.from("ai_budget_months").delete().eq("month", month);
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it("refuses a member's request that would pass their monthly budget, counting running requests", async () => {
    await clear(a);
    const opts = { p_estimate_micros: 400_000, p_user_budget_micros: 1_000_000 };
    expect((await reserve(a, opts)).error).toBeNull();
    expect((await reserve(a, opts)).error).toBeNull();
    expect((await reserve(a, opts)).error?.message).toContain("ai_budget_user");
    // Another member is unaffected.
    expect((await reserve(b, opts)).error).toBeNull();
    await Promise.all([clear(a), clear(b)]);
  });

  it("replaces the hold with the real cost when a request finishes, exactly once", async () => {
    await clear(a);
    await resetMonth(1_000_000_000);
    const r = await reserve(a, { p_estimate_micros: 400_000 });
    expect(await monthRow()).toMatchObject({ spent_micros: 0, reserved_micros: 400_000 });
    expect((await finalize(usageId(r), 1234)).error).toBeNull();
    expect(await monthRow()).toMatchObject({ spent_micros: 1234, reserved_micros: 0 });
    // A repeated finalize changes nothing.
    await finalize(usageId(r), 999_999);
    expect(await monthRow()).toMatchObject({ spent_micros: 1234, reserved_micros: 0 });
    const { data: row } = await svc.from("ai_usage_events").select("cost_micros, reserved_micros, finalized_at, model").eq("id", usageId(r)).single();
    expect(row).toMatchObject({ cost_micros: 1234, reserved_micros: 400_000, model: "claude-haiku-5-5" });
    expect(row!.finalized_at).not.toBeNull();
    // The member's budget now counts 1,234, not the 400,000 hold.
    expect((await reserve(a, { p_estimate_micros: 900_000, p_user_budget_micros: 1_000_000 })).error).toBeNull();
    await clear(a);
  });

  it("gives back a failed request's hold and count", async () => {
    await clear(a);
    await resetMonth(1_000_000_000);
    const r = await reserve(a, { p_estimate_micros: 50_000 });
    expect((await svc.rpc("release_ai_usage", { p_usage_id: usageId(r) })).error).toBeNull();
    expect(await monthRow()).toMatchObject({ spent_micros: 0, reserved_micros: 0 });
    expect((await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", a.id)).count).toBe(0);
  });

  it("stops AI for everyone at the global budget, holds included, until the budget is raised", async () => {
    await Promise.all([clear(a), clear(b)]);
    await resetMonth(1_000_000);
    const opts = { p_estimate_micros: 400_000, p_global_budget_micros: 1_000_000 };
    expect((await reserve(a, opts)).error).toBeNull();
    expect((await reserve(b, opts)).error).toBeNull();
    expect((await reserve(b, opts)).error?.message).toContain("ai_budget_global");
    expect((await reserve(a, opts)).error?.message).toContain("ai_budget_global");
    // Raising the budget (an environment change) takes effect on the next request.
    expect((await reserve(a, { ...opts, p_global_budget_micros: 2_000_000 })).error).toBeNull();
    expect((await monthRow()).budget_micros).toBe(2_000_000);
    await Promise.all([clear(a), clear(b)]);
  });

  it("alerts once per threshold per month as real spend crosses 50, 75, 90 and 100%", async () => {
    await clear(a);
    await resetMonth(1_000_000);
    const spend = async (cost: number) => {
      const r = await reserve(a, { p_estimate_micros: 1, p_global_budget_micros: 1_000_000 });
      expect(r.error).toBeNull();
      const f = await finalize(usageId(r), cost);
      return ((f.data as { threshold: number }[]) ?? []).map((x) => x.threshold);
    };
    expect(await spend(400_000)).toEqual([]);
    expect(await spend(100_000)).toEqual([50]);
    expect(await spend(260_000)).toEqual([75]);
    expect(await spend(239_999)).toEqual([90]); // 760,000 → 999,999
    expect(await spend(1)).toEqual([100]); // exactly the budget
    const { data: alerts } = await svc.from("ai_budget_alerts").select("threshold, spent_micros, budget_micros").eq("month", month).order("threshold");
    expect(alerts!.map((x) => x.threshold)).toEqual([50, 75, 90, 100]);
    expect(alerts![0]).toMatchObject({ spent_micros: 500_000, budget_micros: 1_000_000 });

    // Spend dropping and rising again in the same month (e.g. after a manual correction) doesn't repeat an alert.
    await svc.from("ai_budget_months").update({ spent_micros: 0 }).eq("month", month);
    const r = await reserve(a, { p_estimate_micros: 1, p_global_budget_micros: 1_000_000 });
    expect(((await finalize(usageId(r), 600_000)).data as unknown[]) ?? []).toEqual([]);
    await clear(a);
  });

  it("keeps advanced requests from eating the money the rest of the allowance needs, and says why it downgrades", async () => {
    await clear(a);
    await resetMonth(1_000_000_000);
    // A real Pro member: 150 requests, 10 advanced, $1.40.
    const pro = { p_chat_limit: 150, p_smart_limit: 10, p_plan_limit: 10, p_user_budget_micros: 1_400_000, p_fast_estimate_micros: 3400 };
    const ask = (over: Record<string, unknown> = {}) => reserve(a, { ...pro, p_tier: "smart", p_estimate_micros: 80_000, ...over });
    const row = (r: { data: unknown }) => (r.data as { model_tier: string; downgrade_reason: string | null }[])[0]!;
    // A fresh month: 80,000 + 149 × 3,400 = 586,600 ≤ 1,400,000, so the larger model is allowed.
    const first = await ask();
    expect(row(first)).toMatchObject({ model_tier: "smart", downgrade_reason: null });
    await finalize(usageId(first), 80_000);
    // Spend so far 900,000: 900,000 + 80,000 + 148 × 3,400 > 1,400,000, so chat runs on the standard model, with the
    // reason, and holds the standard model's estimate.
    const big = await reserve(a, { ...pro, p_estimate_micros: 820_000 });
    await finalize(usageId(big), 820_000);
    const downgraded = await ask();
    expect(row(downgraded)).toMatchObject({ model_tier: "fast", downgrade_reason: "member_budget" });
    expect((await svc.from("ai_usage_events").select("reserved_micros").eq("id", usageId(downgraded)).single()).data?.reserved_micros).toBe(3400);
    await finalize(usageId(downgraded), 3000);
    // A program generation is refused rather than run on the wrong model.
    expect((await ask({ p_kind: "plan" })).error?.message).toContain("ai_quota_plan_member_budget");
    await clear(a);

    // Advanced share used up: chat says so.
    await svc.from("ai_usage_events").insert(Array.from({ length: 10 }, () => ({ user_id: a.id, kind: "chat", model_tier: "smart", created_at: new Date(Date.now() - 5 * 60_000).toISOString(), finalized_at: new Date().toISOString() })));
    expect(row(await ask())).toMatchObject({ model_tier: "fast", downgrade_reason: "advanced_used" });
    expect((await ask({ p_kind: "plan" })).error?.message).toContain("ai_quota_plan");
    await clear(a);

    // The app at 90% of its budget: chat runs on the standard model, with that reason.
    await svc.from("ai_budget_months").update({ spent_micros: 900_000, budget_micros: 1_000_000 }).eq("month", month);
    expect(row(await ask({ p_global_budget_micros: 1_000_000 }))).toMatchObject({ model_tier: "fast", downgrade_reason: "global_budget" });
    await clear(a);
  });

  it("doesn't use up a request for the automatic weekly report, and meters the Bible helper like everything else", async () => {
    await clear(a);
    await resetMonth(1_000_000_000);
    const opts = { p_chat_limit: 2, p_estimate_micros: 1000 };
    const w = await reserve(a, { ...opts, p_kind: "weekly_report" });
    expect(w.error).toBeNull();
    await finalize(usageId(w), 900);
    const b = await reserve(a, { ...opts, p_kind: "bible_study" });
    expect(b.error).toBeNull();
    await finalize(usageId(b), 900);
    const c = await reserve(a, opts);
    expect(c.error).toBeNull();
    await finalize(usageId(c), 900);
    // Two counted requests (Bible + chat) fill an allowance of 2; the weekly report didn't count.
    expect((await reserve(a, opts)).error?.message).toContain("ai_quota");
    expect((await reserve(a, { ...opts, p_kind: "weekly_report" })).error).toBeNull();
    await clear(a);
  });

  it("gives a failed request back to the member but keeps what the provider may have billed in the global figures", async () => {
    await clear(a);
    await resetMonth(1_000_000_000);
    const r = await reserve(a, { p_estimate_micros: 5000 });
    expect((await svc.rpc("release_ai_usage", { p_usage_id: usageId(r), p_charge_micros: 4200 })).error).toBeNull();
    expect(await monthRow()).toMatchObject({ spent_micros: 4200, reserved_micros: 0 });
    expect((await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", a.id)).count).toBe(0);
  });

  it("limits requests running at once, per member and across the app", async () => {
    await Promise.all([clear(a), clear(b)]);
    await resetMonth(1_000_000_000);
    const first = await reserve(a, { p_max_inflight_user: 1 });
    expect(first.error).toBeNull();
    expect((await reserve(a, { p_max_inflight_user: 1 })).error?.message).toContain("ai_in_flight");
    await finalize(usageId(first), 10);
    expect((await reserve(a, { p_max_inflight_user: 1 })).error).toBeNull();

    // Whatever else is running right now, allow exactly one more request across the app.
    const since = new Date(Date.now() - 170_000).toISOString();
    const { count } = await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).is("finalized_at", null).gte("created_at", since);
    const cap = (count ?? 0) + 1;
    expect((await reserve(b, { p_max_inflight_global: cap })).error).toBeNull();
    expect((await reserve(b, { p_max_inflight_global: cap })).error?.message).toContain("ai_busy");
    await Promise.all([clear(a), clear(b)]);
  });

  it("closes a request whose server died, charging its estimate so the hold doesn't leak", async () => {
    await clear(a);
    await resetMonth(1_000_000_000);
    await svc.from("ai_budget_months").update({ reserved_micros: 5000 }).eq("month", month);
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: stuck } = await svc.from("ai_usage_events").insert({ user_id: a.id, kind: "chat", model_tier: "fast", reserved_micros: 5000, created_at: old }).select("id").single();
    expect((await reserve(b, { p_estimate_micros: 0 })).error).toBeNull();
    const { data: row } = await svc.from("ai_usage_events").select("cost_micros, finalized_at").eq("id", stuck!.id).single();
    expect(row).toMatchObject({ cost_micros: 5000 });
    expect(row!.finalized_at).not.toBeNull();
    expect(await monthRow()).toMatchObject({ spent_micros: 5000, reserved_micros: 0 });
    await Promise.all([clear(a), clear(b)]);
  });

  it("counts the free Bible helper's spend toward the same global budget and pauses it when the budget is used", async () => {
    await resetMonth(1_000_000);
    const check = () => svc.rpc("ai_budget_check", { p_global_budget_micros: 1_000_000 });
    const ok = await check();
    expect(ok.error).toBeNull();
    expect(ok.data).toBe(month);
    const settled = await svc.rpc("ai_budget_settle", { p_month: month, p_held: 0, p_cost: 600_000 });
    expect((settled.data as { threshold: number }[]).map((x) => x.threshold)).toEqual([50]);
    expect(await monthRow()).toMatchObject({ spent_micros: 600_000 });
    await svc.rpc("ai_budget_settle", { p_month: month, p_held: 0, p_cost: 400_000 });
    expect((await check()).error?.message).toContain("ai_budget_global");
    // The coach is stopped by the same budget.
    expect((await reserve(a, { p_global_budget_micros: 1_000_000 })).error?.message).toContain("ai_budget_global");
    expect((await a.client.rpc("ai_budget_check", { p_global_budget_micros: 1 })).error).not.toBeNull();
    expect((await a.client.rpc("ai_budget_settle", { p_month: month, p_held: 0, p_cost: 0 })).error).not.toBeNull();
  });

  it("keeps the budget tables away from members", async () => {
    expect((await a.client.from("ai_budget_months").select("month")).data ?? []).toEqual([]);
    expect((await a.client.from("ai_budget_alerts").insert({ month, threshold: 50, spent_micros: 0, budget_micros: 0 })).error).not.toBeNull();
    expect((await a.client.rpc("finalize_ai_usage", { p_usage_id: crypto.randomUUID(), p_model: "x", p_input_tokens: 0, p_output_tokens: 0, p_cost_micros: 0 })).error).not.toBeNull();
  });
});
