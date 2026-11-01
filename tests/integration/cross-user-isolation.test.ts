import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { removeUserStorage, USER_STORAGE_BUCKETS, USER_TABLES } from "@/server/services/account";

/**
 * One sweep over EVERY user-owned table (USER_TABLES, which tests/unit/account-coverage.test.ts keeps in step with
 * the migrations) and every private storage bucket, with two ordinary members, an admin and an anonymous visitor,
 * all through the public API (anon key + each person's own session), exactly as a tampered client would.
 *
 * The per-feature tests check one table each; this one exists so that a table added later without an owner-scoped
 * policy, or a bucket without a per-folder policy, fails a test instead of leaking. Alice is seeded with a row in
 * every table (through the service role, so plan and consent gates don't get in the way), then Bob, an admin and an
 * anonymous visitor try to read, change, delete, spoof and attach to her data.
 */
const available = await stackAvailable();

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });

/** Tables where an admin legitimately sees other members' rows: the shared catalog (private programs are not personal data). */
const ADMIN_MAY_SEE = new Set(["training_programs"]);

describe.skipIf(!available)("cross-user isolation sweep: every user-owned table and private bucket", () => {
  const svc = serviceClient();
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  /** Alice's object in each private bucket. */
  const objects: Record<string, string> = {};
  /** Parent rows of Alice's, for the "attach a child row to someone else's parent" probes. */
  const parents: Record<string, string> = {};
  let exerciseId: string;

  const count = async (table: string, column: string): Promise<number> => {
    const { count: n, error } = await svc.from(table).select(column, { count: "exact", head: true }).eq(column, alice.id);
    if (error) throw new Error(`${table}: ${error.message}`);
    return n ?? 0;
  };
  const snapshot = async (table: string, column: string): Promise<string> => {
    const { data, error } = await svc.from(table).select("*").eq(column, alice.id);
    if (error) throw new Error(`${table}: ${error.message}`);
    return JSON.stringify((data ?? []).map((r) => JSON.stringify(r)).sort());
  };

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("iso-alice"), createTestUser("iso-bob"), createTestUser("iso-admin")]);
    // Bob gets the same plan and consents as Alice, so in the write probes below only ownership can stop him.
    await Promise.all([grantPlan(alice, "pro"), grantPlan(bob, "pro")]);
    await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const now = new Date().toISOString();
    const { error: pErr } = await svc
      .from("profiles")
      .update({ wellness_consent_at: now, ai_data_consent_at: now, body_scan_consent_at: now, food_photo_consent_at: now, coach_memory_enabled: true })
      .in("id", [alice.id, bob.id]);
    if (pErr) throw pErr;
    exerciseId = (await exerciseIds(["back-squat"]))["back-squat"]!;
    const u = alice.id;
    const seed = async (table: string, row: Record<string, unknown>): Promise<Record<string, string>> => {
      const { data, error } = await svc.from(table).insert(row).select("*").single();
      if (error) throw new Error(`seeding ${table}: ${error.message}`);
      return data as Record<string, string>;
    };

    // Training.
    const session = await seed("workout_sessions", { user_id: u, client_id: crypto.randomUUID(), name: "Alice private session", status: "completed", started_at: "2026-10-01T10:00:00Z", ended_at: "2026-10-01T11:00:00Z" });
    parents.workout_sessions = session.id!;
    const wex = await seed("workout_exercises", { session_id: session.id, user_id: u, exercise_id: exerciseId, position: 0 });
    parents.workout_exercises = wex.id!;
    await seed("workout_sets", { workout_exercise_id: wex.id, user_id: u, set_number: 1, reps: 5, weight_kg: 100, completed: true });
    await seed("personal_records", { user_id: u, exercise_id: exerciseId, record_type: "max_weight", value: 100 });
    const template = await seed("workout_templates", { user_id: u, name: "Alice template" });
    parents.workout_templates = template.id!;
    await seed("workout_template_exercises", { template_id: template.id, user_id: u, exercise_id: exerciseId, position: 0, sets: 3, reps: "8-12" });
    await seed("exercise_targets", { user_id: u, exercise_id: exerciseId, source: "review" });
    await seed("training_adjustments", { user_id: u, kind: "deload_week", summary: "Deload next week", source: "review" });
    await seed("training_recommendation_decisions", { user_id: u, recommendation_key: "iso-key", decision: "accepted" });
    const program = await seed("training_programs", {
      slug: `iso-private-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: "Alice AI plan",
      difficulty: "beginner",
      duration_weeks: 1,
      days_per_week: 1,
      session_minutes: 30,
      owner_id: u,
      source: "ai",
      is_published: false,
    });
    parents.training_programs = program.id!;
    const { data: published } = await svc.from("training_programs").select("id").eq("is_published", true).is("owner_id", null).limit(1).single();
    const userProgram = await seed("user_programs", { user_id: u, program_id: published!.id });
    const { data: week } = await svc.from("program_weeks").select("id").eq("program_id", published!.id).limit(1).single();
    const { data: day } = await svc.from("program_days").select("id").eq("week_id", week!.id).limit(1).single();
    await seed("planned_session_overrides", { user_id: u, user_program_id: userProgram.id, program_day_id: day!.id, planned_date: "2026-10-05" });

    // Profile, body, recovery and sleep.
    await seed("onboarding_answers", { user_id: u, primary_goal: "general_health", experience: "beginner", days_per_week: 3, session_minutes: 45, limitations: "Private note: sore knee" });
    await seed("fitness_goals", { user_id: u, title: "Squat 100 kg", goal_type: "strength" });
    await seed("weight_entries", { user_id: u, recorded_on: "2026-10-01", weight_kg: 80 });
    await seed("measurement_entries", { user_id: u, recorded_on: "2026-10-01", waist_cm: 80 });
    await seed("recovery_checkins", { user_id: u, checked_on: "2026-10-01", sleep_quality: 3, energy: 3, soreness: 3, stress: 3, readiness_score: 60 });
    const sleepId = crypto.randomUUID();
    await seed("sleep_sessions", { id: sleepId, user_id: u, started_at: "2026-10-01T22:00:00Z", ended_at: "2026-10-02T06:00:00Z", overlap_until: "2026-10-02T06:00:00Z", timezone: "UTC", night_of: "2026-10-02", source: "manual" });
    parents.sleep_sessions = sleepId;
    await seed("sleep_stages", { session_id: sleepId, user_id: u, stage: "deep", started_at: "2026-10-01T23:00:00Z", ended_at: "2026-10-02T00:00:00Z" });
    await seed("sleep_checkins", { user_id: u, day: "2026-10-02" });
    await seed("sleep_import_runs", { user_id: u, source: "apple_health", range_start: "2026-10-01T00:00:00Z", range_end: "2026-10-02T00:00:00Z" });
    await seed("daily_steps", { user_id: u, day: "2026-10-01", steps: 8000, source: "manual" });
    await seed("supplement_stack", { user_id: u, supplement_id: "creatine" });
    await seed("supplement_logs", { user_id: u, supplement_id: "creatine", taken_on: "2026-10-01" });

    // Runs.
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

    // Nutrition.
    const meal = await seed("meals", { user_id: u, eaten_on: "2026-10-01" });
    parents.meals = meal.id!;
    await seed("meal_items", { meal_id: meal.id, user_id: u, name: "Oats", servings: 1, calories: 300, source: "custom" });
    await seed("nutrition_goals", { user_id: u, calories: 2200, protein_g: 150, carbs_g: 200, fat_g: 70 });
    await seed("water_entries", { user_id: u, recorded_on: "2026-10-01", amount_ml: 500 });
    await seed("nutrition_day_marks", { user_id: u, day: "2026-10-01", status: "complete" });
    await seed("foods", { owner_id: u, source: "custom", name: "Alice custom food", serving_size: 100, serving_unit: "g", calories: 100 });
    await seed("food_favorites", { user_id: u, food_key: "usda:12345", name: "Oats", basis: { per100: { calories: 380 } } });
    const recipe = await seed("recipes", { user_id: u, name: "Alice recipe" });
    parents.recipes = recipe.id!;
    await seed("recipe_ingredients", { recipe_id: recipe.id, user_id: u, name: "Oats", source: "usda:12345", quantity: 100, unit_label: "g", basis: { per100: { calories: 380 } } });
    await seed("meal_plan_settings", { user_id: u });
    const plan = await seed("meal_plans", { user_id: u, start_date: "2026-10-01", targets: {}, settings: {} });
    parents.meal_plans = plan.id!;
    await seed("meal_plan_entries", { plan_id: plan.id, user_id: u, plan_date: "2026-10-01", slot: 0, meal_type: "breakfast", label: "Breakfast", source_key: "app:oats", name: "Oats", portion: 1, per_serving: {} });
    await seed("meal_plan_drafts", { user_id: u, start_date: "2026-10-01", days: 3, focus: "balanced", targets: {}, settings: {}, days_plan: [] });
    // One grocery list per member (keyed by user_id); its items are rows of their own, not children of the list.
    await seed("grocery_lists", { user_id: u });
    await seed("grocery_items", { user_id: u, name: "Oats", origin: "manual" });

    // AI coach.
    const conversation = await seed("ai_conversations", { user_id: u, title: "Private chat" });
    parents.ai_conversations = conversation.id!;
    await seed("ai_messages", { conversation_id: conversation.id, user_id: u, role: "user", content: "My private question" });
    await seed("ai_usage_events", { user_id: u, kind: "chat" });
    await seed("coach_memories", { user_id: u, category: "schedule", content: "Trains at 6am", source: "member" });

    // Faith.
    await seed("faith_journal_entries", { user_id: u, body: "Private prayer" });
    const goal = await seed("discipline_goals", { user_id: u, title: "Daily prayer" });
    parents.discipline_goals = goal.id!;
    await seed("discipline_checkins", { goal_id: goal.id, user_id: u, checked_on: "2026-10-01" });
    await seed("faith_reminders", { user_id: u, kind: "prayer" });
    const enrollment = await seed("challenge_enrollments", { user_id: u, challenge_slug: "iso-challenge", started_on: "2026-10-01" });
    parents.challenge_enrollments = enrollment.id!;
    await seed("challenge_checkins", { enrollment_id: enrollment.id, user_id: u, day_number: 1, checked_on: "2026-10-01" });

    // Legal and billing (written by the server in real life).
    await seed("legal_acceptances", { user_id: u, document: "terms", version: "iso-test", document_sha256: "a".repeat(64), source: "signup" });
    const subId = `sub_iso_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await seed("subscriptions", { user_id: u, stripe_subscription_id: subId, plan: "plus", status: "active", current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    await seed("legacy_plan_terms", { stripe_subscription_id: subId, user_id: u, plan: "plus", ai_monthly_limit: 60, ai_plan_monthly_limit: 0, ai_smart_monthly_limit: 6 });
    await seed("billing_customers", { user_id: u, stripe_customer_id: `cus_iso_${Date.now()}_${Math.floor(Math.random() * 1e6)}` });
    await seed("store_subscriptions", {
      user_id: u,
      store: "app_store",
      product_id: "ngf_pro_monthly",
      plan: "pro",
      purchased_at: now,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });

    // Photos: the uploads use Alice's own session, like the app does; the rows are written by the server.
    const photoPath = `${u}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await alice.client.storage.from("progress-photos").upload(photoPath, jpeg(), { contentType: "image/jpeg" });
    if (upErr) throw new Error(`progress-photos upload: ${upErr.message}`);
    objects["progress-photos"] = photoPath;
    await seed("progress_photos", { user_id: u, storage_path: photoPath, taken_on: "2026-10-01", pose: "front", note: "Week 1" });
    const scanId = crypto.randomUUID();
    const scanPath = `${u}/${scanId}/front-${crypto.randomUUID()}.jpg`;
    const { error: scanUpErr } = await alice.client.storage.from("body-scans").upload(scanPath, jpeg(), { contentType: "image/jpeg" });
    if (scanUpErr) throw new Error(`body-scans upload: ${scanUpErr.message}`);
    objects["body-scans"] = scanPath;
    await seed("body_scans", { id: scanId, user_id: u, taken_on: "2026-10-01" });
    parents.body_scans = scanId;
    await seed("body_scan_photos", { scan_id: scanId, user_id: u, pose: "front", storage_path: scanPath });
    const avatarPath = `${u}/avatar.jpg`;
    const { error: avErr } = await alice.client.storage.from("avatars").upload(avatarPath, jpeg(), { contentType: "image/jpeg" });
    if (avErr) throw new Error(`avatars upload: ${avErr.message}`);
    objects.avatars = avatarPath;
  });

  afterAll(async () => {
    for (const u of [alice, bob, admin]) if (u) await removeUserStorage(svc, u.id).catch(() => null);
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("seeds a row owned by Alice in every user-owned table, so no probe below is vacuous", async () => {
    const empty: string[] = [];
    for (const { table, column } of USER_TABLES) if ((await count(table, column)) === 0) empty.push(table);
    expect(empty).toEqual([]);
    for (const bucket of USER_STORAGE_BUCKETS) expect(objects[bucket], bucket).toBeTruthy();
  });

  it("another member cannot read any other member's rows in any user-owned table", async () => {
    const leaks: string[] = [];
    for (const { table, column } of USER_TABLES) {
      // Everything owned by anyone but Bob: Alice, and whatever other members exist in this database.
      const { data, error } = await bob.client.from(table).select(column).neq(column, bob.id).limit(5);
      if (error) leaks.push(`${table}: ${error.message}`);
      else if (data?.length) leaks.push(`${table}: ${data.length} row(s) of other members visible`);
    }
    expect(leaks).toEqual([]);
  });

  it("an admin cannot read members' personal rows either", async () => {
    const leaks: string[] = [];
    for (const { table, column } of USER_TABLES) {
      if (ADMIN_MAY_SEE.has(table)) continue;
      const { data, error } = await admin.client.from(table).select(column).neq(column, admin.id).limit(5);
      if (error) leaks.push(`${table}: ${error.message}`);
      else if (data?.length) leaks.push(`${table}: ${data.length} row(s) visible to an admin`);
    }
    expect(leaks).toEqual([]);
  });

  it("an anonymous visitor cannot read any user-owned row", async () => {
    const anon = anonClient();
    const leaks: string[] = [];
    for (const { table, column } of USER_TABLES) {
      const { data } = await anon.from(table).select(column).not(column, "is", null).limit(5);
      if (data?.length) leaks.push(`${table}: ${data.length} row(s) visible anonymously`);
    }
    expect(leaks).toEqual([]);
  });

  it("another member cannot delete any other member's rows in any user-owned table", async () => {
    const problems: string[] = [];
    for (const { table, column } of USER_TABLES) {
      const before = await count(table, column);
      const { data } = await bob.client.from(table).delete().eq(column, alice.id).select(column);
      if (data?.length) problems.push(`${table}: delete reported ${data.length} row(s)`);
      const after = await count(table, column);
      if (after !== before) problems.push(`${table}: ${before - after} row(s) deleted by another member`);
    }
    expect(problems).toEqual([]);
  });

  it("another member cannot change any other member's rows", async () => {
    // One harmless-looking edit per table that a tampered client might try.
    const edits: Record<string, Record<string, unknown>> = {
      profiles: { display_name: "hacked" },
      weight_entries: { weight_kg: 99 },
      workout_sessions: { name: "hacked" },
      workout_sets: { weight_kg: 1 },
      personal_records: { value: 1 },
      onboarding_answers: { limitations: "hacked" },
      faith_journal_entries: { body: "hacked" },
      ai_conversations: { title: "hacked" },
      ai_messages: { content: "hacked" },
      coach_memories: { content: "hacked note" },
      activities: { notes: "hacked" },
      sleep_sessions: { notes: "hacked" },
      daily_steps: { steps: 1 },
      nutrition_goals: { calories: 1000 },
      meals: { notes: "hacked" },
      recipes: { name: "hacked" },
      progress_photos: { note: "hacked" },
      body_scans: { note: "hacked" },
      legal_acceptances: { version: "hacked" },
      subscriptions: { status: "canceled" },
      user_entitlements: { plan: "free" },
      store_subscriptions: { plan: "free" },
      training_programs: { name: "hacked" },
      foods: { name: "hacked" },
    };
    const problems: string[] = [];
    for (const [table, patch] of Object.entries(edits)) {
      const column = USER_TABLES.find((t) => t.table === table)?.column;
      if (!column) throw new Error(`${table} is not a user-owned table any more`);
      const before = await snapshot(table, column);
      const { data } = await bob.client.from(table).update(patch).eq(column, alice.id).select(column);
      if (data?.length) problems.push(`${table}: update reported ${data.length} row(s)`);
      if ((await snapshot(table, column)) !== before) problems.push(`${table}: row changed by another member`);
    }
    expect(problems).toEqual([]);
  });

  it("another member cannot write rows in Alice's name", async () => {
    const spoofs: [string, Record<string, unknown>][] = [
      ["weight_entries", { user_id: alice.id, recorded_on: "2026-10-09", weight_kg: 99 }],
      ["faith_journal_entries", { user_id: alice.id, body: "planted" }],
      ["activities", { user_id: alice.id, kind: "walk", source: "manual", started_at: "2026-10-09T07:00:00Z", timezone: "UTC", distance_m: 1000, elapsed_s: 600, moving_s: 600 }],
      ["daily_steps", { user_id: alice.id, day: "2026-10-09", steps: 1, source: "manual" }],
      ["coach_memories", { user_id: alice.id, category: "other", content: "planted note", source: "member" }],
      ["meals", { user_id: alice.id, eaten_on: "2026-10-09" }],
      ["sleep_sessions", { id: crypto.randomUUID(), user_id: alice.id, started_at: "2026-10-09T22:00:00Z", ended_at: "2026-10-10T06:00:00Z", timezone: "UTC", night_of: "2026-10-10", source: "manual" }],
      ["legal_acceptances", { user_id: alice.id, document: "terms", version: "x", document_sha256: "b".repeat(64), source: "reaccept" }],
      ["ai_conversations", { user_id: alice.id, title: "planted" }],
      ["progress_photos", { user_id: alice.id, storage_path: `${alice.id}/${crypto.randomUUID()}.jpg`, taken_on: "2026-10-09", pose: "front" }],
    ];
    const problems: string[] = [];
    for (const [table, row] of spoofs) {
      const { error } = await bob.client.from(table).insert(row);
      if (!error) problems.push(`${table}: a row was written in Alice's name`);
      // Refused by row level security, not by some unrelated check (which would make the probe meaningless).
      else if (error.code !== "42501") problems.push(`${table}: refused for another reason (${error.code}: ${error.message})`);
    }
    expect(problems).toEqual([]);
  });

  it("another member cannot attach child rows to Alice's parent records", async () => {
    const attaches: [string, Record<string, unknown>][] = [
      ["workout_exercises", { session_id: parents.workout_sessions, user_id: bob.id, exercise_id: exerciseId, position: 1 }],
      ["workout_sets", { workout_exercise_id: parents.workout_exercises, user_id: bob.id, set_number: 2 }],
      ["workout_template_exercises", { template_id: parents.workout_templates, user_id: bob.id, exercise_id: exerciseId, position: 1, sets: 3 }],
      ["meal_items", { meal_id: parents.meals, user_id: bob.id, name: "planted", servings: 1, calories: 1, source: "custom" }],
      ["ai_messages", { conversation_id: parents.ai_conversations, user_id: bob.id, role: "user", content: "planted" }],
      ["sleep_stages", { session_id: parents.sleep_sessions, user_id: bob.id, stage: "awake", started_at: "2026-10-02T01:00:00Z", ended_at: "2026-10-02T01:30:00Z" }],
      ["body_scan_photos", { scan_id: parents.body_scans, user_id: bob.id, pose: "back", storage_path: `${bob.id}/${parents.body_scans}/back.jpg` }],
      ["discipline_checkins", { goal_id: parents.discipline_goals, user_id: bob.id, checked_on: "2026-10-02" }],
      ["challenge_checkins", { enrollment_id: parents.challenge_enrollments, user_id: bob.id, day_number: 2, checked_on: "2026-10-02" }],
      ["recipe_ingredients", { recipe_id: parents.recipes, user_id: bob.id, name: "planted", source: "usda:12345", quantity: 1, unit_label: "g", basis: { per100: {} } }],
      ["meal_plan_entries", { plan_id: parents.meal_plans, user_id: bob.id, plan_date: "2026-10-02", slot: 0, meal_type: "lunch", label: "Lunch", source_key: "app:oats", name: "planted", portion: 1, per_serving: {} }],
      ["program_weeks", { program_id: parents.training_programs, week_number: 2 }],
    ];
    const problems: string[] = [];
    for (const [table, row] of attaches) {
      const { error } = await bob.client.from(table).insert(row);
      if (!error) problems.push(`${table}: a row was attached to Alice's record`);
      else if (error.code !== "42501") problems.push(`${table}: refused for another reason (${error.code}: ${error.message})`);
    }
    expect(problems).toEqual([]);
  });

  it("another member cannot list, read, sign, replace or delete Alice's files in any private bucket", async () => {
    const problems: string[] = [];
    for (const bucket of USER_STORAGE_BUCKETS) {
      const path = objects[bucket]!;
      const store = bob.client.storage.from(bucket);
      const listed = await store.list(alice.id);
      if (listed.data?.length) problems.push(`${bucket}: Alice's folder is listable`);
      const scanFolder = path.split("/").slice(0, 2).join("/");
      if (scanFolder !== alice.id && (await store.list(scanFolder)).data?.length) problems.push(`${bucket}: Alice's sub-folder is listable`);
      if (!(await store.createSignedUrl(path, 60)).error) problems.push(`${bucket}: a signed link to Alice's file was issued`);
      if (!(await store.download(path)).error) problems.push(`${bucket}: Alice's file could be downloaded`);
      if (!(await store.upload(path, jpeg(), { contentType: "image/jpeg", upsert: true })).error) problems.push(`${bucket}: Alice's file could be replaced`);
      if (!(await store.upload(`${alice.id}/${crypto.randomUUID()}.jpg`, jpeg(), { contentType: "image/jpeg" })).error) problems.push(`${bucket}: a file could be planted in Alice's folder`);
      const removed = await store.remove([path]);
      if (removed.data?.length) problems.push(`${bucket}: remove reported ${removed.data.length} object(s)`);
      const stillThere = await svc.storage.from(bucket).list(path.split("/").slice(0, -1).join("/"));
      if (!stillThere.data?.some((o) => o.name === path.split("/").pop())) problems.push(`${bucket}: Alice's file is gone`);
      const anon = anonClient().storage.from(bucket);
      if ((await anon.list(alice.id)).data?.length) problems.push(`${bucket}: Alice's folder is listable anonymously`);
      if (!(await anon.createSignedUrl(path, 60)).error) problems.push(`${bucket}: anonymous signed link issued`);
    }
    expect(problems).toEqual([]);
  });

  it("members cannot call the privileged database functions", async () => {
    expect((await bob.client.rpc("plan_of", { p_user_id: alice.id })).error).not.toBeNull();
    expect((await anonClient().rpc("plan_of", { p_user_id: alice.id })).error).not.toBeNull();
    expect((await bob.client.rpc("reserve_ai_usage", { p_user_id: bob.id, p_kind: "chat", p_tier: "fast", p_chat_limit: 1000, p_plan_limit: 1000, p_smart_limit: 1000, p_per_minute: 1000 })).error).not.toBeNull();
    expect((await bob.client.rpc("admin_usage_metrics")).error).not.toBeNull();
    expect((await bob.client.rpc("record_signup_acceptances")).error).not.toBeNull();
  });

  it("private buckets accept only images within their size limit", async () => {
    const problems: string[] = [];
    const tryUpload = async (bucket: string, body: Blob, contentType: string, label: string) => {
      const { error } = await alice.client.storage.from(bucket).upload(`${alice.id}/${crypto.randomUUID()}.bin`, body, { contentType });
      if (!error) problems.push(`${bucket}: accepted ${label}`);
    };
    for (const bucket of USER_STORAGE_BUCKETS) {
      const folder = bucket === "body-scans" ? `${alice.id}/${parents.body_scans}` : alice.id;
      const up = (body: Blob, contentType: string, label: string) =>
        alice.client.storage
          .from(bucket)
          .upload(`${folder}/${crypto.randomUUID()}.bin`, body, { contentType })
          .then(({ error }) => void (!error && problems.push(`${bucket}: accepted ${label}`)));
      await up(new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "text/html", "an HTML file");
      await up(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], { type: "image/svg+xml" }), "image/svg+xml", "an SVG");
      await up(new Blob([new Uint8Array(9 * 1024 * 1024)], { type: "image/jpeg" }), "image/jpeg", "a 9 MB image");
    }
    // Avatars are smaller still (2 MB).
    await tryUpload("avatars", new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/jpeg" }), "image/jpeg", "a 3 MB avatar");
    expect(problems).toEqual([]);
  });

  it("the data export returns the member's rows from every table, and nothing of anyone else's", async () => {
    const { exportUserData } = await import("@/server/services/account");
    const out = (await exportUserData(alice.client, alice.id, alice.email)) as Record<string, unknown>;
    const problems: string[] = [];
    for (const { table, column } of USER_TABLES) {
      const rows = out[table] as Record<string, unknown>[];
      if (!rows?.length) problems.push(`${table}: missing from the export`);
      else if (rows.some((r) => r[column] !== alice.id)) problems.push(`${table}: holds another member's row`);
    }
    expect(problems).toEqual([]);
    const photoLinks = (out.progress_photo_files as { files: { download_url: string | null }[] }).files;
    const scanLinks = (out.body_scan_photo_files as { files: { download_url: string | null }[] }).files;
    expect(photoLinks.length).toBe(1);
    expect(photoLinks[0]!.download_url).toBeTruthy();
    expect(scanLinks[0]!.download_url).toBeTruthy();
    // Pointing the export at someone else's id with your own session yields nothing.
    const stolen = (await exportUserData(bob.client, alice.id, alice.email)) as Record<string, unknown>;
    expect(USER_TABLES.filter(({ table }) => (stolen[table] as unknown[]).length > 0).map((t) => t.table)).toEqual([]);
  });

  it("deleting the account removes every row in every table, every stored file and the sign-in, and nothing of Bob's", async () => {
    const { deleteUserAccount } = await import("@/server/services/account-deletion");
    const bobBefore = await Promise.all(USER_TABLES.map(async ({ table, column }) => (await svc.from(table).select(column, { count: "exact", head: true }).eq(column, bob.id)).count ?? 0));
    const result = await deleteUserAccount(alice.id, { admin: svc, cancelSubscriptions: async () => undefined, deleteStripeCustomer: null, log: () => undefined });
    expect(result).toEqual({ ok: true, stripeCustomerDeleted: null });
    const left: string[] = [];
    for (const { table, column } of USER_TABLES) if ((await count(table, column)) > 0) left.push(table);
    expect(left).toEqual([]);
    for (const bucket of USER_STORAGE_BUCKETS) {
      const folder = objects[bucket]!.split("/").slice(0, -1).join("/");
      expect((await svc.storage.from(bucket).list(folder)).data, bucket).toEqual([]);
      expect((await svc.storage.from(bucket).list(alice.id)).data, bucket).toEqual([]);
    }
    expect((await svc.auth.admin.getUserById(alice.id)).data.user).toBeNull();
    expect((await alice.client.auth.getUser()).data.user).toBeNull();
    const bobAfter = await Promise.all(USER_TABLES.map(async ({ table, column }) => (await svc.from(table).select(column, { count: "exact", head: true }).eq(column, bob.id)).count ?? 0));
    expect(bobAfter).toEqual(bobBefore);
  });
});
