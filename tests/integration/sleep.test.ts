import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Sleep sessions in the database: wellness consent to add, owner-only everything, no overlaps, imports unique per source. */
describe.skipIf(!available)("sleep sessions: consent, isolation, overlap and import rules", () => {
  let owner: TestUser;
  let other: TestUser;
  let admin: TestUser;
  const consent = (u: TestUser, on = true) => u.client.from("profiles").update({ wellness_consent_at: on ? new Date().toISOString() : null }).eq("id", u.id);
  const night = (u: TestUser, over: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    user_id: u.id,
    kind: "night",
    started_at: "2026-10-22T22:30:00Z",
    ended_at: "2026-10-23T06:00:00Z",
    timezone: "Europe/London",
    night_of: "2026-10-23",
    source: "manual",
    ...over,
  });

  beforeAll(async () => {
    [owner, other, admin] = await Promise.all([createTestUser("sleep-owner"), createTestUser("sleep-other"), createTestUser("sleep-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(owner), deleteTestUser(other), deleteTestUser(admin)]);
  });

  it("refuses sessions before wellness consent, then accepts them", async () => {
    expect((await owner.client.from("sleep_sessions").insert(night(owner))).error).not.toBeNull();
    expect((await consent(owner)).error).toBeNull();
    const row = night(owner);
    expect((await owner.client.from("sleep_sessions").insert(row)).error).toBeNull();
    const { data } = await owner.client.from("sleep_sessions").select("id, night_of, source").eq("id", row.id).single();
    expect(data).toMatchObject({ id: row.id, night_of: "2026-10-23", source: "manual" });
  });

  it("is invisible to other members and to admins, who can't insert into the owner's account either", async () => {
    const { data: mine } = await owner.client.from("sleep_sessions").select("id").eq("user_id", owner.id);
    expect(mine?.length).toBe(1);
    for (const u of [other, admin]) {
      expect((await u.client.from("sleep_sessions").select("id").eq("user_id", owner.id)).data).toEqual([]);
      await consent(u);
      expect((await u.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-10-01T22:00:00Z", ended_at: "2026-10-02T06:00:00Z", night_of: "2026-10-02" }))).error).not.toBeNull();
    }
  });

  it("refuses an overlapping session but allows a back-to-back one", async () => {
    const overlap = night(owner, { started_at: "2026-10-23T05:00:00Z", ended_at: "2026-10-23T07:00:00Z" });
    const { error } = await owner.client.from("sleep_sessions").insert(overlap);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23P01");
    const adjacent = night(owner, { kind: "nap", started_at: "2026-10-23T06:00:00Z", ended_at: "2026-10-23T06:30:00Z" });
    expect((await owner.client.from("sleep_sessions").insert(adjacent)).error).toBeNull();
  });

  it("treats a running timer as 20 hours for overlap and allows only one", async () => {
    const running = night(owner, { source: "timer", started_at: "2026-11-01T22:00:00Z", ended_at: null, night_of: "2026-11-02" });
    expect((await owner.client.from("sleep_sessions").insert(running)).error).toBeNull();
    const during = night(owner, { started_at: "2026-11-02T10:00:00Z", ended_at: "2026-11-02T11:00:00Z", night_of: "2026-11-02" });
    expect((await owner.client.from("sleep_sessions").insert(during)).error?.code).toBe("23P01");
    expect((await owner.client.from("sleep_sessions").update({ ended_at: "2026-11-02T06:00:00Z" }).eq("id", running.id)).error).toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(during)).error).toBeNull();
  });

  it("checks the night's internal order and the limits", async () => {
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-09-01T22:00:00Z", ended_at: "2026-09-01T21:00:00Z", night_of: "2026-09-01" }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-09-01T22:00:00Z", ended_at: "2026-09-03T06:00:00Z", night_of: "2026-09-03" }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-09-05T22:00:00Z", ended_at: "2026-09-06T06:00:00Z", night_of: "2026-09-06", onset_at: "2026-09-05T21:00:00Z" }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-09-05T22:00:00Z", ended_at: "2026-09-06T06:00:00Z", night_of: "2026-09-06", awakenings: 99 }))).error).not.toBeNull();
  });

  it("requires a source id for imports and none for the app's own entries, and never imports the same record twice", async () => {
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-09-10T22:00:00Z", ended_at: "2026-09-11T06:00:00Z", night_of: "2026-09-11", source_id: "x" }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-09-10T22:00:00Z", ended_at: "2026-09-11T06:00:00Z", night_of: "2026-09-11", source: "apple_health" }))).error).not.toBeNull();
    const imported = night(owner, { started_at: "2026-09-10T22:00:00Z", ended_at: "2026-09-11T06:00:00Z", night_of: "2026-09-11", source: "apple_health", source_id: "hk-1" });
    expect((await owner.client.from("sleep_sessions").insert(imported)).error).toBeNull();
    const again = night(owner, { started_at: "2026-09-12T22:00:00Z", ended_at: "2026-09-13T06:00:00Z", night_of: "2026-09-13", source: "apple_health", source_id: "hk-1" });
    expect((await owner.client.from("sleep_sessions").insert(again)).error?.code).toBe("23505");

    // Stages belong only to imported sessions of the owner.
    const manual = (await owner.client.from("sleep_sessions").select("id").eq("user_id", owner.id).eq("source", "manual").limit(1).single()).data!;
    const stage = (session: string, user: string) => ({ session_id: session, user_id: user, stage: "deep", started_at: "2026-09-10T23:00:00Z", ended_at: "2026-09-11T00:00:00Z" });
    expect((await owner.client.from("sleep_stages").insert(stage(manual.id as string, owner.id))).error).not.toBeNull();
    expect((await owner.client.from("sleep_stages").insert(stage(imported.id, owner.id))).error).toBeNull();
    expect((await other.client.from("sleep_stages").insert(stage(imported.id, other.id))).error).not.toBeNull();
    expect((await other.client.from("sleep_stages").select("id").eq("session_id", imported.id)).data).toEqual([]);
  });

  it("keeps overnight measurements and the device name on imported rows only, inside plausible ranges", async () => {
    const base = { started_at: "2026-08-01T22:00:00Z", ended_at: "2026-08-02T06:00:00Z", night_of: "2026-08-02" };
    const vitals = { device_name: "Apple Watch", hr_avg: 54, hr_min: 47, hr_max: 71, hr_samples: 410, hrv_avg_ms: 38.5, hrv_method: "sdnn", hrv_samples: 6, rr_avg: 14.2, rr_min: 12.5, rr_max: 16.0, rr_samples: 95 };
    // A hand-entered night can't carry measurements: the app measures nothing itself.
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { ...base, ...vitals }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { ...base, device_name: "Apple Watch" }))).error).not.toBeNull();
    // Imported rows keep them, with the shape checks: min ≤ avg ≤ max, a method with every HRV figure, nothing absurd.
    const row = night(owner, { ...base, source: "apple_health", source_id: "hk-vitals", ...vitals });
    expect((await owner.client.from("sleep_sessions").insert(row)).error).toBeNull();
    const stored = (await owner.client.from("sleep_sessions").select("hr_avg, hrv_avg_ms, hrv_method, rr_avg, device_name").eq("id", row.id).single()).data;
    expect(stored).toEqual({ hr_avg: 54, hrv_avg_ms: 38.5, hrv_method: "sdnn", rr_avg: 14.2, device_name: "Apple Watch" });
    const bad = (over: Record<string, unknown>) => night(owner, { ...base, started_at: "2026-08-03T22:00:00Z", ended_at: "2026-08-04T06:00:00Z", night_of: "2026-08-04", source: "apple_health", source_id: `hk-bad-${JSON.stringify(over)}`, ...vitals, ...over });
    expect((await owner.client.from("sleep_sessions").insert(bad({ hr_min: 80 }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(bad({ hr_avg: 300 }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(bad({ hrv_method: null }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(bad({ hrv_method: "pnn50" }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(bad({ rr_avg: 70 }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(bad({ hr_samples: 0 }))).error).not.toBeNull();
    // A series the device didn't record is simply absent.
    expect((await owner.client.from("sleep_sessions").insert(bad({ rr_avg: null, rr_min: null, rr_max: null, rr_samples: null }))).error).toBeNull();
  });

  it("keeps viewing and deleting after consent is withdrawn, but not adding or editing", async () => {
    expect((await consent(owner, false)).error).toBeNull();
    const { data } = await owner.client.from("sleep_sessions").select("id").eq("user_id", owner.id);
    expect(data?.length).toBeGreaterThan(0);
    const id = data![0]!.id as string;
    // The row is visible (USING passes) but the edit fails the policy's WITH CHECK, which Postgres reports as an error.
    expect((await owner.client.from("sleep_sessions").update({ notes: "edited" }).eq("id", id).select("id")).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").select("notes").eq("id", id).single()).data?.notes).toBeNull();
    expect((await owner.client.from("sleep_sessions").insert(night(owner, { started_at: "2026-08-01T22:00:00Z", ended_at: "2026-08-02T06:00:00Z", night_of: "2026-08-02" }))).error).not.toBeNull();
    expect((await owner.client.from("sleep_sessions").delete().eq("id", id).select("id")).data).toEqual([{ id }]);
  });

  it("can't be read or changed anonymously", async () => {
    const { anonClient } = await import("./helpers");
    const anon = anonClient();
    expect((await anon.from("sleep_sessions").select("id")).data).toEqual([]);
    expect((await anon.from("sleep_sessions").insert(night(owner))).error).not.toBeNull();
  });
});
