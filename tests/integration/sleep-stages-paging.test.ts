import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listSleepStages } from "@/server/services/sleep";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Audit 2026-11-14: Sleep history adds up the stage mix of up to 30 recorded nights in one request, and the API
 * returns at most 1,000 rows. A watch that writes 40 stage intervals a night passes that at 26 nights, so the newest
 * nights' stages were silently left out of the mix.
 */
describe.skipIf(!available)("stage intervals of 30 recorded nights (more than 1,000 rows)", () => {
  let user: TestUser;
  const NIGHTS = 30;
  const PER_NIGHT = 40;
  const ids: string[] = [];

  beforeAll(async () => {
    user = await createTestUser("stage-paging");
    const consent = await user.client.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", user.id);
    if (consent.error) throw consent.error;
    const first = Date.UTC(2026, 8, 1, 22, 0, 0); // 10 PM UTC on 1 September
    const sessions = Array.from({ length: NIGHTS }, (_, n) => {
      const start = first + n * 86_400_000;
      const id = crypto.randomUUID();
      ids.push(id);
      return {
        id,
        user_id: user.id,
        kind: "night",
        started_at: new Date(start).toISOString(),
        ended_at: new Date(start + 8 * 3600_000).toISOString(),
        timezone: "UTC",
        night_of: new Date(start + 8 * 3600_000).toISOString().slice(0, 10),
        source: "apple_health",
        source_id: `p:night-${n}`,
      };
    });
    const sErr = (await user.client.from("sleep_sessions").insert(sessions)).error;
    if (sErr) throw sErr;
    // 40 intervals of 12 minutes fill each 8-hour night: light, deep, light, REM, repeated.
    const kinds = ["light", "deep", "light", "rem"];
    const stages = sessions.flatMap((s) =>
      Array.from({ length: PER_NIGHT }, (_, i) => {
        const a = Date.parse(s.started_at) + i * 12 * 60_000;
        return { session_id: s.id, user_id: user.id, stage: kinds[i % 4]!, started_at: new Date(a).toISOString(), ended_at: new Date(a + 12 * 60_000).toISOString() };
      }),
    );
    for (let i = 0; i < stages.length; i += 400) {
      const { error } = await user.client.from("sleep_stages").insert(stages.slice(i, i + 400));
      if (error) throw error;
    }
  }, 120_000);

  afterAll(async () => {
    await deleteTestUser(user);
  });

  it("returns every interval of every night, in time order", async () => {
    const rows = await listSleepStages(user.client, user.id, ids);
    expect(rows).toHaveLength(NIGHTS * PER_NIGHT);
    expect(new Set(rows.map((r) => r.session_id)).size).toBe(NIGHTS);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.started_at >= rows[i - 1]!.started_at).toBe(true);
    // By hand: 30 nights × 8 h = 240 h; deep and REM are a quarter each (60 h), light a half (120 h).
    const minutes = (stage: string) => rows.filter((r) => r.stage === stage).reduce((m, r) => m + (Date.parse(r.ended_at) - Date.parse(r.started_at)) / 60_000, 0);
    expect(minutes("deep")).toBe(60 * 60);
    expect(minutes("rem")).toBe(60 * 60);
    expect(minutes("light")).toBe(120 * 60);
  });

  it("the database lets the owner replace an imported night with a fuller record of it (times, id, stages), and still refuses an overlap", async () => {
    // What importSleepAction does when a night imported at 3 AM is read again in the morning.
    const start = Date.UTC(2026, 10, 1, 23, 0, 0);
    const id = crypto.randomUUID();
    const iso = (h: number) => new Date(start + h * 3600_000).toISOString();
    expect((await user.client.from("sleep_sessions").insert({ id, user_id: user.id, kind: "night", started_at: iso(0), ended_at: iso(4), timezone: "UTC", night_of: "2026-11-02", source: "apple_health", source_id: "p:partial" })).error).toBeNull();
    expect((await user.client.from("sleep_stages").insert([{ session_id: id, user_id: user.id, stage: "light", started_at: iso(0), ended_at: iso(4) }])).error).toBeNull();

    const grown = await user.client.from("sleep_sessions").update({ ended_at: iso(8), final_wake_at: iso(7.5), awake_minutes: 15, awakenings: 2, source_id: "p:full" }).eq("id", id).eq("user_id", user.id).eq("source", "apple_health").select("id, ended_at, source_id");
    expect(grown.error).toBeNull();
    expect(grown.data).toHaveLength(1);
    expect(Date.parse(grown.data![0]!.ended_at as string)).toBe(start + 8 * 3600_000);
    expect((await user.client.from("sleep_stages").delete().eq("session_id", id).eq("user_id", user.id)).error).toBeNull();
    expect((await user.client.from("sleep_stages").insert([{ session_id: id, user_id: user.id, stage: "deep", started_at: iso(0), ended_at: iso(2) }, { session_id: id, user_id: user.id, stage: "rem", started_at: iso(2), ended_at: iso(7.5) }])).error).toBeNull();
    expect((await listSleepStages(user.client, user.id, [id])).map((r) => r.stage)).toEqual(["deep", "rem"]);

    // Growing into another stored session is refused by the exclusion constraint (the action then leaves the night alone).
    const nap = await user.client.from("sleep_sessions").insert({ id: crypto.randomUUID(), user_id: user.id, kind: "nap", started_at: iso(9), ended_at: iso(9.5), timezone: "UTC", night_of: "2026-11-02", source: "manual" });
    expect(nap.error).toBeNull();
    const clash = await user.client.from("sleep_sessions").update({ ended_at: iso(9.25) }).eq("id", id).eq("user_id", user.id);
    expect(clash.error?.code).toBe("23P01");
  });
});
