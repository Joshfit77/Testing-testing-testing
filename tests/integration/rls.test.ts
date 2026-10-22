import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser, grantPlan } from "./helpers";

const available = await stackAvailable();

describe.skipIf(!available)("row level security & data isolation", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let aliceSessionId: string;
  let aliceJournalId: string;
  let aliceProgramId: string;
  let ex: Record<string, string>;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("alice"), createTestUser("bob"), createTestUser("admin")]);
    // Alice saves an AI plan below, a Pro feature the database checks.
    await grantPlan(alice, "pro");
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    ex = await exerciseIds(["back-squat", "bench-press"]);

    const { data: s, error } = await alice.client
      .from("workout_sessions")
      .insert({ user_id: alice.id, client_id: crypto.randomUUID(), name: "Alice private session", status: "completed", started_at: "2026-10-01T10:00:00Z", ended_at: "2026-10-01T11:00:00Z" })
      .select("id")
      .single();
    if (error) throw error;
    aliceSessionId = s.id;
    await alice.client.from("weight_entries").insert({ user_id: alice.id, recorded_on: "2026-10-01", weight_kg: 70 });
    await alice.client.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", alice.id);
    const { data: j } = await alice.client.from("faith_journal_entries").insert({ user_id: alice.id, body: "Private reflection" }).select("id").single();
    aliceJournalId = j!.id;
    const { data: p, error: pErr } = await alice.client
      .from("training_programs")
      .insert({ slug: `it-private-${Date.now()}`, name: "Alice AI plan", difficulty: "beginner", duration_weeks: 1, days_per_week: 1, session_minutes: 30, owner_id: alice.id, source: "ai" })
      .select("id")
      .single();
    if (pErr) throw pErr;
    aliceProgramId = p.id;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("new users get a profile and a free entitlement automatically", async () => {
    const { data: profile } = await bob.client.from("profiles").select("id, role, display_name").eq("id", bob.id).single();
    expect(profile).toMatchObject({ id: bob.id, role: "user", display_name: "bob" });
    const { data: ent } = await bob.client.from("user_entitlements").select("plan").eq("user_id", bob.id).single();
    expect(ent?.plan).toBe("free");
  });

  it("users cannot read another user's private data", async () => {
    for (const table of ["workout_sessions", "weight_entries", "faith_journal_entries", "onboarding_answers", "ai_conversations"]) {
      const { data, error } = await bob.client.from(table).select("*").eq("user_id", alice.id);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
    const { data: profiles } = await bob.client.from("profiles").select("id").eq("id", alice.id);
    expect(profiles).toEqual([]);
  });

  it("users cannot modify or delete another user's rows", async () => {
    const { data: upd } = await bob.client.from("workout_sessions").update({ name: "hacked" }).eq("id", aliceSessionId).select("id");
    expect(upd).toEqual([]);
    const { data: del } = await bob.client.from("faith_journal_entries").delete().eq("id", aliceJournalId).select("id");
    expect(del).toEqual([]);
    const { data: still } = await serviceClient().from("workout_sessions").select("name").eq("id", aliceSessionId).single();
    expect(still?.name).toBe("Alice private session");
  });

  it("users cannot attach rows to another user's parent records", async () => {
    const { error } = await bob.client.from("workout_exercises").insert({ session_id: aliceSessionId, user_id: bob.id, exercise_id: ex["back-squat"], position: 0 });
    expect(error).not.toBeNull();
    const { error: spoof } = await bob.client.from("weight_entries").insert({ user_id: alice.id, recorded_on: "2026-10-02", weight_kg: 99 });
    expect(spoof).not.toBeNull();
  });

  it("users cannot escalate their role or grant themselves a paid plan", async () => {
    const { error: roleErr } = await bob.client.from("profiles").update({ role: "admin" }).eq("id", bob.id);
    expect(roleErr).not.toBeNull();
    const { data: ent } = await bob.client.from("user_entitlements").update({ plan: "pro" }).eq("user_id", bob.id).select("plan");
    expect(ent ?? []).toEqual([]);
    const { error: subErr } = await bob.client
      .from("subscriptions")
      .insert({ user_id: bob.id, stripe_subscription_id: "sub_fake", plan: "pro", status: "active" });
    expect(subErr).not.toBeNull();
    const { data: after } = await serviceClient().from("user_entitlements").select("plan").eq("user_id", bob.id).single();
    expect(after?.plan).toBe("free");
    const { error: usageErr } = await bob.client.from("ai_usage_events").delete().eq("user_id", bob.id);
    // Delete is silently a no-op (no policy); insert is denied.
    expect(usageErr).toBeNull();
    const { error: usageIns } = await bob.client.from("ai_usage_events").insert({ user_id: bob.id, kind: "chat" });
    expect(usageIns).not.toBeNull();
  });

  it("private (AI/starter) programs are visible only to their owner", async () => {
    const { data: mine } = await alice.client.from("training_programs").select("id").eq("id", aliceProgramId);
    expect(mine).toHaveLength(1);
    const { data: theirs } = await bob.client.from("training_programs").select("id").eq("id", aliceProgramId);
    expect(theirs).toEqual([]);
    const { error } = await bob.client.from("program_weeks").insert({ program_id: aliceProgramId, week_number: 1 });
    expect(error).not.toBeNull();
    const { error: pub } = await alice.client.from("training_programs").update({ is_published: true }).eq("id", aliceProgramId);
    expect(pub).not.toBeNull();
  });

  it("ordinary users cannot edit the curated catalog; admins can", async () => {
    const { data: userEdit } = await bob.client.from("exercises").update({ name: "Hacked Squat" }).eq("id", ex["back-squat"]).select("id");
    expect(userEdit).toEqual([]);
    const { data: adminEdit, error } = await admin.client.from("exercises").update({ description: "A foundational lower-body lift with the bar resting across the upper back." }).eq("id", ex["back-squat"]).select("id");
    expect(error).toBeNull();
    expect(adminEdit).toHaveLength(1);
  });

  it("admins see aggregate metrics but not users' private health or journal data", async () => {
    const { data: metrics, error } = await admin.client.rpc("admin_usage_metrics");
    expect(error).toBeNull();
    expect(Number((metrics as { total_users: number }[])[0]!.total_users)).toBeGreaterThanOrEqual(3);
    const { data: journal } = await admin.client.from("faith_journal_entries").select("id").eq("user_id", alice.id);
    expect(journal).toEqual([]);
    const { data: weights } = await admin.client.from("weight_entries").select("id").eq("user_id", alice.id);
    expect(weights).toEqual([]);
    const { error: denied } = await bob.client.rpc("admin_usage_metrics");
    expect(denied).not.toBeNull();
  });

  it("anonymous visitors can read the published catalog only", async () => {
    const anon = anonClient();
    const { data: exercises } = await anon.from("exercises").select("id").limit(5);
    expect(exercises?.length).toBeGreaterThan(0);
    const { data: profiles } = await anon.from("profiles").select("id").limit(5);
    expect(profiles).toEqual([]);
    const { data: foods } = await anon.from("foods").select("id").limit(5);
    expect(foods).toEqual([]);
  });

  it("limitation notes require wellness consent", async () => {
    const answers = { user_id: bob.id, primary_goal: "general_health", experience: "beginner", days_per_week: 3, session_minutes: 30, limitations: "Prefer no overhead pressing" };
    const { error } = await bob.client.from("onboarding_answers").insert(answers);
    expect(error?.message).toMatch(/Consent is required/);
    await bob.client.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", bob.id);
    const { error: ok } = await bob.client.from("onboarding_answers").insert(answers);
    expect(ok).toBeNull();
  });

  it("deleting an account removes all of the user's data", async () => {
    const temp = await createTestUser("temp");
    await temp.client.from("weight_entries").insert({ user_id: temp.id, recorded_on: "2026-10-01", weight_kg: 80 });
    await serviceClient().auth.admin.deleteUser(temp.id);
    const { data } = await serviceClient().from("weight_entries").select("id").eq("user_id", temp.id);
    expect(data).toEqual([]);
    const { data: profile } = await serviceClient().from("profiles").select("id").eq("id", temp.id);
    expect(profile).toEqual([]);
  });
});
