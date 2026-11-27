import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Reading journeys keep their own time zone (owner decision T10, migration 061), against the real database at chosen
 * moments: the zone is fixed when the journey starts; changing the profile doesn't move its days; an explicit change
 * waits for a midnight both zones share, so completed days stay as they are, today keeps its deadline and no day is
 * skipped.
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



async function setJourneyTz(u: TestUser, tz: string, now: string) {
  const { data, error } = await svc.rpc("faith_journey_set_timezone_at", { p_user: u.id, p_tz: tz, p_now: now });
  if (error) throw new Error(error.message);
  return data as { timezone: string; pending: string | null; switch_at: string | null; change_on?: string };
}

async function journeyRow(id: string) {
  return (await svc.from("faith_journeys").select("timezone, pending_timezone, timezone_switch_at").eq("id", id).single()).data!;
}

async function completeDay(u: TestUser, local: string, tz: string) {
  await checkIn(u, "reading", at(`${local} 07:00`, tz));
  return checkIn(u, "prayer", at(`${local} 20:00`, tz));
}

describe.skipIf(!available)("Faith journeys keep their own time zone", () => {
  let u: TestUser;
  const CHI = "America/Chicago";

  beforeAll(async () => {
    u = await createTestUser("journey-tz");
  });
  afterAll(async () => {
    await deleteTestUser(u);
  });

  it("a journey takes the profile's zone when it starts, and changing the profile later doesn't move its days", async () => {
    await setTz(u, CHI);
    const j = await enroll(u, "2026-06-01");
    expect((await journeyRow(j)).timezone).toBe(CHI);
    await setTz(u, "Asia/Tokyo");
    // 21:00 in Chicago on June 1 is already June 2 in Tokyo: the check-in still counts for the journey's June 1.
    const s = await checkIn(u, "reading", at("2026-06-01 21:00", CHI));
    expect(s).toMatchObject({ date: "2026-06-01", day: 1 });
    await setTz(u, CHI);
  });

  it("moving east: the change starts at a shared midnight and every completed day stays complete", async () => {
    await setTz(u, CHI);
    const j = await enroll(u, "2026-06-01");
    await completeDay(u, "2026-06-01", CHI);
    await completeDay(u, "2026-06-02", CHI);
    await completeDay(u, "2026-06-03", CHI);
    const r = await setJourneyTz(u, "Europe/Berlin", at("2026-06-03 21:00", CHI));
    expect(r).toMatchObject({ timezone: CHI, pending: "Europe/Berlin", change_on: "2026-06-04" });
    // The later of Chicago's and Berlin's midnight: Chicago's (05:00 UTC).
    expect(new Date(r.switch_at!).toISOString()).toBe(at("2026-06-04 00:00", CHI));
    // Day 4 in Berlin, then the next morning: nothing was restarted.
    await completeDay(u, "2026-06-04", "Europe/Berlin");
    await settle(j, at("2026-06-05 10:00", "Europe/Berlin"));
    const a = await attempts(j);
    expect(a).toEqual([expect.objectContaining({ attempt_number: 1, status: "active", started_on: "2026-06-01" })]);
    const { data: rows } = await svc.from("faith_journey_checkins").select("check_date").eq("journey_id", j).order("check_date");
    expect(rows!.map((x) => x.check_date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"]);
  });

  it("moving west late in the evening can't buy extra time for today: the missed day still restarts the journey", async () => {
    await setTz(u, CHI);
    const j = await enroll(u, "2026-06-10");
    await completeDay(u, "2026-06-10", CHI);
    // June 11: nothing done; at 22:00 Chicago the member switches to Los Angeles (two hours behind).
    const r = await setJourneyTz(u, "America/Los_Angeles", at("2026-06-11 22:00", CHI));
    // The later midnight is Los Angeles's: until then the journey stays on Chicago time.
    expect(new Date(r.switch_at!).toISOString()).toBe(at("2026-06-12 00:00", "America/Los_Angeles"));
    // 23:30 in Los Angeles on June 11 is 01:30 June 12 in Chicago: it counts for June 12, not the missed June 11.
    const s = await checkIn(u, "reading", at("2026-06-11 23:30", "America/Los_Angeles"));
    expect(s.date).toBe("2026-06-12");
    await settle(j, at("2026-06-12 12:00", "America/Los_Angeles"));
    const a = await attempts(j);
    expect(a[0]).toMatchObject({ attempt_number: 1, status: "interrupted", interrupted_on: "2026-06-11", days_completed: 1 });
  });

  it("an offline check-in counts in the zone that applied when it was made", async () => {
    await setTz(u, CHI);
    const j = await enroll(u, "2026-06-20");
    await setJourneyTz(u, "Europe/Berlin", at("2026-06-20 09:00", CHI));
    await checkIn(u, "reading", at("2026-06-20 10:00", CHI));
    // Prayed offline at 23:50 Chicago on June 20 (before the switch); delivered after the switch, within the grace.
    const s = await checkIn(u, "prayer", at("2026-06-21 07:30", "Europe/Berlin"), at("2026-06-20 23:50", CHI));
    expect(s).toMatchObject({ date: "2026-06-20", source: "offline", reading: true, prayer: true });
    expect((await journeyRow(j)).pending_timezone).toBe("Europe/Berlin");
  });

  it("a pending change can be cancelled; unknown zones and full-day jumps are refused", async () => {
    await setTz(u, CHI);
    const j = await enroll(u, "2026-07-01");
    await setJourneyTz(u, "Europe/Berlin", at("2026-07-01 09:00", CHI));
    const r = await setJourneyTz(u, CHI, at("2026-07-01 10:00", CHI));
    expect(r).toMatchObject({ timezone: CHI, pending: null });
    expect(await journeyRow(j)).toMatchObject({ pending_timezone: null, timezone_switch_at: null });
    await expect(setJourneyTz(u, "Mars/Olympus_Mons", at("2026-07-01 10:00", CHI))).rejects.toThrow(/faith_invalid_timezone/);
    await svc.from("faith_journeys").update({ timezone: "Pacific/Kiritimati" }).eq("id", j);
    await expect(setJourneyTz(u, "Pacific/Pago_Pago", at("2026-07-02 09:00", "Pacific/Kiritimati"))).rejects.toThrow(/faith_timezone_jump/);
  });

  it("the member-facing change acts only on the caller's own journey", async () => {
    const other = await createTestUser("journey-tz-other");
    try {
      await setTz(other, CHI);
      const theirs = await enroll(other, "2026-07-10");
      const { error } = await u.client.rpc("faith_journey_set_timezone", { p_tz: "Europe/Berlin" });
      expect(error?.message ?? "").not.toMatch(/permission/);
      expect((await journeyRow(theirs)).pending_timezone).toBeNull();
      const direct = await u.client.rpc("faith_journey_set_timezone_at", { p_user: other.id, p_tz: "Europe/Berlin", p_now: new Date().toISOString() });
      expect(direct.error).toBeTruthy();
    } finally {
      await deleteTestUser(other);
    }
  });
});
