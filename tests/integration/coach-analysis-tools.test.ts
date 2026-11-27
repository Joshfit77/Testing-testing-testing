import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * The coach's analysis tools against the real database: analyze_lift_progress reads only the member's own logged sets
 * (RLS plus the user_id filter) and turns a seeded 10-week bench plateau into a `plateau` finding with evidence.
 */
describe.skipIf(!available)("coach analysis tools", async () => {
  const { executeCoachTool } = await import("@/server/coach/tools");
  const { loadAthleteSnapshot } = await import("@/server/coach/snapshot");

  let member: TestUser;
  let other: TestUser;
  const DAY = 86_400_000;

  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("analysis-member"), createTestUser("analysis-other")]);
    await Promise.all([grantPlan(member, "pro"), grantPlan(other, "pro")]);
    const admin = serviceClient();
    const { "bench-press": benchId } = await exerciseIds(["bench-press"]);
    expect(benchId).toBeTruthy();

    // 20 sessions over ~10 weeks, twice a week: 90 → 100 kg × 5 in the first five, then stuck at 100 kg for 15.
    const plan = Array.from({ length: 20 }, (_, i) => ({ daysAgo: Math.round(70 - i * 3.5), kg: [90, 92.5, 95, 97.5][i] ?? 100, reps: i < 5 ? 5 : 4 + (i % 2), rpe: i < 5 ? 8 : 9 }));
    const { data: sessions, error: sErr } = await admin
      .from("workout_sessions")
      .insert(
        plan.map((p) => {
          const start = Date.now() - p.daysAgo * DAY - 2 * 3_600_000;
          return { user_id: member.id, client_id: crypto.randomUUID(), name: "Bench day", status: "completed", started_at: new Date(start).toISOString(), ended_at: new Date(start + 3_600_000).toISOString() };
        }),
      )
      .select("id, started_at");
    expect(sErr).toBeNull();
    const ordered = [...sessions!].sort((a, b) => (a.started_at as string).localeCompare(b.started_at as string));
    const { data: wes, error: eErr } = await admin
      .from("workout_exercises")
      .insert(ordered.map((s) => ({ session_id: s.id, user_id: member.id, exercise_id: benchId, position: 0 })))
      .select("id, session_id");
    expect(eErr).toBeNull();
    const bySession = new Map(wes!.map((w) => [w.session_id as string, w.id as string]));
    const sets = ordered.flatMap((s, i) => {
      const p = plan[i]!;
      const we = bySession.get(s.id as string)!;
      return [
        { workout_exercise_id: we, user_id: member.id, set_number: 1, reps: 5, weight_kg: 60, completed: true, is_warmup: true },
        ...[2, 3, 4].map((n) => ({ workout_exercise_id: we, user_id: member.id, set_number: n, reps: p.reps, weight_kg: p.kg, rpe: p.rpe, completed: true, is_warmup: false })),
      ];
    });
    const { error: setErr } = await admin.from("workout_sets").insert(sets);
    expect(setErr).toBeNull();
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(member), deleteTestUser(other)]);
  });

  const ctxFor = async (u: TestUser, userId = u.id) => ({ supabase: u.client, userId, timeZone: "UTC", snapshot: await loadAthleteSnapshot(u.client, u.id), proposal: null });

  it("finds the bench plateau with evidence from the member's own sets", async () => {
    const out = await executeCoachTool(await ctxFor(member), "analyze_lift_progress", { exercise: "bench-press", weeks: 12 });
    expect(out.isError).toBe(false);
    expect(out.proposal).toBeUndefined();
    const a = JSON.parse(out.content);
    expect(a.slug).toBe("bench-press");
    expect(a.sessions_in_window).toBe(20);
    const plateau = a.findings.find((f: { id: string }) => f.id === "plateau");
    expect(plateau).toBeDefined();
    expect(plateau.evidence).toMatch(/Best e1RM (116\.7 kg|257\.2 lb) was set on \d{4}-\d\d-\d\d \(\d+ days ago\); 15 sessions since without beating it\./);
    expect(a.findings.map((f: { id: string }) => f.id)).not.toContain("progressing");
    // Warm-ups are left out: three working sets per session.
    expect(a.weekly.reduce((n: number, w: { hard_sets: number }) => n + w.hard_sets, 0)).toBe(60);
    expect(a.rpe.sets_with_rpe).toBe(60);
    expect(a.missing).toContain("no recovery check-ins in this window");
  });

  it("returns nothing of the member's to another member, even when asked for their id", async () => {
    for (const ctx of [await ctxFor(other), await ctxFor(other, member.id)]) {
      const out = await executeCoachTool(ctx, "analyze_lift_progress", { exercise: "bench-press", weeks: 12 });
      expect(out.isError).toBe(false);
      const a = JSON.parse(out.content);
      expect(a.sessions_in_window).toBe(0);
      expect(a.sessions_total).toBe(0);
      expect(a.findings.map((f: { id: string }) => f.id)).toEqual(["insufficient_data"]);
    }
    const load = JSON.parse((await executeCoachTool(await ctxFor(other, member.id), "get_recovery_summary", { days: 28 })).content);
    expect(load.training_load.sessions).toBe(0);
    expect(load.not_a_diagnosis).toBe(true);
  });

  it("runs the running and recovery summaries on real tables", async () => {
    const admin = serviceClient();
    const runAt = new Date(Date.now() - 2 * DAY).toISOString();
    expect((await admin.from("activities").insert({ user_id: member.id, kind: "run", source: "gps", started_at: runAt, distance_m: 5000, elapsed_s: 1600, moving_s: 1500 })).error).toBeNull();
    const running = JSON.parse((await executeCoachTool(await ctxFor(member), "get_running_summary", { weeks: null })).content);
    expect(running).toMatchObject({ runs_in_window: 1, sources: { gps: 1, treadmill: 0, manual: 0 }, days_since_last_run: 2 });
    expect(running.recent_runs[0]).toMatchObject({ source: "gps" });
    const recovery = JSON.parse((await executeCoachTool(await ctxFor(member), "get_recovery_summary", { days: 28 })).content);
    expect(recovery.not_a_diagnosis).toBe(true);
    expect(recovery.training_load.sessions).toBeGreaterThanOrEqual(7);
    expect(recovery.training_load.acute_chronic).not.toBeNull();
    expect(recovery.sleep.available).toBe(false);
  });
});
