import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Reminder settings (migration 055): stored per account, off unless saved, readable and writable only by their owner,
 * with the database refusing invalid values; each member's phones listed separately and capped at ten.
 */
describe.skipIf(!available)("notification settings", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    a = await createTestUser("notif-a");
    b = await createTestUser("notif-b");
  });
  afterAll(async () => {
    await deleteTestUser(a);
    await deleteTestUser(b);
  });

  it("a new account has no reminder rows (everything off) and no preferences", async () => {
    const [r, p, d] = await Promise.all([
      a.client.from("notification_reminders").select("kind").eq("user_id", a.id),
      a.client.from("notification_prefs").select("user_id").eq("user_id", a.id),
      a.client.from("notification_devices").select("id").eq("user_id", a.id),
    ]);
    expect([r.data, p.data, d.data]).toEqual([[], [], []]);
  });

  it("saves custom times, days, frequency and preferences to the account, and reads them back", async () => {
    const { error } = await a.client.from("notification_reminders").upsert(
      [
        // Every row carries every column, as the app's save does (a bulk upsert sends null for a missing one).
        { user_id: a.id, kind: "workout", enabled: true, remind_at: "06:45", weekdays: [1, 3, 5], interval_minutes: null, end_at: null, style: "faith" },
        { user_id: a.id, kind: "water", enabled: true, remind_at: "08:00", weekdays: [0, 1, 2, 3, 4, 5, 6], interval_minutes: 90, end_at: "18:00", style: "friendly" },
      ],
      { onConflict: "user_id,kind" },
    );
    expect(error).toBeNull();
    expect((await a.client.from("notification_prefs").upsert({ user_id: a.id, paused: true, quiet_start: "21:30", quiet_end: "06:30", daily_limit: 5 })).error).toBeNull();
    const { data } = await a.client.from("notification_reminders").select("kind, enabled, remind_at, weekdays, interval_minutes, end_at, style").eq("user_id", a.id).order("kind");
    expect(data).toEqual([
      { kind: "water", enabled: true, remind_at: "08:00:00", weekdays: [0, 1, 2, 3, 4, 5, 6], interval_minutes: 90, end_at: "18:00:00", style: "friendly" },
      { kind: "workout", enabled: true, remind_at: "06:45:00", weekdays: [1, 3, 5], interval_minutes: null, end_at: null, style: "faith" },
    ]);
    const prefs = await a.client.from("notification_prefs").select("paused, quiet_start, quiet_end, daily_limit").eq("user_id", a.id).single();
    expect(prefs.data).toEqual({ paused: true, quiet_start: "21:30:00", quiet_end: "06:30:00", daily_limit: 5 });
  });

  it("the new Faith reminder kinds can be saved", async () => {
    const { error } = await a.client.from("faith_reminders").upsert(
      [
        { user_id: a.id, kind: "plan_progress", enabled: true, remind_at: "18:00", weekdays: [0] },
        { user_id: a.id, kind: "prayer_followup", enabled: true, remind_at: "19:30", weekdays: [3] },
      ],
      { onConflict: "user_id,kind" },
    );
    expect(error).toBeNull();
  });

  it("refuses invalid settings: unknown kinds, a marketing kind, bad intervals, intervals on non-water reminders, half quiet hours, limits out of range", async () => {
    const bad = [
      a.client.from("notification_reminders").insert({ user_id: a.id, kind: "promotions", enabled: true }),
      a.client.from("notification_reminders").insert({ user_id: a.id, kind: "marketing", enabled: true }),
      a.client.from("notification_reminders").upsert({ user_id: a.id, kind: "water", interval_minutes: 5 }, { onConflict: "user_id,kind" }),
      a.client.from("notification_reminders").upsert({ user_id: a.id, kind: "lunch", interval_minutes: 60 }, { onConflict: "user_id,kind" }),
      a.client.from("notification_reminders").upsert({ user_id: a.id, kind: "dinner", weekdays: [7] }, { onConflict: "user_id,kind" }),
      a.client.from("notification_prefs").upsert({ user_id: a.id, quiet_start: "22:00", quiet_end: null }),
      a.client.from("notification_prefs").upsert({ user_id: a.id, daily_limit: 0 }),
      a.client.from("notification_prefs").upsert({ user_id: a.id, daily_limit: 99 }),
      a.client.from("faith_reminders").upsert({ user_id: a.id, kind: "offers" }, { onConflict: "user_id,kind" }),
    ];
    for (const [i, q] of bad.entries()) expect((await q).error, `case ${i}`).not.toBeNull();
  });

  it("one member can't read, change or delete another's settings or phones", async () => {
    await b.client.from("notification_devices").insert({ user_id: b.id, device_key: crypto.randomUUID(), platform: "android", label: "Android device" });
    expect((await b.client.from("notification_reminders").select("kind").eq("user_id", a.id)).data).toEqual([]);
    expect((await b.client.from("notification_prefs").select("user_id").eq("user_id", a.id)).data).toEqual([]);
    const upd = await b.client.from("notification_reminders").update({ enabled: false }).eq("user_id", a.id).select("kind");
    expect(upd.data ?? []).toEqual([]);
    expect((await b.client.from("notification_reminders").insert({ user_id: a.id, kind: "lunch" })).error).not.toBeNull();
    expect((await b.client.from("notification_devices").insert({ user_id: a.id, device_key: crypto.randomUUID(), platform: "ios", label: "x" })).error).not.toBeNull();
    const del = await b.client.from("notification_prefs").delete().eq("user_id", a.id).select("user_id");
    expect(del.data ?? []).toEqual([]);
    expect((await a.client.from("notification_prefs").select("paused").eq("user_id", a.id).single()).data).toEqual({ paused: true });
    // And A can't see B's phone.
    expect((await a.client.from("notification_devices").select("id").eq("user_id", b.id)).data).toEqual([]);
  });

  it("the same phone signed in to two accounts is two separate entries (account switching)", async () => {
    const key = crypto.randomUUID();
    expect((await a.client.from("notification_devices").insert({ user_id: a.id, device_key: key, platform: "ios", label: "iPhone or iPad" })).error).toBeNull();
    expect((await b.client.from("notification_devices").insert({ user_id: b.id, device_key: key, platform: "ios", label: "iPhone or iPad" })).error).toBeNull();
    // Re-registering the same phone updates its entry instead of adding another.
    const again = await a.client.from("notification_devices").upsert({ user_id: a.id, device_key: key, platform: "ios", label: "iPhone or iPad", permission: "denied" }, { onConflict: "user_id,device_key" });
    expect(again.error).toBeNull();
    expect((await a.client.from("notification_devices").select("permission, delivers").eq("device_key", key)).data).toEqual([{ permission: "denied", delivers: true }]);
  });

  it("keeps at most ten phones per member (the oldest is forgotten)", async () => {
    for (let i = 0; i < 12; i++) {
      const { error } = await a.client
        .from("notification_devices")
        .insert({ user_id: a.id, device_key: crypto.randomUUID(), platform: "android", label: "Android device", last_sync_at: new Date(Date.now() + i * 1000).toISOString() });
      expect(error).toBeNull();
    }
    const { count } = await serviceClient().from("notification_devices").select("id", { count: "exact", head: true }).eq("user_id", a.id);
    expect(count).toBe(10);
  });
});
