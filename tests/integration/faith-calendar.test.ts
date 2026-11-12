import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/server/services/account";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser, grantPlan } from "./helpers";

const available = await stackAvailable();

/** Stage 2C: prayer journal columns, practices, faith reminders and calendar reschedules. */
describe.skipIf(!available)("prayer journal, practices, faith reminders and planned-session overrides: RLS, constraints, export and deletion", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let entryId: string;
  let goalId: string;
  let userProgramId: string;
  let dayId: string;
  let otherDayId: string;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("fc-alice"), createTestUser("fc-bob"), createTestUser("fc-admin")]);
    // Moving calendar sessions is a Plus feature, checked by the database too.
    await Promise.all([grantPlan(alice, "plus"), grantPlan(bob, "plus")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const c = alice.client;
    const { data: e, error: eErr } = await c
      .from("faith_journal_entries")
      .insert({ user_id: alice.id, entry_date: "2026-10-20", kind: "request", title: "Healing", body: "Please heal my friend." })
      .select("id, share_with_coach")
      .single();
    if (eErr) throw eErr;
    entryId = e.id as string;
    expect(e.share_with_coach).toBe(false); // private by default
    const { data: g, error: gErr } = await c.from("discipline_goals").insert({ user_id: alice.id, title: "Prayer", practice: "prayer" }).select("id").single();
    if (gErr) throw gErr;
    goalId = g.id as string;
    await c.from("discipline_checkins").insert({ goal_id: goalId, user_id: alice.id, checked_on: "2026-10-20" });
    const { error: rErr } = await c.from("faith_reminders").insert({ user_id: alice.id, kind: "prayer", enabled: true, remind_at: "12:00", weekdays: [1, 3, 5] });
    if (rErr) throw rErr;

    // A free published program with at least two days in week 1.
    const svc = serviceClient();
    const { data: prog } = await svc.from("training_programs").select("id, program_weeks!inner(week_number, program_days(id, day_number))").eq("is_published", true).eq("tier", "free").eq("program_weeks.week_number", 1).limit(1).single();
    const days = ((prog!.program_weeks as unknown as { program_days: { id: string; day_number: number }[] }[])[0]!.program_days ?? []).sort((a, b) => a.day_number - b.day_number);
    dayId = days[0]!.id;
    otherDayId = days[1]!.id;
    const { data: up, error: upErr } = await c.from("user_programs").insert({ user_id: alice.id, program_id: prog!.id, status: "active", started_at: new Date().toISOString() }).select("id").single();
    if (upErr) throw upErr;
    userProgramId = up.id as string;
    const { error: oErr } = await c.from("planned_session_overrides").insert({ user_id: alice.id, user_program_id: userProgramId, program_day_id: dayId, planned_date: "2026-10-23" });
    if (oErr) throw oErr;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  const TABLES = ["faith_journal_entries", "discipline_goals", "discipline_checkins", "faith_reminders", "planned_session_overrides"];

  it("owners read their own rows", async () => {
    for (const t of TABLES) {
      const { data, error } = await alice.client.from(t).select("*");
      expect(error, t).toBeNull();
      expect(data?.length, t).toBe(1);
    }
  });

  it("another user (or an admin) can't read the journal or any of these rows", async () => {
    for (const client of [bob.client, admin.client]) {
      for (const t of TABLES) {
        const { data } = await client.from(t).select("*").eq("user_id", alice.id);
        expect(data, t).toEqual([]);
      }
      const byId = await client.from("faith_journal_entries").select("body").eq("id", entryId);
      expect(byId.data).toEqual([]);
      const search = await client.from("faith_journal_entries").select("id").ilike("body", "%heal%");
      expect(search.data).toEqual([]);
      const upd = await client.from("faith_journal_entries").update({ share_with_coach: true }).eq("id", entryId).select("id");
      expect(upd.data).toEqual([]);
      const ans = await client.from("faith_journal_entries").update({ answered_on: "2026-10-21" }).eq("id", entryId).select("id");
      expect(ans.data).toEqual([]);
      const rem = await client.from("faith_reminders").update({ enabled: false }).eq("user_id", alice.id).select("kind");
      expect(rem.data).toEqual([]);
      const mv = await client.from("planned_session_overrides").update({ planned_date: "2026-11-01" }).eq("user_id", alice.id).select("id");
      expect(mv.data).toEqual([]);
      const del = await client.from("planned_session_overrides").delete().eq("user_id", alice.id).select("id");
      expect(del.data).toEqual([]);
    }
    const { data } = await alice.client.from("faith_journal_entries").select("share_with_coach, answered_on").eq("id", entryId).single();
    expect(data).toEqual({ share_with_coach: false, answered_on: null });
  });

  it("nobody can plant rows for another user or reschedule another user's program", async () => {
    expect((await bob.client.from("faith_reminders").insert({ user_id: alice.id, kind: "devotional", enabled: true })).error).not.toBeNull();
    expect((await bob.client.from("faith_journal_entries").insert({ user_id: alice.id, body: "x" })).error).not.toBeNull();
    // Bob's own row pointing at Alice's enrolment.
    const o = await bob.client.from("planned_session_overrides").insert({ user_id: bob.id, user_program_id: userProgramId, program_day_id: otherDayId, planned_date: "2026-10-24" });
    expect(o.error).not.toBeNull();
  });

  it("enforces the constraints", async () => {
    const c = alice.client;
    const bad = [
      c.from("faith_journal_entries").insert({ user_id: alice.id, body: "x", kind: "lament" }),
      c.from("faith_journal_entries").insert({ user_id: alice.id, body: "x", answered_note: "note without a date" }),
      c.from("discipline_goals").insert({ user_id: alice.id, title: "Prayer again", practice: "prayer" }), // one active preset each
      c.from("discipline_goals").insert({ user_id: alice.id, title: "X", practice: "yoga" }),
      c.from("faith_reminders").insert({ user_id: alice.id, kind: "workout" }),
      c.from("faith_reminders").insert({ user_id: alice.id, kind: "devotional", weekdays: [7] }),
      c.from("planned_session_overrides").insert({ user_id: alice.id, user_program_id: userProgramId, program_day_id: dayId, planned_date: "2026-10-25" }), // one per day
      c.from("onboarding_answers").upsert({ user_id: alice.id, primary_goal: "build_strength", experience: "new", days_per_week: 3, session_minutes: 45, secondary_goal: "fly" }),
    ];
    for (const [i, q] of bad.entries()) expect((await q).error, `case ${i}`).not.toBeNull();
    // Custom practices can repeat; a secondary goal is optional.
    expect((await c.from("discipline_goals").insert({ user_id: alice.id, title: "Walk and pray", practice: "custom" })).error).toBeNull();
    expect((await c.from("discipline_goals").insert({ user_id: alice.id, title: "Walk and pray", practice: "custom" })).error).toBeNull();
    expect((await c.from("onboarding_answers").upsert({ user_id: alice.id, primary_goal: "build_strength", experience: "new", days_per_week: 3, session_minutes: 45, secondary_goal: "run_5k" })).error).toBeNull();
  });

  it("is included in the data export", async () => {
    const out = await exportUserData(alice.client, alice.id, alice.email);
    for (const t of TABLES) expect((out[t] as unknown[]).length, t).toBeGreaterThan(0);
    expect(JSON.stringify(out)).not.toContain(bob.id);
  });

  it("everything is removed when the account is deleted", async () => {
    const temp = await createTestUser("fc-temp");
    await temp.client.from("faith_reminders").insert({ user_id: temp.id, kind: "devotional", enabled: true });
    await temp.client.from("faith_journal_entries").insert({ user_id: temp.id, body: "x", share_with_coach: true });
    await deleteTestUser(temp);
    const svc = serviceClient();
    for (const t of ["faith_reminders", "faith_journal_entries"]) {
      const { count } = await svc.from(t).select("*", { count: "exact", head: true }).eq("user_id", temp.id);
      expect(count, t).toBe(0);
    }
  });
});
