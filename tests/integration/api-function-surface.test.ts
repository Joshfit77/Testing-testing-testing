import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, anonKey, createTestUser, deleteTestUser, serviceClient, stackAvailable, url, type TestUser } from "./helpers";

/**
 * Which database functions the public API lets a visitor or a signed-in member call.
 *
 * Anyone holding the public (anon) key can call `/rest/v1/rpc/<name>` directly, bypassing the app. Postgres lets
 * every role execute a newly created function unless the migration revokes it, so one forgotten `revoke` on a
 * service-only function (entitlements, webhook bookkeeping, AI metering, rate limits) would let a member grant
 * themselves a plan or spend the AI budget. Two checks against the running database:
 *
 *   1. The functions each role can execute, as the API itself reports them (its OpenAPI description lists only what
 *      the caller's role may call), are exactly the reviewed lists below. A new function that is meant to be callable
 *      is added here in the same change, after checking that it identifies the caller with auth.uid() and never
 *      trusts a user id argument; anything else gets `revoke execute ... from public, anon, authenticated`.
 *   2. Every service-only function, called by a member and by a visitor with plausible arguments, is refused with
 *      "permission denied" (42501), and nothing changes.
 */
const available = await stackAvailable();

/** Callable without signing in: pure helpers and the checks the public catalog's policies use (they say nothing about anyone else). */
const ANON_CALLABLE = [
  "activation_clamp_start",
  "activation_has_completed_set",
  "bible_chapter_count",
  "can_edit_program",
  "can_use_program",
  "can_view_program",
  "faith_offline_grace",
  "faith_safe_tz",
  "has_plan",
  "is_admin",
  "is_bible_chapter",
  "is_own_coach_reply",
  "plan_rank",
  "program_of_day",
  "program_of_week",
];

/** Also callable once signed in. Each acts on, or answers about, auth.uid() only (admin_* refuse non-admins inside). */
const MEMBER_CALLABLE = [
  ...ANON_CALLABLE,
  "accept_accountability_invite",
  "accept_friend_invite",
  "accountability_can_invite",
  "accountability_enabled",
  "accountability_summary",
  "admin_activation_metrics",
  "admin_ai_cost_report",
  "admin_usage_metrics",
  "admin_user_reports",
  // Migration 100: aggregate Biblical AI figures; refuses anyone but an administrator (is_admin, with aal2) inside.
  "biblical_ai_admin_metrics",
  "block_user",
  "can_add_body_scan",
  // Migration 088: used by the body-scans storage rule (which runs as the member); no arguments, answers only whether
  // auth.uid() may upload another Body Scan photo.
  "can_add_body_scan_photo",
  // Migration 086: used by the progress-photos storage rule (which runs as the member); no arguments, answers only
  // whether auth.uid() may upload another photo.
  "can_add_progress_photo",
  "can_log_sleep",
  "cancel_friend_request",
  "claim_username",
  "end_accountability_partnership",
  "faith_journey_check_in",
  "faith_journey_end",
  "faith_journey_enroll",
  "faith_journey_set_timezone",
  "faith_journey_settle_mine",
  "faith_journey_undo",
  "faith_journey_zone_at",
  "friend_profile",
  "friends_can_invite",
  "friends_enabled",
  "friends_overview",
  // Migration 097: used by the photo storage rules (which run as the member); answers only whether auth.uid() holds a
  // live reservation for that file name.
  "has_upload_reservation",
  "has_ai_coach",
  "is_member_starter_program",
  "member_references_exercise",
  "remove_friend",
  "report_user",
  "respond_friend_request",
  // Migration 097: reserves one upload in auth.uid()'s own folder of a photo bucket, under the photo limits.
  "reserve_storage_upload",
  "search_users",
  "send_accountability_nudge",
  "send_friend_request",
  "unblock_user",
].sort();

describe.skipIf(!available)("database functions reachable through the public API", () => {
  const svc = serviceClient();
  let member: TestUser;
  let other: TestUser;

  /** The functions the API says this caller's role may execute. */
  const callable = async (jwt: string): Promise<string[]> => {
    const res = await fetch(`${url()}/rest/v1/`, { headers: { apikey: anonKey(), Authorization: `Bearer ${jwt}` } });
    if (!res.ok) throw new Error(`The API description couldn't be read (${res.status}); this check needs the local Supabase stack.`);
    const spec = (await res.json()) as { paths?: Record<string, unknown> };
    return Object.keys(spec.paths ?? {})
      .filter((p) => p.startsWith("/rpc/"))
      .map((p) => p.slice("/rpc/".length))
      .sort();
  };

  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("fn-surface-member"), createTestUser("fn-surface-other")]);
  });
  afterAll(async () => Promise.all([deleteTestUser(member), deleteTestUser(other)]));

  it("a visitor can call only the reviewed functions", async () => {
    expect(await callable(anonKey())).toEqual([...ANON_CALLABLE].sort());
  });

  it("a signed-in member can call only the reviewed functions", async () => {
    const jwt = (await member.client.auth.getSession()).data.session!.access_token;
    expect(await callable(jwt)).toEqual(MEMBER_CALLABLE);
  });

  it("every service-only function refuses members and visitors, and nothing changes", async () => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // Arguments a member would use to help themselves (their own id, a Pro plan, generous limits) or to act on someone else.
    const calls: [string, Record<string, unknown>][] = [
      ["apply_entitlement", { p_user_id: member.id, p_version: 0, p_plan: "pro", p_source: "admin", p_valid_until: null }],
      ["apply_store_snapshot", { p_user_id: member.id, p_fetched_at: now, p_rows: [{ store: "app_store", product_id: "ngf_pro_monthly", plan: "pro", expires_at: null, is_sandbox: false }] }],
      ["upsert_stripe_subscription", { p_user_id: member.id, p_subscription_id: `sub_${id}`, p_price_id: "price_test_pro", p_plan: "pro", p_status: "active", p_current_period_end: null, p_cancel_at_period_end: false, p_synced_at: now }],
      ["claim_webhook_event", { p_provider: "stripe", p_event_id: `evt_${id}`, p_type: "invoice.paid", p_environment: null, p_lease_seconds: 900 }],
      ["finish_webhook_event", { p_provider: "stripe", p_event_id: `evt_${id}`, p_ok: true, p_error: null }],
      ["plan_of", { p_user_id: other.id }],
      ["is_sandbox_tester", { p_user_id: member.id }],
      ["rate_limit_hit", { p_key: `signin:email:${id}`, p_limit: 1, p_window_seconds: 86_400 }],
      ["reserve_ai_usage", { p_user_id: member.id, p_kind: "chat", p_tier: "smart", p_chat_limit: 100_000, p_plan_limit: 100_000, p_smart_limit: 100_000, p_per_minute: 100_000, p_estimate_micros: 0, p_user_budget_micros: 1_000_000_000, p_global_budget_micros: 1_000_000_000_000, p_max_inflight_user: 1000, p_max_inflight_global: 100_000, p_inflight_seconds: 180, p_fast_estimate_micros: 0 }],
      ["reserve_bible_ai_usage", { p_user_id: member.id, p_per_minute: 100_000, p_daily: 100_000, p_monthly: 100_000 }],
      ["finalize_ai_usage", { p_usage_id: id, p_model: "x", p_input_tokens: 0, p_output_tokens: 0, p_cost_micros: 0 }],
      ["release_ai_usage", { p_usage_id: id, p_charge_micros: 0 }],
      ["ai_budget_check", { p_global_budget_micros: 1 }],
      ["ai_budget_settle", { p_month: now.slice(0, 8) + "01", p_held: 0, p_cost: 0 }],
      ["activation_record", { p_user: other.id, p_event: "workout_completed", p_client: id, p_at: now, p_source: "server" }],
      ["activation_is_test_account", { p_user: other.id }],
      ["faith_journey_check_in_at", { p_user: other.id, p_activity: "prayer", p_now: now, p_occurred_at: now }],
      ["faith_journey_set_timezone_at", { p_user: other.id, p_tz: "UTC", p_now: now }],
      ["faith_journey_settle_at", { p_journey_id: id, p_now: now, p_force_through: null }],
      ["faith_journeys_settle_due", { p_now: now }],
      // Friends (migration 091): internal helpers. Callable directly, they would make any two members friends, reveal
      // who blocked whom, or return a stranger's training numbers.
      ["friends_make_friends", { p_one: member.id, p_two: other.id }],
      ["friends_blocked", { p_a: member.id, p_b: other.id }],
      ["friends_workout_stats", { p_user_id: other.id }],
    ];
    const problems: string[] = [];
    for (const [name, args] of calls) {
      for (const [who, client] of [["member", member.client], ["visitor", anonClient()]] as const) {
        const { error } = await client.rpc(name, args);
        if (error?.code !== "42501") problems.push(`${name} as ${who}: ${error ? `${error.code} ${error.message}` : "was executed"}`);
      }
    }
    expect(problems).toEqual([]);

    // Nothing the calls asked for exists.
    const { data: ent } = await svc.from("user_entitlements").select("plan, source").eq("user_id", member.id).single();
    expect(ent).toEqual({ plan: "free", source: "default" });
    expect((await svc.from("friendships").select("user_a", { count: "exact", head: true }).or(`user_a.eq.${member.id},user_b.eq.${member.id}`)).count).toBe(0);
    expect((await svc.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", member.id)).count).toBe(0);
    expect((await svc.from("store_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", member.id)).count).toBe(0);
    expect((await svc.from("stripe_events").select("id", { count: "exact", head: true }).eq("id", `evt_${id}`)).count).toBe(0);
    expect((await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", member.id)).count).toBe(0);
  });

  it("the admin metrics refuse a member inside the function too", async () => {
    for (const name of ["admin_usage_metrics", "admin_activation_metrics"]) {
      const { data, error } = await member.client.rpc(name);
      expect(error?.code, name).toBe("42501");
      expect(data, name).toBeNull();
    }
    // The AI cost report (migration 081): aggregates only, and refused to a member inside the function.
    const report = await member.client.rpc("admin_ai_cost_report", { p_from: new Date(Date.now() - 86_400_000).toISOString(), p_to: new Date().toISOString() });
    expect(report.error?.code).toBe("42501");
    expect(report.data).toBeNull();
    // Biblical AI's aggregate figures (migration 100): refused to a member inside the function too.
    const bai = await member.client.rpc("biblical_ai_admin_metrics", { p_days: 30 });
    expect(bai.error?.code).toBe("42501");
    expect(bai.data).toBeNull();
  });
});
