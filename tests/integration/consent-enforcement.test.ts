import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Migration 089: the AI sub-permissions and the wellness consent hold in the database itself, even when a member writes
 * their profile or rows directly with their own session (no app action involved), and the foreign-key indexes exist.
 */
describe.skipIf(!available)("consents enforced by the database (migration 089)", () => {
  const svc = serviceClient();
  let m: TestUser;
  const today = new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();
  const profile = async () =>
    (await svc.from("profiles").select("ai_data_consent_at, health_ai_share_consent_at, journal_ai_consent_at, coach_memory_enabled").eq("id", m.id).single()).data!;
  const marked = async () => (await svc.from("faith_journal_entries").select("id").eq("user_id", m.id).eq("share_with_coach", true)).data!.length;
  const entry = async (share = false) =>
    (await svc.from("faith_journal_entries").insert({ user_id: m.id, entry_date: today, kind: "request", body: "A private prayer", share_with_coach: share }).select("id").single()).data!.id as string;

  beforeAll(async () => {
    m = await createTestUser("consent-db");
  });
  afterAll(async () => {
    await deleteTestUser(m);
  });

  it("an entry can't be marked for the AI Coach without the journal permission, AI consent and faith features", async () => {
    await svc.from("profiles").update({ faith_enabled: true, ai_data_consent_at: null, journal_ai_consent_at: null }).eq("id", m.id);
    const id = await entry();
    expect((await m.client.from("faith_journal_entries").update({ share_with_coach: true }).eq("id", id)).error).not.toBeNull();
    expect((await m.client.from("faith_journal_entries").insert({ user_id: m.id, entry_date: today, kind: "request", body: "x", share_with_coach: true })).error).not.toBeNull();
    // Ordinary private entries still work.
    expect((await m.client.from("faith_journal_entries").insert({ user_id: m.id, entry_date: today, kind: "request", body: "private" })).error).toBeNull();

    // With all three on, marking works.
    expect((await m.client.from("profiles").update({ ai_data_consent_at: now() }).eq("id", m.id)).error).toBeNull();
    expect((await m.client.from("profiles").update({ journal_ai_consent_at: now() }).eq("id", m.id)).error).toBeNull();
    expect((await m.client.from("faith_journal_entries").update({ share_with_coach: true }).eq("id", id)).error).toBeNull();
    expect(await marked()).toBe(1);
  });

  it("changing the journal permission directly clears every mark (nothing marked earlier is ever sent)", async () => {
    await svc.from("profiles").update({ faith_enabled: true, ai_data_consent_at: now(), journal_ai_consent_at: null }).eq("id", m.id);
    await entry(true); // an old mark, written outside the app's rules
    expect(await marked()).toBeGreaterThan(0);
    expect((await m.client.from("profiles").update({ journal_ai_consent_at: now() }).eq("id", m.id)).error).toBeNull();
    expect(await marked()).toBe(0);
  });

  it("withdrawing AI consent directly also switches off health sharing, journal sharing and coaching memory", async () => {
    await svc
      .from("profiles")
      .update({ faith_enabled: true, ai_data_consent_at: now(), health_ai_share_consent_at: now(), journal_ai_consent_at: now(), coach_memory_enabled: true })
      .eq("id", m.id);
    const id = await entry();
    await m.client.from("faith_journal_entries").update({ share_with_coach: true }).eq("id", id);
    expect((await m.client.from("profiles").update({ ai_data_consent_at: null }).eq("id", m.id)).error).toBeNull();
    expect(await profile()).toMatchObject({ ai_data_consent_at: null, health_ai_share_consent_at: null, journal_ai_consent_at: null, coach_memory_enabled: false });
    expect(await marked()).toBe(0);
    // Turning AI back on doesn't bring any of them back.
    await m.client.from("profiles").update({ ai_data_consent_at: now() }).eq("id", m.id);
    expect(await profile()).toMatchObject({ health_ai_share_consent_at: null, journal_ai_consent_at: null, coach_memory_enabled: false });
  });

  it("turning faith features off switches journal sharing off", async () => {
    await svc.from("profiles").update({ faith_enabled: true, ai_data_consent_at: now(), journal_ai_consent_at: now() }).eq("id", m.id);
    await m.client.from("profiles").update({ faith_enabled: false }).eq("id", m.id);
    expect((await profile()).journal_ai_consent_at).toBeNull();
  });

  it("recovery check-ins need the wellness consent; reading and deleting don't", async () => {
    const row = { user_id: m.id, checked_on: today, sleep_quality: 3, energy: 3, soreness: 3, stress: 3, readiness_score: 60 };
    await svc.from("profiles").update({ wellness_consent_at: null }).eq("id", m.id);
    expect((await m.client.from("recovery_checkins").insert(row)).error).not.toBeNull();
    await svc.from("profiles").update({ wellness_consent_at: now() }).eq("id", m.id);
    expect((await m.client.from("recovery_checkins").insert(row)).error).toBeNull();
    // Consent withdrawn: the stored check-in can still be read and deleted, but not changed.
    await svc.from("profiles").update({ wellness_consent_at: null }).eq("id", m.id);
    expect((await m.client.from("recovery_checkins").select("id").eq("user_id", m.id)).data!.length).toBe(1);
    const upd = await m.client.from("recovery_checkins").update({ energy: 5 }).eq("user_id", m.id).select("id");
    expect(upd.error !== null || upd.data!.length === 0).toBe(true);
    expect((await m.client.from("recovery_checkins").delete().eq("user_id", m.id).select("id")).data!.length).toBe(1);
  });

  it("deletion paths have indexes on their foreign keys", () => {
    const names = ["meal_items_food_idx", "coach_memories_source_msg_idx", "training_adjustments_source_msg_idx", "ai_message_feedback_message_idx",
      "personal_records_session_idx", "workout_sessions_user_program_idx", "workout_sessions_program_day_idx", "body_scans_measurement_idx"];
    const r = spawnSync("psql", [DB_URL, "-X", "-At", "-c", `select indexname from pg_indexes where schemaname = 'public' and indexname in (${names.map((n) => `'${n}'`).join(",")}) order by 1`], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split("\n")).toEqual([...names].sort());
  });
});
