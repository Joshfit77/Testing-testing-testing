import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The daily Bible-and-prayer rule (migration 053), against the real database. The internal functions take the clock as
 * a parameter (service role only), so each case runs at chosen moments: midnight, the offline grace window, daylight
 * saving changes, long absences.
 */
const available = await stackAvailable();
const svc = serviceClient();

/** A moment in a time zone, as an ISO instant ("2026-03-08 01:30" in America/New_York → UTC). */
function at(local: string, tz: string): string {
  // Find the UTC instant whose wall-clock time in `tz` is `local` (search within ±15 h; exact for whole minutes).
  const [d, t] = local.split(" ");
  const guess = Date.parse(`${d}T${t}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let off = -15 * 60; off <= 15 * 60; off += 15) {
    const inst = guess - off * 60_000;
    const p = Object.fromEntries(fmt.formatToParts(new Date(inst)).map((x) => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` === local) return new Date(inst).toISOString();
  }
  throw new Error(`no instant for ${local} in ${tz}`);
}

async function setTz(u: TestUser, tz: string) {
  await svc.from("profiles").update({ timezone: tz }).eq("id", u.id);
}

/** Enrol as of `today` (the function checks the start against the member's real "today", so we insert directly). */
async function enroll(u: TestUser, startOn: string, duration = 30, kind = "gospels") {
  await svc.from("faith_journeys").update({ status: "ended", ended_at: new Date().toISOString() }).eq("user_id", u.id).eq("status", "active");
  await svc.from("faith_journey_attempts").update({ status: "ended", ended_at: new Date().toISOString() }).eq("user_id", u.id).eq("status", "active");
  const { data, error } = await svc.from("faith_journeys").insert({ user_id: u.id, plan_kind: kind, duration_days: duration, start_on: startOn }).select("id").single();
  if (error) throw error;
  await svc.from("faith_journey_attempts").insert({ journey_id: data.id, user_id: u.id, attempt_number: 1, started_on: startOn });
  return data.id as string;
}

async function checkIn(u: TestUser, activity: "reading" | "prayer", now: string, occurredAt?: string) {
  const { data, error } = await svc.rpc("faith_journey_check_in_at", { p_user: u.id, p_activity: activity, p_now: now, p_occurred_at: occurredAt ?? null });
  if (error) throw new Error(error.message);
  return data as { date: string; day: number; reading: boolean; prayer: boolean; source: string };
}

async function settle(journeyId: string, now: string) {
  const { error } = await svc.rpc("faith_journey_settle_at", { p_journey_id: journeyId, p_now: now });
  if (error) throw new Error(error.message);
}

async function attempts(journeyId: string) {
  const { data } = await svc.from("faith_journey_attempts").select("attempt_number, started_on, status, interrupted_on, interruption_reason, days_completed").eq("journey_id", journeyId).order("attempt_number");
  return data ?? [];
}

async function journeyStatus(journeyId: string) {
  return (await svc.from("faith_journeys").select("status").eq("id", journeyId).single()).data?.status;
}

describe.skipIf(!available)("Faith journeys: the daily Bible-and-prayer rule", () => {
  let u: TestUser;
  let other: TestUser;
  const TZ = "America/Chicago";

  beforeAll(async () => {
    [u, other] = await Promise.all([createTestUser("journey"), createTestUser("journey-other")]);
    await setTz(u, TZ);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(u), deleteTestUser(other)]);
  });

  it("both activities completed → the journey advances to the next day", async () => {
    const j = await enroll(u, "2026-06-01");
    expect((await checkIn(u, "reading", at("2026-06-01 07:00", TZ))).day).toBe(1);
    const s = await checkIn(u, "prayer", at("2026-06-01 21:00", TZ));
    expect(s).toMatchObject({ date: "2026-06-01", day: 1, reading: true, prayer: true });
    await settle(j, at("2026-06-02 09:00", TZ));
    expect(await attempts(j)).toEqual([expect.objectContaining({ attempt_number: 1, status: "active", started_on: "2026-06-01" })]);
    // Day 2 is today's day.
    expect((await checkIn(u, "prayer", at("2026-06-02 09:05", TZ))).day).toBe(2);
  });

  it.each([
    ["reading only → reset (prayer missing)", ["reading"], "prayer"],
    ["prayer only → reset (reading missing)", ["prayer"], "reading"],
    ["neither → reset", [], "both"],
  ] as const)("%s", async (_name, done, reason) => {
    const j = await enroll(u, "2026-06-10");
    // Day 1 complete, Day 2 incomplete.
    await checkIn(u, "reading", at("2026-06-10 08:00", TZ));
    await checkIn(u, "prayer", at("2026-06-10 08:01", TZ));
    for (const a of done) await checkIn(u, a, at("2026-06-11 20:00", TZ));
    // Before midnight + grace nothing changes.
    await settle(j, at("2026-06-12 02:59", TZ));
    expect((await attempts(j))[0]).toMatchObject({ status: "active" });
    // After the deadline the attempt is interrupted and Day 1 starts on the next day.
    await settle(j, at("2026-06-12 03:01", TZ));
    expect(await attempts(j)).toEqual([
      expect.objectContaining({ attempt_number: 1, status: "interrupted", interrupted_on: "2026-06-11", interruption_reason: reason, days_completed: 1 }),
      expect.objectContaining({ attempt_number: 2, status: "active", started_on: "2026-06-12" }),
    ]);
    // The schedule restarts at Day 1.
    expect((await checkIn(u, "reading", at("2026-06-12 10:00", TZ))).day).toBe(1);
  });

  it("a reading marked for another day's passage doesn't count", async () => {
    const j = await enroll(u, "2026-06-20");
    await checkIn(u, "reading", at("2026-06-20 08:00", TZ));
    await checkIn(u, "prayer", at("2026-06-20 08:01", TZ));
    // The Day 1 reading row is reused for 06-21 only if re-marked for Day 2; simulate a stale Day 1 mark on 06-21.
    await svc.from("faith_journey_checkins").insert({ journey_id: j, user_id: u.id, check_date: "2026-06-21", reading_day: 1, reading_completed_at: at("2026-06-21 08:00", TZ), reading_source: "online", prayer_completed_at: at("2026-06-21 08:00", TZ), prayer_source: "online" });
    await settle(j, at("2026-06-22 04:00", TZ));
    expect((await attempts(j))[0]).toMatchObject({ status: "interrupted", interrupted_on: "2026-06-21", interruption_reason: "reading" });
  });

  it("settling is idempotent: many calls (several devices, the scheduled job) record one interruption", async () => {
    const j = await enroll(u, "2026-07-01");
    const now = at("2026-07-02 05:00", TZ);
    await Promise.all(Array.from({ length: 8 }, () => settle(j, now)));
    await settle(j, now);
    const { error } = await svc.rpc("faith_journeys_settle_due", { p_now: now });
    expect(error).toBeNull();
    expect(await attempts(j)).toEqual([
      expect.objectContaining({ attempt_number: 1, status: "interrupted", interrupted_on: "2026-07-01", interruption_reason: "both", days_completed: 0 }),
      expect.objectContaining({ attempt_number: 2, status: "active", started_on: "2026-07-02" }),
    ]);
  });

  it("a long absence records one interruption; Day 1 of the new attempt moves to the day the member returns", async () => {
    const j = await enroll(u, "2026-07-10");
    for (const d of ["10", "11", "12"]) {
      await checkIn(u, "reading", at(`2026-07-${d} 07:00`, TZ));
      await checkIn(u, "prayer", at(`2026-07-${d} 07:01`, TZ));
    }
    // Away from the 13th to the 22nd; the scheduled job runs meanwhile.
    for (let d = 14; d <= 23; d++) await svc.rpc("faith_journeys_settle_due", { p_now: at(`2026-07-${d} 06:00`, TZ) });
    expect(await attempts(j)).toEqual([
      expect.objectContaining({ attempt_number: 1, status: "interrupted", interrupted_on: "2026-07-13", days_completed: 3 }),
      expect.objectContaining({ attempt_number: 2, status: "active", started_on: "2026-07-23" }),
    ]);
    expect((await checkIn(u, "reading", at("2026-07-23 08:00", TZ))).day).toBe(1);
  });

  it("duplicate check-ins are harmless; the first time is kept", async () => {
    const j = await enroll(u, "2026-08-01");
    const first = at("2026-08-01 06:00", TZ);
    await checkIn(u, "prayer", first);
    await checkIn(u, "prayer", at("2026-08-01 06:30", TZ));
    await Promise.all([checkIn(u, "reading", at("2026-08-01 07:00", TZ)), checkIn(u, "reading", at("2026-08-01 07:00", TZ))]);
    const rows = (await svc.from("faith_journey_checkins").select("check_date, prayer_completed_at, reading_day").eq("journey_id", j)).data!;
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0]!.prayer_completed_at).toISOString()).toBe(first);
    expect(rows[0]!.reading_day).toBe(1);
  });

  describe("offline check-ins (the 3-hour rule)", () => {
    it("made before midnight, delivered within 3 hours: counts for that day", async () => {
      const j = await enroll(u, "2026-08-10");
      await checkIn(u, "reading", at("2026-08-10 20:00", TZ));
      const s = await checkIn(u, "prayer", at("2026-08-11 01:30", TZ), at("2026-08-10 23:50", TZ));
      expect(s).toMatchObject({ date: "2026-08-10", day: 1, source: "offline", prayer: true });
      await settle(j, at("2026-08-11 04:00", TZ));
      expect((await attempts(j))[0]).toMatchObject({ status: "active" });
    });

    it("delivered after the grace window: refused with a clear error, not moved to another day", async () => {
      const j = await enroll(u, "2026-08-20");
      await checkIn(u, "reading", at("2026-08-20 20:00", TZ));
      await expect(checkIn(u, "prayer", at("2026-08-21 03:30", TZ), at("2026-08-20 23:50", TZ))).rejects.toThrow("faith_offline_too_late");
      await settle(j, at("2026-08-21 03:31", TZ));
      expect((await attempts(j))[0]).toMatchObject({ status: "interrupted", interruption_reason: "prayer" });
    });

    it("once the member checks in for the new day, yesterday is final (a later offline check-in for it is refused)", async () => {
      const j = await enroll(u, "2026-08-25");
      await checkIn(u, "reading", at("2026-08-25 20:00", TZ));
      // Online check-in at 00:30 for the 26th settles the 25th at once.
      const s = await checkIn(u, "prayer", at("2026-08-26 00:30", TZ));
      expect(s).toMatchObject({ date: "2026-08-26", day: 1 });
      expect((await attempts(j)).map((a) => a.status)).toEqual(["interrupted", "active"]);
      await expect(checkIn(u, "prayer", at("2026-08-26 00:40", TZ), at("2026-08-25 23:55", TZ))).rejects.toThrow("faith_day_closed");
    });

    it("an occurred-at in the future or days ago is refused", async () => {
      await enroll(u, "2026-09-01");
      await expect(checkIn(u, "prayer", at("2026-09-03 10:00", TZ), at("2026-09-01 10:00", TZ))).rejects.toThrow("faith_offline_too_late");
    });
  });

  it("time zones: the member's own calendar day decides, wherever the server is", async () => {
    await setTz(u, "Pacific/Auckland");
    const j = await enroll(u, "2026-09-10");
    // 2026-09-10 06:00 in Auckland is still 2026-09-09 in UTC.
    const s = await checkIn(u, "reading", at("2026-09-10 06:00", "Pacific/Auckland"));
    expect(s.date).toBe("2026-09-10");
    await checkIn(u, "prayer", at("2026-09-10 23:59", "Pacific/Auckland"));
    // Just after Auckland midnight + grace, the day is final and complete.
    await settle(j, at("2026-09-11 03:05", "Pacific/Auckland"));
    expect((await attempts(j))[0]).toMatchObject({ status: "active" });
    await setTz(u, TZ);
  });

  it("daylight saving: a 23-hour day and a 25-hour day count as one day each", async () => {
    await setTz(u, "America/New_York");
    // US clocks spring forward on 2026-03-08 and fall back on 2026-11-01.
    const spring = await enroll(u, "2026-03-07");
    for (const [d, t] of [["2026-03-07", "23:30"], ["2026-03-08", "03:30"], ["2026-03-09", "00:15"]]) {
      await checkIn(u, "reading", at(`${d} ${t}`, "America/New_York"));
      await checkIn(u, "prayer", at(`${d} ${t}`, "America/New_York"));
    }
    await settle(spring, at("2026-03-10 03:30", "America/New_York"));
    expect(await attempts(spring)).toEqual([expect.objectContaining({ status: "active", started_on: "2026-03-07" })]);
    const fall = await enroll(u, "2026-10-31");
    await checkIn(u, "reading", at("2026-10-31 12:00", "America/New_York"));
    await checkIn(u, "prayer", at("2026-10-31 12:00", "America/New_York"));
    // Nothing on 2026-11-01 (25 hours long): final at 03:00 on the 2nd, local time.
    await settle(fall, at("2026-11-02 02:30", "America/New_York"));
    expect((await attempts(fall))[0]).toMatchObject({ status: "active" });
    await settle(fall, at("2026-11-02 03:00", "America/New_York"));
    expect((await attempts(fall))[0]).toMatchObject({ status: "interrupted", interrupted_on: "2026-11-01", days_completed: 1 });
    await setTz(u, TZ);
  });

  it.each([30, 60, 90, 180, 365])("a %i-day journey: day numbering runs to the last day, which completes it", async (days) => {
    const start = "2027-01-01";
    const j = await enroll(u, start, days);
    const last = new Date(Date.parse(`${start}T12:00:00Z`) + (days - 1) * 86_400_000).toISOString().slice(0, 10);
    // Fill every day but the last directly (a full run of check-ins is covered for 30 days below), then finish live.
    const rows = Array.from({ length: days - 1 }, (_, i) => {
      const d = new Date(Date.parse(`${start}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      return { journey_id: j, user_id: u.id, check_date: d, reading_day: i + 1, reading_completed_at: `${d}T15:00:00Z`, reading_source: "online", prayer_completed_at: `${d}T15:00:00Z`, prayer_source: "online" };
    });
    if (rows.length) await svc.from("faith_journey_checkins").insert(rows);
    await settle(j, at(`${last} 09:00`, TZ));
    expect(await journeyStatus(j)).toBe("active");
    expect((await checkIn(u, "reading", at(`${last} 09:00`, TZ))).day).toBe(days);
    await checkIn(u, "prayer", at(`${last} 09:01`, TZ));
    expect(await journeyStatus(j)).toBe("completed");
    expect((await attempts(j))[0]).toMatchObject({ status: "completed", days_completed: days });
  });

  it("a full 30-day run day by day, with the scheduled job running every night", async () => {
    const j = await enroll(u, "2027-03-01", 30);
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.parse("2027-03-01T12:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
      expect((await checkIn(u, "reading", at(`${d} 07:00`, TZ))).day).toBe(i + 1);
      await checkIn(u, "prayer", at(`${d} 21:00`, TZ));
      await svc.rpc("faith_journeys_settle_due", { p_now: at(`${d} 23:50`, TZ) });
    }
    expect(await journeyStatus(j)).toBe("completed");
  });

  it("a reset deletes nothing: earlier check-ins, notes, highlights, bookmarks and prayer journal entries remain", async () => {
    const j = await enroll(u, "2027-05-01");
    await checkIn(u, "reading", at("2027-05-01 07:00", TZ));
    await svc.from("bible_notes").insert({ user_id: u.id, book_id: "JHN", chapter: 3, verse_start: 16, verse_end: 16, body: "Kept after a reset." });
    await svc.from("bible_highlights").insert({ user_id: u.id, book_id: "JHN", chapter: 3, verse: 16, color: "gold" });
    await svc.from("bible_bookmarks").insert({ user_id: u.id, book_id: "PSA", chapter: 23 });
    await svc.from("faith_journal_entries").insert({ user_id: u.id, body: "A prayer that stays.", kind: "daily" });
    await settle(j, at("2027-05-02 04:00", TZ));
    expect((await attempts(j)).map((a) => a.status)).toEqual(["interrupted", "active"]);
    expect((await svc.from("faith_journey_checkins").select("check_date").eq("journey_id", j)).data).toHaveLength(1);
    expect((await svc.from("bible_notes").select("id").eq("user_id", u.id)).data).toHaveLength(1);
    expect((await svc.from("bible_highlights").select("verse").eq("user_id", u.id)).data).toHaveLength(1);
    expect((await svc.from("bible_bookmarks").select("id").eq("user_id", u.id)).data).toHaveLength(1);
    expect((await svc.from("faith_journal_entries").select("id").eq("user_id", u.id)).data!.length).toBeGreaterThanOrEqual(1);
  });

  describe("security", () => {
    it("members can't write progress directly, call the internal functions or see another member's journey", async () => {
      const j = await enroll(u, "2027-06-01");
      const planted = await u.client.from("faith_journey_checkins").insert({ journey_id: j, user_id: u.id, check_date: "2027-06-01", prayer_completed_at: new Date().toISOString() });
      expect(planted.error).not.toBeNull();
      const forged = await u.client.from("faith_journey_attempts").update({ status: "active", interrupted_on: null }).eq("journey_id", j).select("id");
      expect(forged.data ?? []).toEqual([]);
      expect((await u.client.rpc("faith_journey_check_in_at", { p_user: u.id, p_activity: "prayer", p_now: new Date().toISOString() })).error).not.toBeNull();
      expect((await u.client.rpc("faith_journey_settle_at", { p_journey_id: j, p_now: "2099-01-01T00:00:00Z" })).error).not.toBeNull();
      expect((await other.client.from("faith_journeys").select("id").eq("id", j)).data).toEqual([]);
      expect((await other.client.from("faith_journey_checkins").select("check_date").eq("journey_id", j)).data).toEqual([]);
      // Another member's check-in function only ever touches their own journey.
      expect((await other.client.rpc("faith_journey_check_in", { p_activity: "prayer" })).error?.message).toContain("faith_no_journey");
    });

    it("the member's own enrolment: today or up to 30 days ahead, supported durations only; ending keeps history", async () => {
      await svc.from("profiles").update({ timezone: "UTC" }).eq("id", other.id);
      const today = new Date().toISOString().slice(0, 10);
      const past = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
      const far = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
      expect((await other.client.rpc("faith_journey_enroll", { p_kind: "gospels", p_param: null, p_duration: 30, p_start_on: past })).error?.message).toContain("faith_invalid_start");
      expect((await other.client.rpc("faith_journey_enroll", { p_kind: "gospels", p_param: null, p_duration: 30, p_start_on: far })).error?.message).toContain("faith_invalid_start");
      expect((await other.client.rpc("faith_journey_enroll", { p_kind: "gospels", p_param: null, p_duration: 45, p_start_on: today })).error).not.toBeNull();
      expect((await other.client.rpc("faith_journey_enroll", { p_kind: "book", p_param: "XYZ", p_duration: 30, p_start_on: today })).error).not.toBeNull();
      const first = await other.client.rpc("faith_journey_enroll", { p_kind: "new_testament", p_param: null, p_duration: 90, p_start_on: today });
      expect(first.error).toBeNull();
      const s = await other.client.rpc("faith_journey_check_in", { p_activity: "reading" });
      expect(s.data).toMatchObject({ day: 1, reading: true, prayer: false });
      // Undo today's tap.
      await other.client.rpc("faith_journey_undo", { p_activity: "reading" });
      expect((await other.client.from("faith_journey_checkins").select("reading_completed_at").single()).data?.reading_completed_at).toBeNull();
      const second = await other.client.rpc("faith_journey_enroll", { p_kind: "book", p_param: "JHN", p_duration: 30, p_start_on: today });
      expect(second.error).toBeNull();
      const all = (await other.client.from("faith_journeys").select("status").order("created_at")).data!;
      expect(all.map((r) => r.status)).toEqual(["ended", "active"]);
    });
  });
});
