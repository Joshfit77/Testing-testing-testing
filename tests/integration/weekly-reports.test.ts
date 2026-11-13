import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Weekly reports: built from the member's own records, created once per week (retries and concurrent requests never
 * duplicate), readable and deletable only by their owner, and written only by the server.
 */
describe.skipIf(!available)("weekly progress reports", () => {
  let pro: TestUser;
  let other: TestUser;
  const period = { weekStart: "2026-11-02", weekEnd: "2026-11-08" };

  beforeAll(async () => {
    [pro, other] = await Promise.all([createTestUser("report-pro"), createTestUser("report-other")]);
    await Promise.all([grantPlan(pro, "pro"), grantPlan(other, "pro")]);
    const admin = serviceClient();
    // Two workouts and a run inside the week, one workout the week after (must not count), food on two days.
    await admin.from("workout_sessions").insert([
      { user_id: pro.id, client_id: randomUUID(), name: "Upper", status: "completed", started_at: "2026-11-03T15:00:00Z", ended_at: "2026-11-03T16:00:00Z", total_volume_kg: 4200 },
      { user_id: pro.id, client_id: randomUUID(), name: "Lower", status: "completed", started_at: "2026-11-05T15:00:00Z", ended_at: "2026-11-05T16:00:00Z", total_volume_kg: 5800 },
      { user_id: pro.id, client_id: randomUUID(), name: "Next week", status: "completed", started_at: "2026-11-10T15:00:00Z", ended_at: "2026-11-10T16:00:00Z", total_volume_kg: 9999 },
    ]);
    const run = await admin.from("activities").insert({ user_id: pro.id, kind: "run", source: "manual", started_at: "2026-11-04T07:00:00Z", distance_m: 5000, moving_s: 1500, elapsed_s: 1500 });
    if (run.error) throw run.error;
    for (const [day, kcal] of [["2026-11-03", 2100], ["2026-11-04", 1900]] as const) {
      const { data: meal } = await admin.from("meals").insert({ user_id: pro.id, eaten_on: day, meal_type: "lunch" }).select("id").single();
      const item = await admin.from("meal_items").insert({ user_id: pro.id, meal_id: meal!.id, name: "Test food", calories: kcal, protein_g: 140, carbs_g: 200, fat_g: 60, servings: 1 });
      if (item.error) throw item.error;
    }
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(pro), deleteTestUser(other)]);
  });

  it("builds the report from the member's records, once, even when two requests race", async () => {
    const { ensureWeeklyReport } = await import("@/server/services/weekly-reports");
    const admin = serviceClient();
    const [a, b] = await Promise.all([ensureWeeklyReport(admin, pro.id, "pro", period, "UTC", 480), ensureWeeklyReport(admin, pro.id, "pro", period, "UTC", 480)]);
    expect(a.id).toBe(b.id);
    const again = await ensureWeeklyReport(admin, pro.id, "pro", period, "UTC", 480);
    expect(again.id).toBe(a.id);
    const { count } = await admin.from("weekly_reports").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    expect(count).toBe(1);

    expect(a.metrics.training).toMatchObject({ workouts: 2, volumeKg: 10000 });
    expect(a.metrics.running).toMatchObject({ runs: 1, distanceKm: 5, avgPaceSecPerKm: 300 });
    expect(a.metrics.nutrition).toMatchObject({ loggedDays: 2, avgCalories: 2000, coverage: "partial" });
    expect(a.metrics.sleep).toMatchObject({ nights: 0, coverage: "none" });
    // No AI consent: the written part is the rule-based summary, labelled as such. No AI usage was recorded.
    expect(a.analysis_source).toBe("rules");
    expect(a.analysis.recommendations).toHaveLength(3);
    const { count: aiCount } = await admin.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    expect(aiCount).toBe(0);
  });

  it("is private to its owner: others can't read, change or delete it; members can't create or rewrite reports", async () => {
    const { data: mine } = await pro.client.from("weekly_reports").select("id, week_start").eq("user_id", pro.id);
    expect(mine).toHaveLength(1);
    const id = mine![0]!.id as string;
    expect((await other.client.from("weekly_reports").select("id").eq("id", id)).data).toEqual([]);
    expect((await other.client.from("weekly_reports").delete({ count: "exact" }).eq("id", id)).count).toBe(0);
    expect((await other.client.from("weekly_reports").update({ read_at: new Date().toISOString() }).eq("id", id).select("id")).data ?? []).toEqual([]);
    // Members can't create a report (not even their own) or rewrite its contents; they may only mark it read.
    const fake = { user_id: other.id, week_start: "2026-10-26", time_zone: "UTC", metrics: {}, analysis: {}, analysis_source: "ai" };
    expect((await other.client.from("weekly_reports").insert(fake)).error).not.toBeNull();
    expect((await pro.client.from("weekly_reports").update({ analysis: { wentWell: ["planted"] } }).eq("id", id)).error).not.toBeNull();
    expect((await pro.client.from("weekly_reports").update({ read_at: new Date().toISOString() }).eq("id", id).select("id")).data).toHaveLength(1);
  });

  it("only Mondays can start a report week, and AI usage can be recorded as a weekly report", async () => {
    const admin = serviceClient();
    const bad = await admin.from("weekly_reports").insert({ user_id: other.id, week_start: "2026-11-03", time_zone: "UTC", metrics: {}, analysis: {}, analysis_source: "rules" });
    expect(bad.error).not.toBeNull();
    const usage = await admin.from("ai_usage_events").insert({ user_id: other.id, kind: "weekly_report", model_tier: "fast" }).select("id").single();
    expect(usage.error).toBeNull();
    await admin.from("ai_usage_events").delete().eq("id", usage.data!.id);
  });

  it("the member can delete their report; their workouts and food are untouched", async () => {
    const admin = serviceClient();
    expect((await pro.client.from("weekly_reports").delete({ count: "exact" }).eq("user_id", pro.id)).count).toBe(1);
    const { count } = await admin.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    expect(count).toBe(3);
  });

  it("the scheduled job creates reports only for Pro members and is safe to re-run", async () => {
    const free = await createTestUser("report-free");
    try {
      const { runWeeklyReportJob } = await import("@/server/services/weekly-reports");
      // Monday 2026-11-09 12:00 UTC: the week of Nov 2 is due everywhere.
      const now = new Date("2026-11-09T12:00:00Z");
      await runWeeklyReportJob(now, 5000);
      await runWeeklyReportJob(now, 5000);
      const admin = serviceClient();
      const counts = await Promise.all([pro, other, free].map((u) => admin.from("weekly_reports").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("week_start", period.weekStart)));
      expect(counts.map((c) => c.count)).toEqual([1, 1, 0]);
    } finally {
      await deleteTestUser(free);
    }
  });
});
