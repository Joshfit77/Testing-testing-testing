import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Missed program sessions: detected from real history, and skipped only on the member's request. */
describe.skipIf(!available)("missed-session rescheduling", async () => {
  const { loadProgramSchedule, skipMissedSessions } = await import("@/server/services/schedule");
  const svc = serviceClient();
  let member: TestUser;
  let other: TestUser;
  let userProgramId: string;

  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("missed"), createTestUser("missed-other")]);
    await grantPlan(member, "pro");
    const { data: prog } = await svc.from("training_programs").select("id, days_per_week").eq("is_published", true).eq("days_per_week", 3).gte("duration_weeks", 4).limit(1).single();
    const { data: up } = await svc.from("user_programs").insert({ user_id: member.id, program_id: prog!.id, status: "active", started_at: new Date(Date.now() - 20 * 86_400_000).toISOString() }).select("id").single();
    userProgramId = up!.id;
    // The last program workout was four days ago: at least one session has come and gone since.
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000);
    await svc.from("workout_sessions").insert({ user_id: member.id, client_id: crypto.randomUUID(), name: "Earlier session", status: "completed", user_program_id: userProgramId, started_at: fourDaysAgo.toISOString(), ended_at: new Date(fourDaysAgo.getTime() + 3_600_000).toISOString() });
  });
  afterAll(async () => Promise.all([deleteTestUser(member), deleteTestUser(other)]));

  it("finds the sessions missed since the last workout without changing anything", async () => {
    const schedule = (await loadProgramSchedule(member.client, member.id, "UTC"))!;
    expect(schedule.missed.missed.length).toBeGreaterThanOrEqual(1);
    expect(schedule.missed.missed.length).toBeLessThanOrEqual(2);
    expect(schedule.missed.canSkip).toBe(true);
    // The calendar still offers the first missed session today; nothing is written by looking.
    expect(schedule.planned[0]!.dayId).toBe(schedule.missed.missed[0]!.dayId);
    expect((await svc.from("user_programs").select("current_week, current_day").eq("id", userProgramId).single()).data).toEqual({ current_week: 1, current_day: 1 });
  });

  it("refuses a stale request, then skips exactly what the member saw, keeping history", async () => {
    const before = (await loadProgramSchedule(member.client, member.id, "UTC"))!;
    const wrong = before.planned.find((p) => p.dayId !== before.missed.missed[0]!.dayId)!.dayId;
    expect(await skipMissedSessions(member.client, member.id, "UTC", wrong)).toMatchObject({ ok: false });

    const r = await skipMissedSessions(member.client, member.id, "UTC", before.missed.missed[0]!.dayId);
    expect(r).toMatchObject({ ok: true, skipped: before.missed.missed.length, resumeName: before.missed.resumeAt!.name });
    const after = (await loadProgramSchedule(member.client, member.id, "UTC"))!;
    expect(after.missed.missed).toEqual([]);
    expect(after.planned[0]!.dayId).toBe(before.missed.resumeAt!.dayId);
    expect((await svc.from("user_programs").select("current_week, current_day").eq("id", userProgramId).single()).data).toEqual({
      current_week: before.missed.resumeAt!.week,
      current_day: before.missed.resumeAt!.day,
    });
    const { count } = await svc.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", member.id);
    expect(count).toBe(1);

    // Sending it again does nothing.
    expect(await skipMissedSessions(member.client, member.id, "UTC", before.missed.missed[0]!.dayId)).toMatchObject({ ok: false });
  });

  it("another member can't touch it", async () => {
    expect(await skipMissedSessions(other.client, other.id, "UTC", crypto.randomUUID())).toMatchObject({ ok: false });
    const res = await other.client.from("user_programs").update({ current_week: 3 }).eq("id", userProgramId).select("id");
    expect(res.data ?? []).toEqual([]);
  });
});
