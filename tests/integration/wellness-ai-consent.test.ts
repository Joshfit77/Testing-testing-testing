import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Recovery check-ins (readiness, energy, soreness, stress, sleep quality) are optional wellness data. They reach the AI
 * provider only while the member has allowed wellness data on top of the AI consent, whatever the model asks for: the
 * athlete context, get_recovery_summary, analyze_lift_progress and get_training_review all leave them out otherwise, and
 * say why. The check-in rows here are inserted directly, as an older row or a failed delete would leave them.
 */
describe.skipIf(!available)("wellness consent gates check-ins for the AI coach", async () => {
  const { executeCoachTool } = await import("@/server/coach/tools");
  const { loadAthleteSnapshot } = await import("@/server/coach/snapshot");
  const { formatAthleteContext } = await import("@/lib/coach/context");

  let member: TestUser;
  const now = new Date().toISOString();
  const DAY = 86_400_000;
  // Distinctive values that would be easy to spot in a payload.
  const checkins = (userId: string) =>
    [1, 2, 3, 4, 5, 6].map((d) => ({
      user_id: userId,
      checked_on: new Date(Date.now() - d * DAY).toISOString().slice(0, 10),
      sleep_quality: 2,
      energy: 2,
      soreness: 5,
      stress: 5,
      readiness_score: 17,
    }));

  const setConsent = async (wellness: boolean) => {
    const { error } = await serviceClient()
      .from("profiles")
      .update({ ai_data_consent_at: now, wellness_consent_at: wellness ? now : null })
      .eq("id", member.id);
    expect(error).toBeNull();
  };
  const ctx = async () => ({ supabase: member.client, userId: member.id, timeZone: "UTC", snapshot: await loadAthleteSnapshot(member.client, member.id), proposal: null });

  beforeAll(async () => {
    member = await createTestUser("wellness-gate");
    await grantPlan(member, "pro");
    const { error } = await serviceClient().from("recovery_checkins").insert(checkins(member.id));
    expect(error).toBeNull();
  });
  afterAll(async () => {
    await deleteTestUser(member);
  });

  it("without wellness consent: no check-in reaches the context or any tool, and the coach is told why", async () => {
    await setConsent(false);
    const c = await ctx();
    expect(c.snapshot.readiness).toBeNull();
    expect(c.snapshot.wellnessShared).toBe(false);
    const contextText = formatAthleteContext(c.snapshot);
    expect(contextText).not.toMatch(/readiness check-in/i);
    expect(contextText).toMatch(/Optional wellness data: not shared/);

    const recovery = await executeCoachTool(c, "get_recovery_summary", { days: 14 });
    expect(recovery.isError).toBe(false);
    const r = JSON.parse(recovery.content);
    expect(r.checkins).toBeNull();
    expect(r.wellness_data).toMatch(/hasn't allowed optional wellness data/);

    const review = await executeCoachTool(c, "get_training_review", {});
    expect(review.isError).toBe(false);
    expect(JSON.parse(review.content).wellness_data).toMatch(/hasn't allowed optional wellness data/);

    // Nothing that identifies a check-in value appears in any of these outputs.
    for (const out of [recovery.content, review.content]) {
      expect(out).not.toMatch(/"readiness(_avg)?"\s*:\s*17\b/);
      expect(out).not.toMatch(/"soreness(_avg)?"\s*:\s*5\b/);
    }
  });

  it("with wellness consent: the same check-ins are used", async () => {
    await setConsent(true);
    const c = await ctx();
    expect(c.snapshot.readiness?.score).toBe(17);
    expect(c.snapshot.wellnessShared).toBe(true);
    const r = JSON.parse((await executeCoachTool(c, "get_recovery_summary", { days: 14 })).content);
    expect(r.checkins).not.toBeNull();
    expect(r.wellness_data).toBeUndefined();
  });

  it("the AI consent alone is not enough", async () => {
    await serviceClient().from("profiles").update({ ai_data_consent_at: null, wellness_consent_at: now }).eq("id", member.id);
    const c = await ctx();
    expect(c.snapshot.readiness).toBeNull();
    expect(c.snapshot.wellnessShared).toBe(false);
  });
});
