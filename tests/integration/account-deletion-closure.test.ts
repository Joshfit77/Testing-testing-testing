import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LEGAL_PAGES } from "@/lib/legal/versions";
import { createTestUser, deleteTestUser, exerciseIds, grantPlan, makeAdmin, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { NOT_EXPORTED, removeUserFolder, removeUserStorage, USER_STORAGE_BUCKETS, USER_TABLES } from "@/server/services/account";
import { generateInviteCode } from "@/lib/domain/accountability";

/**
 * Account-deletion closure (docs/launch-readiness/03_ACCOUNT_DELETION_CLOSURE.md). One member is given a row in EVERY
 * table that references auth.users (found from the live catalog, not from a hand-kept list), a file in every private
 * bucket, sign-in sessions, rate-limit counters keyed by their account ID and hashed email, and administrator
 * audit-log entries written by them and about them. After the real `deleteUserAccount` (Stripe and RevenueCat
 * stubbed, as in the other deletion tests):
 *   - no column referencing auth.users, in any schema, still names them;
 *   - no storage object, auth session, refresh token or rate-limit counter names them;
 *   - a text sweep of every row of every table in `public`, `auth` and `storage` finds their account ID, email or
 *     hashed email in only two places, both retentions that are owner/counsel decisions, pinned here so that any
 *     change is deliberate: the administrator audit-log entry another admin wrote about them (entity_id = their
 *     account ID), and Supabase Auth's own audit log (sign-up, sign-in and deletion events with ID and email);
 *   - late billing events for the deleted account can't bring rows back.
 * The order and failure behaviour around storage, the auth user and the billing providers is checked against the
 * real database too (the pure ordering is in tests/unit/account-deletion.test.ts; a failed Stripe cancellation is in
 * account-deletion.test.ts and account-deletion-billing.test.ts).
 *
 * The catalog and the auth/storage schemas aren't reachable through the API, so these checks read the local database
 * with `psql` (TEST_DB_URL, default: the local Supabase CLI database).
 */
const available = await stackAvailable();
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function sql(query: string): string[][] {
  const r = spawnSync("psql", [DB_URL, "-X", "-q", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`psql failed (is psql installed and TEST_DB_URL right?): ${r.error?.message ?? r.stderr}`);
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"));
}
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

interface FkColumn {
  schema: string;
  table: string;
  column: string;
  onDelete: "cascade" | "set null" | "restrict" | "no action" | "set default";
}

/** Every column, in any schema, with a foreign key to auth.users. */
function userForeignKeys(): FkColumn[] {
  const rule: Record<string, FkColumn["onDelete"]> = { c: "cascade", n: "set null", r: "restrict", a: "no action", d: "set default" };
  return sql(`
    select n.nspname, c.relname, a.attname, k.confdeltype
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    where k.contype = 'f' and k.confrelid = 'auth.users'::regclass
    order by 1, 2, 3`).map(([schema, table, column, del]) => ({ schema: schema!, table: table!, column: column!, onDelete: rule[del!]! }));
}

/** Public tables with no foreign key to auth.users, and why none of them identifies a member. */
const PUBLIC_TABLES_WITHOUT_MEMBER_FK: Record<string, string> = {
  ai_budget_alerts: "service-wide monthly AI spend alerts (month, amounts)",
  ai_budget_day_alerts: "service-wide daily AI spend alerts (day, amounts; migration 081)",
  ai_budget_days: "service-wide daily AI spend totals (migration 081)",
  ai_budget_months: "service-wide monthly AI spend totals",
  content_items: "editorial catalog",
  exercise_alternatives: "exercise catalog",
  exercise_media: "exercise catalog media",
  exercises: "exercise catalog",
  feature_flags: "service switches",
  legal_document_versions: "published legal document versions",
  program_categories: "program catalog",
  program_days: "program structure (owned programs reach their owner through training_programs, which cascades)",
  program_exercises: "program structure (as above)",
  program_weeks: "program structure (as above)",
  rate_limit_counters: "keys name a member's account ID or hashed email: removed by deleteUserAccount (removeRateLimitCounters)",
  revenuecat_events: "webhook event ID, type, status, error code; no account reference",
  stripe_events: "webhook event ID, type, status, error code; no account reference",
};

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });

describe.skipIf(!available)("account deletion closure: nothing that names the member survives except what is documented", async () => {
  const { deleteUserAccount, deletionFailureMessage } = await import("@/server/services/account-deletion");
  const { hashKey, rateLimit } = await import("@/server/rate-limit");
  const { syncStoreSubscriber } = await import("@/server/services/store-billing");
  const { userIdForSubscription } = await import("@/server/services/billing");
  const svc = serviceClient();
  let member: TestUser;
  /** Another administrator, who audits the member, and whom the member (an admin too) enrolled as a sandbox tester. */
  let otherAdmin: TestUser;
  /** The member's accountability partners (the member is user_a with one and user_b with the other). */
  let partner: TestUser | undefined;
  let lowerPartner: TestUser | undefined;
  let emailHash: string;
  let customerId: string;
  const objects: Record<string, string> = {};
  const auditIds: string[] = [];
  const ipOnlyKey = `signup:ip:${hashKey(`203.0.113.${Math.floor(Math.random() * 250)}`)}:${Date.now()}`;

  const fks = available ? userForeignKeys() : [];
  const publicFks = fks.filter((f) => f.schema === "public");
  const countWhere = (f: FkColumn, id: string) => Number(sql(`select count(*) from ${f.schema}.${f.table} where ${f.column} = ${lit(id)}::uuid`)[0]![0]);

  /** Rows of every table in public, auth and storage whose text contains any of `needles`, by table. */
  function sweep(needles: string[]): Record<string, number> {
    const tables = sql(`
      select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p') and n.nspname in ('public', 'auth', 'storage') order by 1, 2`);
    const cond = needles.map((n) => `t::text ilike ${lit(`%${n}%`)}`).join(" or ");
    const query = tables.map(([s, t]) => `select '${s}.${t}', count(*) from ${s}."${t}" t where ${cond}`).join("\nunion all\n");
    return Object.fromEntries(
      sql(query)
        .map(([t, n]) => [t!, Number(n)] as const)
        .filter(([, n]) => n > 0),
    );
  }

  beforeAll(async () => {
    [member, otherAdmin] = await Promise.all([createTestUser("closure-member"), createTestUser("closure-admin")]);
    emailHash = hashKey(member.email);
    await grantPlan(member, "pro");
    const now = new Date().toISOString();
    const { error: pErr } = await svc
      .from("profiles")
      .update({ role: "admin", wellness_consent_at: now, ai_data_consent_at: now, body_scan_consent_at: now, food_photo_consent_at: now, coach_memory_enabled: true })
      .eq("id", member.id);
    if (pErr) throw pErr;
    await makeAdmin(otherAdmin);
    const exerciseId = (await exerciseIds(["back-squat"]))["back-squat"]!;
    const u = member.id;
    const seed = async (table: string, row: Record<string, unknown>): Promise<Record<string, string>> => {
      const { data, error } = await svc.from(table).insert(row).select("*").single();
      if (error) throw new Error(`seeding ${table}: ${error.message}`);
      return data as Record<string, string>;
    };

    // Same rows as tests/integration/cross-user-isolation.test.ts, through the service role so plan and consent
    // gates don't get in the way.
    const session = await seed("workout_sessions", { user_id: u, client_id: crypto.randomUUID(), name: "Closure private session", status: "completed", started_at: "2026-10-01T10:00:00Z", ended_at: "2026-10-01T11:00:00Z" });
    const wex = await seed("workout_exercises", { session_id: session.id, user_id: u, exercise_id: exerciseId, position: 0 });
    await seed("workout_sets", { workout_exercise_id: wex.id, user_id: u, set_number: 1, reps: 5, weight_kg: 100, completed: true });
    await seed("personal_records", { user_id: u, exercise_id: exerciseId, record_type: "max_weight", value: 100 });
    const template = await seed("workout_templates", { user_id: u, name: "Closure template" });
    await seed("workout_template_exercises", { template_id: template.id, user_id: u, exercise_id: exerciseId, position: 0, sets: 3, reps: "8-12" });
    await seed("exercise_targets", { user_id: u, exercise_id: exerciseId, source: "review" });
    await seed("training_adjustments", { user_id: u, kind: "deload_week", summary: "Deload next week", source: "review" });
    await seed("training_recommendation_decisions", { user_id: u, recommendation_key: "closure-key", decision: "accepted" });
    await seed("training_programs", {
      slug: `closure-private-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: "Closure AI plan",
      difficulty: "beginner",
      duration_weeks: 1,
      days_per_week: 1,
      session_minutes: 30,
      owner_id: u,
      source: "ai",
      is_published: false,
    });
    const { data: published } = await svc.from("training_programs").select("id").eq("is_published", true).is("owner_id", null).limit(1).single();
    const userProgram = await seed("user_programs", { user_id: u, program_id: published!.id });
    const { data: week } = await svc.from("program_weeks").select("id").eq("program_id", published!.id).limit(1).single();
    const { data: day } = await svc.from("program_days").select("id").eq("week_id", week!.id).limit(1).single();
    await seed("planned_session_overrides", { user_id: u, user_program_id: userProgram.id, program_day_id: day!.id, planned_date: "2026-10-05" });

    await seed("onboarding_answers", { user_id: u, primary_goal: "general_health", experience: "beginner", days_per_week: 3, session_minutes: 45, limitations: "Private note: sore knee" });
    await seed("fitness_goals", { user_id: u, title: "Squat 100 kg", goal_type: "strength" });
    await seed("weight_entries", { user_id: u, recorded_on: "2026-10-01", weight_kg: 80 });
    await seed("measurement_entries", { user_id: u, recorded_on: "2026-10-01", waist_cm: 80 });
    await seed("recovery_checkins", { user_id: u, checked_on: "2026-10-01", sleep_quality: 3, energy: 3, soreness: 3, stress: 3, readiness_score: 60 });
    const sleepId = crypto.randomUUID();
    await seed("sleep_sessions", { id: sleepId, user_id: u, started_at: "2026-10-01T22:00:00Z", ended_at: "2026-10-02T06:00:00Z", overlap_until: "2026-10-02T06:00:00Z", timezone: "UTC", night_of: "2026-10-02", source: "manual" });
    await seed("sleep_stages", { session_id: sleepId, user_id: u, stage: "deep", started_at: "2026-10-01T23:00:00Z", ended_at: "2026-10-02T00:00:00Z" });
    await seed("sleep_checkins", { user_id: u, day: "2026-10-02" });
    await seed("sleep_import_runs", { user_id: u, source: "apple_health", range_start: "2026-10-01T00:00:00Z", range_end: "2026-10-02T00:00:00Z" });
    await seed("daily_steps", { user_id: u, day: "2026-10-01", steps: 8000, source: "manual" });
    await seed("supplement_stack", { user_id: u, supplement_id: "creatine" });
    await seed("supplement_logs", { user_id: u, supplement_id: "creatine", taken_on: "2026-10-01" });
    await seed("activities", {
      user_id: u,
      kind: "run",
      source: "gps",
      started_at: "2026-10-01T07:00:00Z",
      timezone: "UTC",
      distance_m: 5000,
      elapsed_s: 1800,
      moving_s: 1700,
      route: { type: "LineString", coordinates: [[0, 0], [0, 0.01]] },
    });
    await seed("running_goals", { user_id: u, kind: "weekly_distance", distance_m: 20000 });

    const meal = await seed("meals", { user_id: u, eaten_on: "2026-10-01" });
    await seed("meal_items", { meal_id: meal.id, user_id: u, name: "Oats", servings: 1, calories: 300, source: "custom" });
    await seed("nutrition_goals", { user_id: u, calories: 2200, protein_g: 150, carbs_g: 200, fat_g: 70 });
    await seed("water_entries", { user_id: u, recorded_on: "2026-10-01", amount_ml: 500 });
    await seed("nutrition_day_marks", { user_id: u, day: "2026-10-01", status: "complete" });
    await seed("foods", { owner_id: u, source: "custom", name: "Closure custom food", serving_size: 100, serving_unit: "g", calories: 100 });
    await seed("food_favorites", { user_id: u, food_key: "usda:12345", name: "Oats", basis: { per100: { calories: 380 } } });
    const recipe = await seed("recipes", { user_id: u, name: "Closure recipe" });
    await seed("recipe_ingredients", { recipe_id: recipe.id, user_id: u, name: "Oats", source: "usda:12345", quantity: 100, unit_label: "g", basis: { per100: { calories: 380 } } });
    await seed("meal_plan_settings", { user_id: u });
    const plan = await seed("meal_plans", { user_id: u, start_date: "2026-10-01", targets: {}, settings: {} });
    await seed("meal_plan_entries", { plan_id: plan.id, user_id: u, plan_date: "2026-10-01", slot: 0, meal_type: "breakfast", label: "Breakfast", source_key: "app:oats", name: "Oats", portion: 1, per_serving: {} });
    await seed("meal_plan_drafts", { user_id: u, start_date: "2026-10-01", days: 3, focus: "balanced", targets: {}, settings: {}, days_plan: [] });
    await seed("grocery_lists", { user_id: u });
    await seed("grocery_items", { user_id: u, name: "Oats", origin: "manual" });

    const conversation = await seed("ai_conversations", { user_id: u, title: "Private chat" });
    await seed("ai_messages", { conversation_id: conversation.id, user_id: u, role: "user", content: "My private question" });
    const reply = await seed("ai_messages", { conversation_id: conversation.id, user_id: u, role: "assistant", content: "My private answer" });
    await seed("ai_message_feedback", { user_id: u, message_id: reply.id, rating: "partially", comment: "Private feedback" });
    await seed("ai_usage_events", { user_id: u, kind: "chat" });
    await seed("coach_memories", { user_id: u, category: "schedule", content: "Trains at 6am", source: "member" });
    await seed("weekly_reports", { user_id: u, week_start: "2026-10-05", time_zone: "UTC", metrics: { workouts: 1 }, analysis: { summary: "Private week" }, analysis_source: "rules" });
    const habit = await seed("habit_program_enrollments", { user_id: u, program_slug: "closure-habit", started_on: "2026-10-01" });
    await seed("habit_program_checkins", { enrollment_id: habit.id, user_id: u, day_number: 1, activity_key: "water", checked_on: "2026-10-01" });

    await seed("faith_journal_entries", { user_id: u, body: "Private prayer" });
    const todayUtc = new Date().toISOString().slice(0, 10);
    await seed("bible_reading_state", { user_id: u, book_id: "JHN", chapter: 3 });
    await seed("bible_reading_history", { user_id: u, book_id: "JHN", chapter: 3, read_on: "2026-10-01" });
    await seed("bible_highlights", { user_id: u, book_id: "JHN", chapter: 3, verse: 16, color: "gold" });
    await seed("bible_bookmarks", { user_id: u, book_id: "PSA", chapter: 23 });
    await seed("bible_notes", { user_id: u, book_id: "JHN", chapter: 3, verse_start: 16, verse_end: 17, body: "Private Bible note" });
    await seed("scripture_memory", { user_id: u, book_id: "JHN", chapter: 3, verse_start: 16, verse_end: 16 });
    await seed("bible_study_progress", { user_id: u, study_slug: "the-gospel", lesson_slug: "1", notes: "Private study note" });
    await seed("bible_ai_messages", { user_id: u, thread_id: crypto.randomUUID(), role: "user", content: "Private Bible question" });
    await seed("bible_ai_usage", { user_id: u });
    await seed("faith_daily_goals", { user_id: u, goal_date: todayUtc, kind: "fitness" });
    const journey = await seed("faith_journeys", { user_id: u, plan_kind: "gospels", duration_days: 30, start_on: "2026-10-01" });
    await seed("faith_journey_attempts", { journey_id: journey.id, user_id: u, attempt_number: 1, started_on: "2026-10-01" });
    await seed("faith_journey_checkins", { journey_id: journey.id, user_id: u, check_date: "2026-10-01", prayer_completed_at: "2026-10-01T12:00:00Z", prayer_source: "online" });
    await seed("faith_reminder_prefs", { user_id: u, quiet_start: "22:00", quiet_end: "06:00" });
    const goal = await seed("discipline_goals", { user_id: u, title: "Daily prayer" });
    await seed("discipline_checkins", { goal_id: goal.id, user_id: u, checked_on: "2026-10-01" });
    await seed("faith_reminders", { user_id: u, kind: "prayer" });
    await seed("notification_reminders", { user_id: u, kind: "water", enabled: true, interval_minutes: 120, end_at: "19:00" });
    await seed("notification_prefs", { user_id: u, paused: false, quiet_start: "22:00", quiet_end: "06:00" });
    await seed("notification_devices", { user_id: u, device_key: crypto.randomUUID(), platform: "ios", label: "iPhone or iPad" });
    const enrollment = await seed("challenge_enrollments", { user_id: u, challenge_slug: "closure-challenge", started_on: "2026-10-01" });
    await seed("challenge_checkins", { enrollment_id: enrollment.id, user_id: u, day_number: 1, checked_on: "2026-10-01" });

    await seed("legal_acceptances", { user_id: u, document: "terms", version: LEGAL_PAGES.terms.version, document_sha256: LEGAL_PAGES.terms.sha256, source: "signup" });
    const subId = `sub_closure_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await seed("subscriptions", { user_id: u, stripe_subscription_id: subId, plan: "plus", status: "active", current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    await seed("legacy_plan_terms", { stripe_subscription_id: subId, user_id: u, plan: "plus", ai_monthly_limit: 60, ai_plan_monthly_limit: 0, ai_smart_monthly_limit: 6 });
    customerId = `cus_closure_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await seed("billing_customers", { user_id: u, stripe_customer_id: customerId });
    await seed("store_subscriptions", { user_id: u, store: "app_store", product_id: "ngf_pro_monthly", plan: "pro", purchased_at: now, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() });

    // Internal (not exported) records: billing counters, store sync time, sandbox-tester list.
    for (const [table, row] of [
      ["billing_state_versions", { user_id: u, version: 7 }],
      ["store_sync_state", { user_id: u, fetched_at: now }],
    ] as const) {
      const { error } = await svc.from(table).upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(`seeding ${table}: ${error.message}`);
    }
    await seed("sandbox_testers", { user_id: u, note: "Closure test account", added_by: otherAdmin.id });
    // The member, an administrator, enrolled the other admin: that row stays, with added_by set to null.
    await seed("sandbox_testers", { user_id: otherAdmin.id, note: "Closure: enrolled by the member", added_by: u });

    // Administrator audit log: one entry written by the member (as an admin), one written about the member.
    const byMember = await seed("admin_audit_logs", { actor_id: u, action: "flag.update", entity_type: "feature_flag", entity_id: "closure-flag", details: { enabled: true } });
    const aboutMember = await seed("admin_audit_logs", {
      actor_id: otherAdmin.id,
      action: "sandbox_tester.add",
      entity_type: "sandbox_tester",
      entity_id: u,
      details: { note: "Closure test account", expires_at: null },
    });
    auditIds.push(byMember.id!, aboutMember.id!);

    // Two accountability partners (user_a is the lower id of a pair): one with a higher id, so the member is user_a,
    // and one with a lower id, so the member is user_b. Nudges both ways.
    // Ids chosen at the two ends of the range (a random member id sits between them), instead of drawing random users
    // until one lands on each side: that failed when the member's own id happened to be near either end.
    const tail = () => crypto.randomUUID().slice(-12);
    partner = await createTestUser("closure-partner", { id: `ffffffff-ffff-4fff-bfff-${tail()}` });
    lowerPartner = await createTestUser("closure-partner", { id: `00000000-0000-4000-8000-${tail()}` });
    if (!(partner.id > u && lowerPartner.id < u)) throw new Error("couldn't create partners on both sides of the member's id");
    await seed("accountability_invites", { inviter_id: u, code: generateInviteCode() });
    const partnership = await seed("accountability_partnerships", { user_a: u, user_b: partner.id });
    await seed("accountability_shares", { partnership_id: partnership.id, user_id: u });
    await seed("accountability_shares", { partnership_id: partnership.id, user_id: partner.id });
    await seed("accountability_nudges", { partnership_id: partnership.id, sender_id: u, recipient_id: partner.id, message_key: "proud" });
    const second = await seed("accountability_partnerships", { user_a: lowerPartner.id, user_b: u });
    await seed("accountability_shares", { partnership_id: second.id, user_id: lowerPartner.id });
    await seed("accountability_nudges", { partnership_id: second.id, sender_id: lowerPartner.id, recipient_id: u, message_key: "proud" });

    // Files in every private bucket, uploaded with the member's own session as the app does.
    const uploads: Record<string, string> = {
      avatars: `${u}/avatar.jpg`,
      "progress-photos": `${u}/${crypto.randomUUID()}.jpg`,
      "body-scans": `${u}/${crypto.randomUUID()}/front-${crypto.randomUUID()}.jpg`,
    };
    for (const [bucket, path] of Object.entries(uploads)) {
      // Avatars: members can't upload any more (migration 090), but a file stored there earlier must still go with the
      // account, so it is placed with the server key.
      const client = bucket === "avatars" ? serviceClient() : member.client;
      const { error } = await client.storage.from(bucket).upload(path, jpeg(), { contentType: "image/jpeg" });
      if (error) throw new Error(`${bucket} upload: ${error.message}`);
      objects[bucket] = path;
    }
    await seed("progress_photos", { user_id: u, storage_path: objects["progress-photos"], taken_on: "2026-10-01", pose: "front", note: "Week 1" });
    const scanId = objects["body-scans"]!.split("/")[1]!;
    await seed("body_scans", { id: scanId, user_id: u, taken_on: "2026-10-01" });
    await seed("body_scan_photos", { scan_id: scanId, user_id: u, pose: "front", storage_path: objects["body-scans"] });

    // Rate-limit counters: by account ID (through the real limiter), by hashed email and email + hashed address (as
    // the sign-in action writes them), and one keyed only by a hashed address, which can't be tied to the member.
    expect((await rateLimit(`export:${u}`, 3, 60 * 60_000)).ok).toBe(true);
    expect((await rateLimit(`delete-account:${u}`, 5, 15 * 60_000)).ok).toBe(true);
    const windowStart = new Date(Math.floor(Date.now() / 900_000) * 900_000).toISOString();
    const { error: rlErr } = await svc.from("rate_limit_counters").insert([
      { key: `signin:${emailHash}`, window_start: windowStart, hits: 1 },
      { key: `signin:${emailHash}:ip:${hashKey("203.0.113.7")}`, window_start: windowStart, hits: 1 },
      { key: ipOnlyKey, window_start: windowStart, hits: 1 },
    ]);
    if (rlErr) throw rlErr;
  });

  afterAll(async () => {
    if (auditIds.length) await svc.from("admin_audit_logs").delete().in("id", auditIds);
    await svc.from("rate_limit_counters").delete().eq("key", ipOnlyKey);
    for (const u of [member, otherAdmin, partner, lowerPartner]) if (u) await removeUserStorage(svc, u.id).catch(() => null);
    await Promise.all([member, otherAdmin, partner, lowerPartner].map((u) => (u ? svc.auth.admin.deleteUser(u.id).catch(() => null) : null)));
  });

  it("knows every table that references an account, and every public table without such a reference", () => {
    // A new table with a foreign key to auth.users must be in the export or excluded with a reason (and then this
    // test seeds it); a new table without one must say here why it holds nothing that names a member.
    const covered = new Set([...USER_TABLES.map((t) => t.table), ...Object.keys(NOT_EXPORTED)]);
    expect(publicFks.filter((f) => !covered.has(f.table)).map((f) => `${f.table}.${f.column}`)).toEqual([]);
    expect(publicFks.filter((f) => f.onDelete !== "cascade" && f.onDelete !== "set null").map((f) => `${f.table}.${f.column} ${f.onDelete}`)).toEqual([]);
    // Only the staff-side columns are nulled; everything else cascades.
    expect(publicFks.filter((f) => f.onDelete === "set null").map((f) => `${f.table}.${f.column}`)).toEqual(["admin_audit_logs.actor_id", "sandbox_testers.added_by"]);
    const withFk = new Set(publicFks.map((f) => f.table));
    const without = sql(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by 1`)
      .map(([t]) => t!)
      .filter((t) => !withFk.has(t))
      .sort();
    expect(without).toEqual(Object.keys(PUBLIC_TABLES_WITHOUT_MEMBER_FK).sort());
    // Every auth table that references the user cascades, except SCIM provisioning (unused here), which is nulled.
    const authFks = fks.filter((f) => f.schema === "auth");
    expect(authFks.length).toBeGreaterThan(0);
    expect(authFks.filter((f) => f.onDelete !== "cascade").map((f) => `${f.table}.${f.column} ${f.onDelete}`)).toEqual(["scim_users.user_id set null"]);
  });

  it("seeds the member into every public table that references an account, every bucket, the sign-in and the counters", () => {
    const empty = publicFks.filter((f) => countWhere(f, member.id) === 0).map((f) => `${f.table}.${f.column}`);
    expect(empty).toEqual([]);
    for (const bucket of USER_STORAGE_BUCKETS) {
      expect(Number(sql(`select count(*) from storage.objects where bucket_id = ${lit(bucket)} and name like ${lit(`${member.id}/%`)}`)[0]![0]), bucket).toBe(1);
    }
    expect(Number(sql(`select count(*) from auth.sessions where user_id = ${lit(member.id)}::uuid`)[0]![0])).toBeGreaterThan(0);
    expect(Number(sql(`select count(*) from auth.refresh_tokens where user_id = ${lit(member.id)}`)[0]![0])).toBeGreaterThan(0);
    expect(Number(sql(`select count(*) from auth.identities where user_id = ${lit(member.id)}::uuid`)[0]![0])).toBe(1);
    expect(Number(sql(`select count(*) from public.rate_limit_counters where key like ${lit(`%${member.id}%`)} or key like ${lit(`%${emailHash}%`)}`)[0]![0])).toBe(4);
  });

  it("a storage failure part-way stops the deletion with the account and its rows intact, and says photos may be gone", async () => {
    const rowsBefore = publicFks.map((f) => countWhere(f, member.id));
    const r = await deleteUserAccount(member.id, {
      admin: svc,
      cancelSubscriptions: async () => undefined,
      deleteStripeCustomer: async () => {
        throw new Error("must not be reached");
      },
      // Avatars go, then the storage service fails.
      removeStorage: async (admin, id) => {
        await removeUserFolder(admin, "avatars", id);
        throw new Error("storage unavailable");
      },
      log: () => undefined,
    });
    expect(r).toEqual({ ok: false, stage: "storage", subscriptionsCancelled: true, filesRemoved: false });
    if (!r.ok) expect(deletionFailureMessage(r)).toMatch(/your account and your data still exist \(some of your photos may already have been removed\)/);
    expect((await svc.auth.admin.getUserById(member.id)).data.user?.id).toBe(member.id);
    expect(publicFks.map((f) => countWhere(f, member.id))).toEqual(rowsBefore);
    expect(Number(sql(`select count(*) from public.rate_limit_counters where key like ${lit(`%${member.id}%`)}`)[0]![0])).toBe(2);
    expect((await svc.storage.from("avatars").list(member.id)).data ?? []).toEqual([]);
    expect((await svc.storage.from("progress-photos").list(member.id)).data?.length).toBe(1);
    // Put the avatar back so the real deletion below starts with a file in every bucket.
    const { error } = await svc.storage.from("avatars").upload(objects.avatars!, jpeg(), { contentType: "image/jpeg" });
    if (error) throw error;
  });

  it("deletes in order (billing, files, account, counters, then the providers' customers), with provider failures as follow-up", async () => {
    const steps: string[] = [];
    const logged: string[] = [];
    const accountExists = async () => Boolean((await svc.auth.admin.getUserById(member.id)).data.user);
    const r = await deleteUserAccount(member.id, {
      admin: svc,
      cancelSubscriptions: async (id) => {
        expect(id).toBe(member.id);
        steps.push(`cancel:${(await accountExists()) ? "account" : "gone"}`);
      },
      deleteStripeCustomer: async (cus) => {
        expect(cus).toBe(customerId);
        steps.push(`stripe-customer:${(await accountExists()) ? "account" : "gone"}`);
      },
      deleteStoreCustomer: async (id) => {
        expect(id).toBe(member.id);
        steps.push("revenuecat-customer");
        throw new Error("RevenueCat responded 503");
      },
      log: (scope) => void logged.push(scope),
    });
    expect(r).toEqual({ ok: true, stripeCustomerDeleted: true });
    expect(steps).toEqual(["cancel:account", "stripe-customer:gone", "revenuecat-customer"]);
    expect(logged).toEqual(["account.delete.revenuecat_customer"]);
  });

  it("leaves no row, file, session or counter that references the member", async () => {
    const left = fks.filter((f) => countWhere(f, member.id) > 0).map((f) => `${f.schema}.${f.table}.${f.column}`);
    expect(left).toEqual([]);
    expect(Number(sql(`select count(*) from auth.users where id = ${lit(member.id)}::uuid`)[0]![0])).toBe(0);
    // Tables in auth that hold the user id without a foreign key.
    expect(Number(sql(`select count(*) from auth.refresh_tokens where user_id = ${lit(member.id)}`)[0]![0])).toBe(0);
    expect(Number(sql(`select count(*) from auth.flow_state where user_id = ${lit(member.id)}::uuid`)[0]![0])).toBe(0);
    expect(
      Number(sql(`select count(*) from storage.objects where owner_id = ${lit(member.id)} or name like ${lit(`${member.id}/%`)}`)[0]![0]),
    ).toBe(0);
    expect(Number(sql(`select count(*) from public.rate_limit_counters where key like ${lit(`%${member.id}%`)} or key like ${lit(`%${emailHash}%`)}`)[0]![0])).toBe(0);
    // A counter keyed only by a hashed address isn't the member's and is left to the limiter's own clean-up.
    expect(Number(sql(`select count(*) from public.rate_limit_counters where key = ${lit(ipOnlyKey)}`)[0]![0])).toBe(1);
    // The partners keep their accounts; both partnerships, every share switch on them and the nudges are gone.
    for (const p of [partner!, lowerPartner!]) {
      expect(Number(sql(`select count(*) from public.accountability_shares where user_id = ${lit(p.id)}::uuid`)[0]![0])).toBe(0);
      expect((await svc.auth.admin.getUserById(p.id)).data.user?.id).toBe(p.id);
    }
    // The other admin's sandbox entry, which the member added, stays with added_by nulled.
    expect(sql(`select note, coalesce(added_by::text, 'null') from public.sandbox_testers where user_id = ${lit(otherAdmin.id)}::uuid`)).toEqual([["Closure: enrolled by the member", "null"]]);
  });

  it("finds the member's ID, email or hashed email nowhere except the two documented logs", () => {
    const hits = sweep([member.id, member.email, emailHash]);
    // Retained, and recorded as owner/counsel decisions in docs/launch-readiness/03_ACCOUNT_DELETION_CLOSURE.md:
    //  - the administrator audit-log entry another admin wrote about the member keeps entity_id = their account ID
    //    and the admin's note (the entry the member wrote as an admin stays with actor_id nulled and names nobody);
    //  - Supabase Auth's own audit log (auth.audit_log_entries) keeps the sign-up, sign-in and deletion events with
    //    the account ID and email; the app doesn't touch it.
    //    (The local stack writes that log to the database; a project can switch database audit logging off, so
    //    its presence isn't required here, only that it holds nothing else.)
    expect(Object.keys(hits).filter((t) => t !== "auth.audit_log_entries")).toEqual(["public.admin_audit_logs"]);
    expect(hits["public.admin_audit_logs"]).toBe(1);
    const authEvents = sql(`
      select payload->>'action', payload::text from auth.audit_log_entries
      where payload::text ilike ${lit(`%${member.id}%`)} or payload::text ilike ${lit(`%${member.email}%`)}`);
    expect(authEvents.length).toBe(hits["auth.audit_log_entries"] ?? 0);
    for (const [action] of authEvents) expect(["user_signedup", "login", "logout", "token_refreshed", "token_revoked", "user_deleted"]).toContain(action);
    // Sign-in events only: none of the member's own content is in them.
    for (const [, payload] of authEvents) for (const content of ["Private prayer", "sore knee", "Trains at 6am", "Closure test account"]) expect(payload).not.toContain(content);
    const rows = sql(`select id, coalesce(actor_id::text, 'null'), entity_type, coalesce(entity_id, ''), details::text from public.admin_audit_logs where id in (${auditIds.map(lit).join(", ")}) order by created_at, action`);
    const byId = Object.fromEntries(rows.map(([id, ...rest]) => [id!, rest]));
    expect(byId[auditIds[0]!]).toEqual(["null", "feature_flag", "closure-flag", '{"enabled": true}']);
    expect(byId[auditIds[1]!]).toEqual([otherAdmin.id, "sandbox_tester", member.id, '{"note": "Closure test account", "expires_at": null}']);
    for (const [, , , , details] of rows) expect(details).not.toContain(member.email);
  });

  it("late billing events for the deleted account bring nothing back", async () => {
    // A RevenueCat webhook or sync for the deleted account: the member is unknown, nothing is fetched or written.
    expect(await syncStoreSubscriber(member.id)).toBeNull();
    // A Stripe event whose subscription metadata still names the deleted account (the customer link is gone).
    expect(await userIdForSubscription({ id: "sub_closure_late", customer: customerId, metadata: { user_id: member.id } })).toBeNull();
    expect(Number(sql(`select count(*) from public.billing_customers where stripe_customer_id = ${lit(customerId)}`)[0]![0])).toBe(0);
    expect(Object.keys(sweep([member.id])).filter((t) => t !== "auth.audit_log_entries")).toEqual(["public.admin_audit_logs"]);
  });
});
