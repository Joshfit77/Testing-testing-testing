import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, snapshotAiBudgets, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * The global DAILY AI limit and the new cost records (migration 081), against the real database: enforced in
 * reserve_ai_usage under the global lock with the monthly limits, settled by finalize and release, alerting once per
 * day at 80% and 100%, and lowering the advanced model from 90%. Today's and this month's global figures are restored
 * afterwards.
 */
describe.skipIf(!available)("AI daily spending limit and cost records", () => {
  const svc = serviceClient();
  const day = new Date().toISOString().slice(0, 10);
  const BIG = 1_000_000_000_000;
  let a: TestUser;
  let b: TestUser;
  let restore: () => Promise<void> = async () => {};

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
      p_user_budget_micros: BIG,
      p_global_budget_micros: BIG,
      p_max_inflight_user: 1000,
      p_max_inflight_global: 100000,
      p_inflight_seconds: 180,
      p_global_daily_budget_micros: BIG,
      ...over,
    });
  const usageId = (r: { data: unknown }) => (r.data as { usage_id: string }[])[0]!.usage_id;
  const dayRow = async () => (await svc.from("ai_budget_days").select("budget_micros, spent_micros, reserved_micros").eq("day", day).single()).data!;
  const resetDay = async (budget: number) => {
    await svc.from("ai_budget_days").upsert({ day, budget_micros: budget, spent_micros: 0, reserved_micros: 0 });
    await svc.from("ai_budget_day_alerts").delete().eq("day", day);
  };
  const clear = async () => {
    await svc.from("ai_usage_events").delete().in("user_id", [a.id, b.id]);
  };

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser("daily-a"), createTestUser("daily-b")]);
    restore = await snapshotAiBudgets();
  });
  beforeEach(async () => {
    await clear();
  });
  afterAll(async () => {
    await clear();
    await restore();
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it("refuses a request that would pass today's limit, counting running requests, while the month still has room", async () => {
    await resetDay(0);
    const opts = { p_estimate_micros: 400_000, p_global_daily_budget_micros: 1_000_000 };
    expect((await reserve(a, opts)).error).toBeNull();
    expect((await reserve(b, opts)).error).toBeNull();
    const third = await reserve(a, opts);
    expect(third.error?.message).toContain("ai_budget_global_daily");
    // Holds count: 2 × 400,000 are held, nothing is spent yet.
    expect(await dayRow()).toMatchObject({ budget_micros: 1_000_000, spent_micros: 0, reserved_micros: 800_000 });
  });

  it("a billed failure that crosses a threshold alerts too (release returns it)", async () => {
    await resetDay(0);
    const r = await reserve(a, { p_estimate_micros: 1_000, p_global_daily_budget_micros: 10_000 });
    expect(r.error).toBeNull();
    const rel = await svc.rpc("release_ai_usage", { p_usage_id: usageId(r), p_charge_micros: 8_500 });
    expect(rel.error).toBeNull();
    expect((rel.data as { period: string; threshold: number }[]).filter((x) => x.period === "day").map((x) => x.threshold)).toEqual([80]);
    expect(await dayRow()).toMatchObject({ spent_micros: 8_500, reserved_micros: 0 });
  });

  it("the first refusal records 'used up' once, though real spend stopped just short of 100%", async () => {
    await resetDay(0);
    // Spent is 99.9% of the budget: no request fits, but the 100% threshold was never crossed by spend.
    await svc.from("ai_budget_days").update({ budget_micros: 10_000, spent_micros: 9_990 }).eq("day", day);
    expect((await reserve(a, { p_estimate_micros: 3_400, p_global_daily_budget_micros: 10_000 })).error?.message).toContain("ai_budget_global_daily");
    const first = await svc.rpc("ai_budget_note_exhausted", { p_period: "day" });
    expect(first.error).toBeNull();
    expect(first.data).toEqual([{ period: "day", threshold: 100, spent_micros: 9_990, budget_micros: 10_000 }]);
    const again = await svc.rpc("ai_budget_note_exhausted", { p_period: "day" });
    expect(again.data).toEqual([]);
    expect((await a.client.rpc("ai_budget_note_exhausted", { p_period: "day" })).error).not.toBeNull();
  });

  it("'used up' is recorded even when the refused request was the day's first (its row rolled back)", async () => {
    await svc.from("ai_budget_days").delete().eq("day", day);
    await svc.from("ai_budget_day_alerts").delete().eq("day", day);
    expect((await reserve(a, { p_estimate_micros: 3_400, p_global_daily_budget_micros: 1_000 })).error?.message).toContain("ai_budget_global_daily");
    expect((await svc.from("ai_budget_days").select("day").eq("day", day)).data).toEqual([]);
    const note = await svc.rpc("ai_budget_note_exhausted", { p_period: "day", p_budget_micros: 1_000 });
    expect(note.data).toEqual([{ period: "day", threshold: 100, spent_micros: 0, budget_micros: 1_000 }]);
  });

  it("a different day's spend doesn't count against today", async () => {
    await resetDay(0);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const saved = (await svc.from("ai_budget_days").select("*").eq("day", yesterday).maybeSingle()).data;
    await svc.from("ai_budget_days").upsert({ day: yesterday, budget_micros: 1_000_000, spent_micros: 1_000_000, reserved_micros: 0 });
    try {
      expect((await reserve(a, { p_estimate_micros: 400_000, p_global_daily_budget_micros: 1_000_000 })).error).toBeNull();
    } finally {
      if (saved) await svc.from("ai_budget_days").upsert(saved);
      else await svc.from("ai_budget_days").delete().eq("day", yesterday);
    }
  });

  it("without a daily limit from the app, the database still applies twice the month's average day", async () => {
    await resetDay(0);
    const monthly = 3_000_000;
    const r = await reserve(a, { p_global_budget_micros: monthly, p_global_daily_budget_micros: null, p_estimate_micros: 1 });
    expect(r.error).toBeNull();
    const now = new Date();
    const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    expect(Number((await dayRow()).budget_micros)).toBe(Math.ceil((monthly * 2) / days));
  });

  it("finalize moves the hold to spent; release gives it back and charges only what the provider may have billed", async () => {
    await resetDay(0);
    const r1 = await reserve(a, { p_estimate_micros: 5_000 });
    const r2 = await reserve(a, { p_estimate_micros: 5_000 });
    expect(await dayRow()).toMatchObject({ reserved_micros: 10_000, spent_micros: 0 });
    const fin = await svc.rpc("finalize_ai_usage", { p_usage_id: usageId(r1), p_model: "claude-haiku-5-5", p_input_tokens: 12_000, p_output_tokens: 300, p_cost_micros: 1_500, p_cache_read_tokens: 10_000, p_cache_write_tokens: 500, p_no_cache_cost_micros: 1_350 });
    expect(fin.error).toBeNull();
    expect(await dayRow()).toMatchObject({ reserved_micros: 5_000, spent_micros: 1_500 });
    expect((await svc.rpc("release_ai_usage", { p_usage_id: usageId(r2), p_charge_micros: 700 })).error).toBeNull();
    expect(await dayRow()).toMatchObject({ reserved_micros: 0, spent_micros: 2_200 });
    // Finalizing twice changes nothing.
    await svc.rpc("finalize_ai_usage", { p_usage_id: usageId(r1), p_model: "claude-haiku-5-5", p_input_tokens: 1, p_output_tokens: 1, p_cost_micros: 99_999 });
    expect(await dayRow()).toMatchObject({ spent_micros: 2_200 });
    // The request record keeps the cache split and the uncached-equivalent cost.
    const { data: ev } = await svc.from("ai_usage_events").select("input_tokens, cache_read_tokens, cache_write_tokens, cost_micros, no_cache_cost_micros, route_reason").eq("id", usageId(r1)).single();
    expect(ev).toMatchObject({ input_tokens: 12_000, cache_read_tokens: 10_000, cache_write_tokens: 500, cost_micros: 1_500, no_cache_cost_micros: 1_350, route_reason: null });
  });

  it("alerts once per day at 80% and 100%, labelled as daily", async () => {
    await resetDay(0);
    const spend = async (cost: number) => {
      const r = await reserve(a, { p_estimate_micros: cost, p_global_daily_budget_micros: 10_000 });
      expect(r.error).toBeNull();
      return (await svc.rpc("finalize_ai_usage", { p_usage_id: usageId(r), p_model: "claude-haiku-5-5", p_input_tokens: 1, p_output_tokens: 1, p_cost_micros: cost })).data as { period: string; threshold: number }[];
    };
    expect(await spend(7_000)).toEqual([]);
    expect((await spend(1_500)).filter((x) => x.period === "day").map((x) => x.threshold)).toEqual([80]);
    expect((await spend(1_500)).filter((x) => x.period === "day").map((x) => x.threshold)).toEqual([100]);
    const { data: alerts } = await svc.from("ai_budget_day_alerts").select("threshold").eq("day", day).order("threshold");
    expect(alerts!.map((x) => x.threshold)).toEqual([80, 100]);
    // Further spend today alerts no more (the next request is refused anyway).
    expect((await reserve(a, { p_estimate_micros: 1, p_global_daily_budget_micros: 10_000 })).error?.message).toContain("ai_budget_global_daily");
  });

  it("from 90% of today's limit a complex chat runs on the standard model (and says why); a program generation is refused", async () => {
    await resetDay(0);
    await svc.from("ai_budget_days").update({ spent_micros: 905_000 }).eq("day", day);
    const chat = await reserve(a, { p_tier: "smart", p_estimate_micros: 80_000, p_fast_estimate_micros: 3_400, p_global_daily_budget_micros: 1_000_000, p_route_reason: "complex" });
    expect(chat.error).toBeNull();
    expect((chat.data as { model_tier: string; downgrade_reason: string }[])[0]).toMatchObject({ model_tier: "fast", downgrade_reason: "global_daily_budget" });
    const { data: ev } = await svc.from("ai_usage_events").select("model_tier, route_reason, downgrade_reason, reserved_micros").eq("id", usageId(chat)).single();
    expect(ev).toMatchObject({ model_tier: "fast", route_reason: "complex", downgrade_reason: "global_daily_budget", reserved_micros: 3_400 });
    const plan = await reserve(b, { p_kind: "plan", p_tier: "smart", p_estimate_micros: 100_000, p_global_daily_budget_micros: 1_000_000 });
    expect(plan.error?.message).toContain("ai_quota_plan_global_daily_budget");
  });

  it("simultaneous requests near today's limit can't overshoot it", async () => {
    await resetDay(0);
    const members = await Promise.all(Array.from({ length: 6 }, (_, i) => createTestUser(`daily-burst-${i}`)));
    try {
      const results = await Promise.all(members.map((m) => reserve(m, { p_estimate_micros: 3_400, p_global_daily_budget_micros: 10_000 })));
      expect(results.filter((r) => !r.error)).toHaveLength(2); // 2 × 3,400 ≤ 10,000 < 3 × 3,400
      expect(results.filter((r) => r.error?.message.includes("ai_budget_global_daily"))).toHaveLength(4);
      const row = await dayRow();
      expect(Number(row.spent_micros) + Number(row.reserved_micros)).toBeLessThanOrEqual(10_000);
    } finally {
      for (const m of members) await svc.from("ai_usage_events").delete().eq("user_id", m.id);
      await Promise.all(members.map((m) => deleteTestUser(m)));
    }
  });

  it("an unknown route reason is refused by the database (only the app's reasons are recorded)", async () => {
    await resetDay(0);
    const r = await reserve(a, { p_route_reason: "anything" });
    expect(r.error).not.toBeNull();
  });

  it("members and anonymous callers can't read or write the daily figures or call the functions", async () => {
    await resetDay(1_000_000);
    expect((await a.client.from("ai_budget_days").select("*")).data ?? []).toEqual([]);
    expect((await a.client.from("ai_budget_days").update({ spent_micros: 0 }).eq("day", day).select()).data ?? []).toEqual([]);
    expect((await a.client.from("ai_budget_day_alerts").select("*")).data ?? []).toEqual([]);
    for (const client of [a.client, anonClient()]) {
      expect((await client.rpc("reserve_ai_usage", { p_user_id: a.id, p_kind: "chat", p_tier: "fast", p_chat_limit: 1, p_plan_limit: 1, p_smart_limit: 1, p_per_minute: 1, p_estimate_micros: 1, p_user_budget_micros: 1, p_global_budget_micros: 1, p_max_inflight_user: 1, p_max_inflight_global: 1, p_inflight_seconds: 1 })).error).not.toBeNull();
      expect((await client.rpc("ai_budget_day_settle", { p_day: day, p_held: 0, p_cost: 0 })).error).not.toBeNull();
      expect((await client.rpc("finalize_ai_usage", { p_usage_id: crypto.randomUUID(), p_model: "x", p_input_tokens: 0, p_output_tokens: 0, p_cost_micros: 0 })).error).not.toBeNull();
    }
  });
});

describe.skipIf(!available)("AI cost report (aggregates only)", () => {
  const svc = serviceClient();
  let member: TestUser;
  let admin: TestUser;
  let restore: () => Promise<void> = async () => {};
  const from = new Date(Date.now() - 60_000).toISOString();
  const to = new Date(Date.now() + 86_400_000).toISOString();

  beforeAll(async () => {
    [member, admin] = await Promise.all([createTestUser("report-member"), createTestUser("report-admin")]);
    restore = await snapshotAiBudgets();
    await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  });
  afterAll(async () => {
    await svc.from("ai_usage_events").delete().eq("user_id", member.id);
    await restore();
    await Promise.all([deleteTestUser(member), deleteTestUser(admin)]);
  });

  it("counts only current Pro entitlements", async () => {
    const { data: before } = await svc.rpc("admin_ai_cost_report", { p_from: from, p_to: to });
    const n0 = Number((before as { pro_members_now: number }).pro_members_now);
    await svc.from("user_entitlements").update({ plan: "pro", valid_until: new Date(Date.now() - 86_400_000).toISOString() }).eq("user_id", member.id);
    const { data: expired } = await svc.rpc("admin_ai_cost_report", { p_from: from, p_to: to });
    expect(Number((expired as { pro_members_now: number }).pro_members_now)).toBe(n0);
    await svc.from("user_entitlements").update({ plan: "pro", valid_until: null }).eq("user_id", member.id);
    const { data: current } = await svc.rpc("admin_ai_cost_report", { p_from: from, p_to: to });
    expect(Number((current as { pro_members_now: number }).pro_members_now)).toBe(n0 + 1);
    await svc.from("user_entitlements").update({ plan: "free", valid_until: null }).eq("user_id", member.id);
  });

  it("is refused to members and anonymous callers", async () => {
    expect((await member.client.rpc("admin_ai_cost_report", { p_from: from, p_to: to })).error?.message).toMatch(/Not authorized|permission/i);
    expect((await anonClient().rpc("admin_ai_cost_report", { p_from: from, p_to: to })).error).not.toBeNull();
  });

  it("adds up recorded requests by model, reason, feature and day, measures cache savings, and names no member", async () => {
    const big = 1_000_000_000_000;
    const base = { p_user_id: member.id, p_chat_limit: 1000, p_plan_limit: 100, p_smart_limit: 100, p_per_minute: 1000, p_user_budget_micros: big, p_global_budget_micros: big, p_max_inflight_user: 1000, p_max_inflight_global: 100000, p_inflight_seconds: 180, p_global_daily_budget_micros: big };
    const fast = await svc.rpc("reserve_ai_usage", { ...base, p_kind: "chat", p_tier: "fast", p_estimate_micros: 3_400, p_route_reason: "quick" });
    const smart = await svc.rpc("reserve_ai_usage", { ...base, p_kind: "chat", p_tier: "smart", p_estimate_micros: 80_000, p_fast_estimate_micros: 1, p_route_reason: "complex" });
    const feature = await svc.rpc("reserve_ai_usage", { ...base, p_kind: "meal_plan", p_tier: "fast", p_estimate_micros: 6_000, p_route_reason: "feature" });
    for (const [r, model, cost, noCache, read, write] of [
      [fast, "claude-haiku-5-5", 1_000, 2_000, 10_000, 0],
      [smart, "claude-sonnet-5-5", 50_000, 60_000, 4_000, 1_000],
      [feature, "claude-haiku-5-5", 3_000, 3_000, 0, 0],
    ] as const) {
      const id = (r.data as { usage_id: string }[])[0]!.usage_id;
      const f = await svc.rpc("finalize_ai_usage", { p_usage_id: id, p_model: model, p_input_tokens: 20_000, p_output_tokens: 500, p_cost_micros: cost, p_cache_read_tokens: read, p_cache_write_tokens: write, p_no_cache_cost_micros: noCache });
      expect(f.error).toBeNull();
    }
    for (const client of [svc, admin.client]) {
      const { data, error } = await client.rpc("admin_ai_cost_report", { p_from: from, p_to: to });
      expect(error).toBeNull();
      const r = data as Record<string, unknown> & { totals: Record<string, number>; by_model: Record<string, unknown>[]; by_route_reason: Record<string, unknown>[]; by_kind: Record<string, unknown>[] };
      // Totals include everything recorded in the window; this member's three requests are at least there.
      expect(Number(r.totals.requests)).toBeGreaterThanOrEqual(3);
      expect(r.by_model.some((m) => m.model === "claude-sonnet-5-5" && m.tier === "smart")).toBe(true);
      expect(r.by_route_reason.some((x) => x.route_reason === "complex" && x.tier === "smart")).toBe(true);
      expect(r.by_kind.some((k) => k.kind === "meal_plan")).toBe(true);
      // Today's budget row (holds included) and the hit-rate denominator over rows that recorded the split.
      expect(r.today).toMatchObject({ day: new Date().toISOString().slice(0, 10) });
      expect(Number(r.totals.input_tokens_with_cache_data)).toBeGreaterThanOrEqual(60_000);
      expect(JSON.stringify(r)).not.toContain(member.id);
      expect(JSON.stringify(r)).not.toContain(admin.id);
    }
    // On this member's rows alone: cost 54,000, uncached-equivalent 65,000, so caching saved 11,000.
    const { data: rows } = await svc.from("ai_usage_events").select("cost_micros, no_cache_cost_micros").eq("user_id", member.id);
    const cost = rows!.reduce((s, x) => s + Number(x.cost_micros), 0);
    const noCache = rows!.reduce((s, x) => s + Number(x.no_cache_cost_micros), 0);
    expect(noCache - cost).toBe(11_000);
  });
});
