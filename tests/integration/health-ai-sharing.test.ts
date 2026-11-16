import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSleepSummary } from "@/server/coach/sleep-summary";
import { loadAthleteSnapshot } from "@/server/coach/snapshot";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Apple Health / Health Connect data and the AI provider (migration 079), on a synthetic member in the local database.
 * These read exactly what the coach assembles for the model (the standard context and the sleep summary tool) and
 * check that imported data is absent until the member turns on the separate permission, that typed-in data is not
 * affected, that the wearable's device name never appears, and that withdrawing either consent removes it again.
 */
const available = await stackAvailable();
const DAY = 86_400_000;
const DEVICE = "Jordan Reyes's Apple Watch";

describe.skipIf(!available)("health-platform data reaches the AI provider only with the separate permission", () => {
  const svc = serviceClient();
  let u: TestUser;
  const day = (back: number) => new Date(Date.now() - back * DAY).toISOString().slice(0, 10);
  const setConsents = async (ai: boolean, health: boolean) => {
    const now = new Date().toISOString();
    const { error } = await svc.from("profiles").update({ ai_data_consent_at: ai ? now : null, health_ai_share_consent_at: health ? now : null }).eq("id", u.id);
    if (error) throw error;
  };
  const context = async () => JSON.stringify(await loadAthleteSnapshot(u.client, u.id));
  const sleep = async () => JSON.stringify(await buildSleepSummary(u.client, u.id, "UTC", 14));

  beforeAll(async () => {
    u = await createTestUser("health-ai");
    await svc.from("profiles").update({ wellness_consent_at: new Date().toISOString(), timezone: "UTC" }).eq("id", u.id);
    // Steps: two typed in, two imported (distinct numbers so each can be looked for).
    const steps = [
      { user_id: u.id, day: day(0), steps: 4111, source: "manual" },
      { user_id: u.id, day: day(1), steps: 9222, source: "apple_health" },
      { user_id: u.id, day: day(2), steps: 5333, source: "manual" },
      { user_id: u.id, day: day(3), steps: 8444, source: "health_connect" },
    ];
    expect((await svc.from("daily_steps").insert(steps)).error).toBeNull();
    // Sleep: one night entered by hand; two recorded by a watch, with overnight measurements and a device name.
    const night = (back: number, extra: Record<string, unknown>) => {
      const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 6, 30) - back * DAY);
      const start = new Date(end.getTime() - 7.5 * 3_600_000);
      return { id: crypto.randomUUID(), user_id: u.id, started_at: start.toISOString(), ended_at: end.toISOString(), overlap_until: end.toISOString(), timezone: "UTC", night_of: end.toISOString().slice(0, 10), ...extra };
    };
    const watch = { source: "apple_health", device_name: DEVICE, hr_avg: 53, hr_min: 47, hr_max: 71, hr_samples: 400, hrv_avg_ms: 61.5, hrv_method: "sdnn", hrv_samples: 12, rr_avg: 14.2, rr_min: 12, rr_max: 17, rr_samples: 300 };
    const rows = [night(1, { source: "manual", kind: "night" }), night(2, { ...watch, kind: "night", source_id: `hk-${crypto.randomUUID()}` }), night(3, { ...watch, hrv_avg_ms: 58.5, kind: "night", source_id: `hk-${crypto.randomUUID()}` })];
    for (const row of rows) expect((await svc.from("sleep_sessions").insert(row)).error).toBeNull();
  });

  afterAll(async () => deleteTestUser(u));

  it("by default (AI consent on, health permission off): only typed-in steps; no imported night, measurement or device name", async () => {
    await setConsents(true, false);
    const ctx = await context();
    expect(ctx).toContain("4111");
    expect(ctx).toContain("5333");
    expect(ctx).not.toContain("9222");
    expect(ctx).not.toContain("8444");
    const s = await sleep();
    const parsed = JSON.parse(s) as Record<string, unknown>;
    expect(parsed.nights_logged).toBe(1);
    expect(parsed.health_platform_nights_not_shared).toBe(2);
    expect(parsed.recorded).toBeNull();
    for (const leaked of [DEVICE, "Jordan", "Apple Watch", "61.5", "58.5", "hrv_ms", "overnight_heart_rate_bpm", "breathing_per_min", "apple_health"]) {
      // (The rules text names HRV in general terms; the readings and field names must not appear.)
      if (leaked === "hrv_ms" || leaked === "overnight_heart_rate_bpm" || leaked === "breathing_per_min") expect(Object.keys((parsed.recorded as object | null) ?? {}), leaked).toEqual([]);
      else expect(s, leaked).not.toContain(leaked);
    }
  });

  it("with the separate permission on: imported steps and the watch's readings are included, and still no device name", async () => {
    await setConsents(true, true);
    const ctx = await context();
    for (const n of ["4111", "5333", "9222", "8444"]) expect(ctx).toContain(n);
    const s = await sleep();
    const parsed = JSON.parse(s) as { nights_logged: number; health_platform_nights_not_shared?: number; recorded: { nights_recorded: number; window: { hrv_ms_avg: number } } };
    expect(parsed.nights_logged).toBe(3);
    expect(parsed.health_platform_nights_not_shared).toBeUndefined();
    expect(parsed.recorded.nights_recorded).toBe(2);
    expect(parsed.recorded.window.hrv_ms_avg).toBe(60);
    for (const leaked of [DEVICE, "Jordan", "Apple Watch"]) expect(s, leaked).not.toContain(leaked);
    expect(ctx).not.toContain("Jordan Reyes's Apple Watch");
  });

  it("the health permission alone does nothing without the general AI consent", async () => {
    await setConsents(false, true);
    expect(await context()).not.toContain("9222");
    expect(JSON.parse(await sleep()).nights_logged).toBe(1);
  });

  it("turning the permission off, or withdrawing AI consent, removes imported data again at once", async () => {
    await setConsents(true, true);
    expect(await context()).toContain("9222");
    await setConsents(true, false);
    expect(await context()).not.toContain("9222");
    expect(JSON.parse(await sleep()).recorded).toBeNull();
  });

  it("a member can set the permission only on their own profile", async () => {
    const other = await createTestUser("health-ai-other");
    try {
      await other.client.from("profiles").update({ health_ai_share_consent_at: new Date().toISOString() }).eq("id", u.id);
      await setConsents(true, false);
      const before = (await svc.from("profiles").select("health_ai_share_consent_at").eq("id", u.id).single()).data;
      await other.client.from("profiles").update({ health_ai_share_consent_at: new Date().toISOString() }).eq("id", u.id);
      expect((await svc.from("profiles").select("health_ai_share_consent_at").eq("id", u.id).single()).data).toEqual(before);
      expect((await u.client.from("profiles").update({ health_ai_share_consent_at: new Date().toISOString() }).eq("id", u.id).select("id")).data?.length).toBe(1);
    } finally {
      await deleteTestUser(other);
    }
  });
});
