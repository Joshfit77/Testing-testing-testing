import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The Faith pieces around the journey, against the real database: the Bible helper's own quota and private history,
 * the optional daily goals, study progress, Scripture memory, the new prayer kinds and archiving, quiet hours, and
 * enrolling through the member-facing function.
 */
const available = await stackAvailable();
const svc = serviceClient();

describe.skipIf(!available)("Faith features (database)", () => {
  let alice: TestUser;
  let bob: TestUser;
  beforeAll(async () => {
    alice = await createTestUser("faith-alice");
    bob = await createTestUser("faith-bob");
  });
  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  it("the Bible helper has its own per-minute, daily and monthly limits, separate from the coach", async () => {
    const reserve = () => svc.rpc("reserve_bible_ai_usage", { p_user_id: alice.id, p_per_minute: 2, p_daily: 3, p_monthly: 60 });
    expect((await reserve()).error).toBeNull();
    expect((await reserve()).error).toBeNull();
    expect((await reserve()).error?.message).toMatch(/bible_ai_rate_limited/);
    // A failed call doesn't count against the member.
    await svc.from("bible_ai_usage").update({ status: "failed" }).eq("user_id", alice.id);
    expect((await reserve()).error).toBeNull();
    // Older than a minute: one use counted today.
    await svc.from("bible_ai_usage").update({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("user_id", alice.id);
    await svc.from("bible_ai_usage").update({ status: "done" }).eq("user_id", alice.id).eq("status", "reserved");
    expect((await svc.from("bible_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", alice.id).neq("status", "failed")).count).toBe(1);
    expect((await reserve()).error).toBeNull();
    expect((await reserve()).error).toBeNull();
    // Two in the last minute: the per-minute limit comes first.
    expect((await reserve()).error?.message).toMatch(/bible_ai_rate_limited/);
    // A few minutes later: three uses today reach the daily limit of 3.
    await svc.from("bible_ai_usage").update({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("user_id", alice.id);
    expect((await reserve()).error?.message).toMatch(/bible_ai_quota/);
    // The coach's usage table is untouched.
    const { count } = await svc.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", alice.id);
    expect(count ?? 0).toBe(0);
    // Members can't reserve for themselves (or anyone).
    const asAlice = await alice.client.rpc("reserve_bible_ai_usage", { p_user_id: alice.id, p_per_minute: 99, p_daily: 99, p_monthly: 99 });
    expect(asAlice.error).not.toBeNull();
  });

  it("Bible helper history is private: members read and delete their own, and can't write or read anyone else's", async () => {
    const thread = crypto.randomUUID();
    await svc.from("bible_ai_messages").insert({ user_id: alice.id, thread_id: thread, role: "user", content: "What does John 3:16 mean?" });
    const forged = await alice.client.from("bible_ai_messages").insert({ user_id: alice.id, thread_id: thread, role: "assistant", content: "forged answer" });
    expect(forged.error).not.toBeNull();
    expect((await bob.client.from("bible_ai_messages").select("id").eq("user_id", alice.id)).data).toEqual([]);
    expect((await alice.client.from("bible_ai_messages").select("content")).data).toEqual([{ content: "What does John 3:16 mean?" }]);
    await bob.client.from("bible_ai_messages").delete().eq("user_id", alice.id);
    expect((await alice.client.from("bible_ai_messages").select("id")).data).toHaveLength(1);
    await alice.client.from("bible_ai_messages").delete().eq("user_id", alice.id);
    expect((await alice.client.from("bible_ai_messages").select("id")).data).toEqual([]);
  });

  it("daily goals: one of each kind per day, only near today, the member's own", async () => {
    const today = new Date().toISOString().slice(0, 10);
    expect((await alice.client.from("faith_daily_goals").insert({ user_id: alice.id, goal_date: today, kind: "faith_challenge" })).error).toBeNull();
    expect((await alice.client.from("faith_daily_goals").insert({ user_id: alice.id, goal_date: today, kind: "faith_challenge" })).error?.code).toBe("23505");
    expect((await alice.client.from("faith_daily_goals").insert({ user_id: alice.id, goal_date: "2020-01-01", kind: "fitness" })).error).not.toBeNull();
    expect((await alice.client.from("faith_daily_goals").insert({ user_id: alice.id, goal_date: today, kind: "journey" })).error).not.toBeNull();
    expect((await bob.client.from("faith_daily_goals").insert({ user_id: alice.id, goal_date: today, kind: "fitness" })).error).not.toBeNull();
    expect((await bob.client.from("faith_daily_goals").select("kind").eq("user_id", alice.id)).data).toEqual([]);
  });

  it("study progress and Scripture memory are owner-only and validated", async () => {
    expect((await alice.client.from("bible_study_progress").upsert({ user_id: alice.id, study_slug: "gospel", lesson_slug: "good-news", notes: "Mine", completed_at: new Date().toISOString() })).error).toBeNull();
    expect((await bob.client.from("bible_study_progress").select("notes").eq("user_id", alice.id)).data).toEqual([]);
    expect((await alice.client.from("scripture_memory").insert({ user_id: alice.id, book_id: "JHN", chapter: 3, verse_start: 16, verse_end: 17 })).error).toBeNull();
    // Not a real chapter, or more than 30 verses at once.
    expect((await alice.client.from("scripture_memory").insert({ user_id: alice.id, book_id: "JHN", chapter: 22, verse_start: 1, verse_end: 1 })).error).not.toBeNull();
    expect((await alice.client.from("scripture_memory").insert({ user_id: alice.id, book_id: "PSA", chapter: 119, verse_start: 1, verse_end: 40 })).error).not.toBeNull();
  });

  it("the prayer journal takes the new kinds and archiving; nothing existing changed", async () => {
    for (const kind of ["daily", "intercession", "confession", "request", "praise", "reflection"]) {
      const r = await alice.client.from("faith_journal_entries").insert({ user_id: alice.id, entry_date: new Date().toISOString().slice(0, 10), kind, body: `A ${kind} entry` });
      expect(r.error).toBeNull();
    }
    expect((await alice.client.from("faith_journal_entries").insert({ user_id: alice.id, entry_date: new Date().toISOString().slice(0, 10), kind: "gossip", body: "x" })).error).not.toBeNull();
    const { data } = await alice.client.from("faith_journal_entries").select("id").eq("kind", "confession").single();
    expect((await alice.client.from("faith_journal_entries").update({ archived_at: new Date().toISOString() }).eq("id", data!.id)).error).toBeNull();
    // Journal entries stay private and are never marked shared by default.
    const shared = await alice.client.from("faith_journal_entries").select("share_with_coach");
    expect(shared.data!.every((r) => r.share_with_coach === false)).toBe(true);
    expect((await bob.client.from("faith_journal_entries").select("id").eq("user_id", alice.id)).data).toEqual([]);
  });

  it("quiet hours need both times, and are the member's own", async () => {
    expect((await alice.client.from("faith_reminder_prefs").upsert({ user_id: alice.id, quiet_start: "22:00", quiet_end: "07:00" })).error).toBeNull();
    expect((await alice.client.from("faith_reminder_prefs").upsert({ user_id: alice.id, quiet_start: "22:00", quiet_end: null })).error).not.toBeNull();
    expect((await bob.client.from("faith_reminder_prefs").select("quiet_start").eq("user_id", alice.id)).data).toEqual([]);
    // The new reminder kinds are accepted.
    for (const kind of ["reading", "challenge", "fitness", "accountability", "final", "memorize"]) {
      expect((await alice.client.from("faith_reminders").upsert({ user_id: alice.id, kind, enabled: true, remind_at: "20:00", weekdays: [1, 2, 3] }, { onConflict: "user_id,kind" })).error).toBeNull();
    }
  });

  it("members enrol through the member-facing function, which checks the start date in their time zone", async () => {
    const { data: profile } = await svc.from("profiles").select("timezone").eq("id", bob.id).single();
    const tz = (profile?.timezone as string) || "UTC";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    const ok = await bob.client.rpc("faith_journey_enroll", { p_kind: "book", p_param: "JHN", p_duration: 30, p_start_on: today });
    expect(ok.error).toBeNull();
    const past = await bob.client.rpc("faith_journey_enroll", { p_kind: "gospels", p_param: "", p_duration: 30, p_start_on: "2020-01-01" });
    expect(past.error?.message).toMatch(/faith_invalid_start/);
    const badDuration = await bob.client.rpc("faith_journey_enroll", { p_kind: "gospels", p_param: "", p_duration: 45, p_start_on: today });
    expect(badDuration.error).not.toBeNull();
    // Check in through the member-facing function: today's reading and prayer complete Day 1.
    expect((await bob.client.rpc("faith_journey_check_in", { p_activity: "reading" })).error).toBeNull();
    const r = await bob.client.rpc("faith_journey_check_in", { p_activity: "prayer" });
    expect(r.data).toMatchObject({ day: 1, reading: true, prayer: true, source: "online" });
    // A member can't check in for someone else or write check-ins directly.
    expect((await bob.client.from("faith_journey_checkins").update({ prayer_completed_at: null }).eq("user_id", bob.id).select("journey_id")).data ?? []).toEqual([]);
    const still = await svc.from("faith_journey_checkins").select("prayer_completed_at").eq("user_id", bob.id).single();
    expect(still.data?.prayer_completed_at).not.toBeNull();
  });
});
