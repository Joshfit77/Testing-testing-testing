import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { finishWorkout, saveDraftSnapshot, discardDraft, deleteWorkout } from "@/server/services/workouts";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * First-workout activation events (migration 051): written by the database from the workouts the server stores,
 * once per workout, readable only by their member, never writable from a client, and summarised for admins only.
 */
const available = await stackAvailable();

describe.skipIf(!available)("activation events", () => {
  let member: TestUser;
  let other: TestUser;
  let admin: TestUser;
  let squat: string;
  const svc = serviceClient();
  const since = new Date(Date.now() - 60_000).toISOString();

  const events = async (u: TestUser) =>
    (await svc.from("activation_events").select("event, workout_client_id, source").eq("user_id", u.id).order("id")).data ?? [];

  const draft = (clientId: string, completed: boolean[]) => ({
    clientId,
    name: "Full body A",
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    userProgramId: null,
    programDayId: null,
    draft: { version: 2, clientId, exercises: [{ id: "k1", exerciseId: squat, sets: completed.map((c) => ({ id: crypto.randomUUID(), reps: 8, weightKg: null, completed: c })) }] },
  });

  const finish = (u: TestUser, clientId: string) =>
    finishWorkout(u.client, u.id, {
      clientId,
      name: "Full body A",
      userProgramId: null,
      programDayId: null,
      startedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      endedAt: new Date().toISOString(),
      pausedSeconds: 0,
      notes: "",
      exercises: [
        {
          exerciseId: squat,
          substitutedFromId: null,
          notes: "",
          skipped: false,
          skipReason: null,
          sets: [{ reps: 8, weightKg: null, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, completed: true }],
        },
      ],
    });

  beforeAll(async () => {
    [member, other, admin] = await Promise.all([createTestUser("activation-member"), createTestUser("activation-other"), createTestUser("activation-admin")]);
    await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    squat = (await exerciseIds(["goblet-squat"]))["goblet-squat"]!;
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(member), deleteTestUser(other), deleteTestUser(admin)]);
  });

  it("a synced workout: started once, first completed set once, completed once — no duplicates from repeated saves", async () => {
    const id = crypto.randomUUID();
    await saveDraftSnapshot(member.client, member.id, draft(id, [false, false]));
    await saveDraftSnapshot(member.client, member.id, draft(id, [false, false]));
    expect(await events(member)).toEqual([{ event: "workout_started", workout_client_id: id, source: "sync" }]);

    await saveDraftSnapshot(member.client, member.id, draft(id, [true, false]));
    await saveDraftSnapshot(member.client, member.id, draft(id, [true, true]));
    await finish(member, id);
    await finish(member, id); // a retried finish
    expect(await events(member)).toEqual([
      { event: "workout_started", workout_client_id: id, source: "sync" },
      { event: "set_completed", workout_client_id: id, source: "sync" },
      { event: "workout_completed", workout_client_id: id, source: "finish" },
    ]);
  });

  it("a workout logged entirely offline: recorded at the finish", async () => {
    const id = crypto.randomUUID();
    await finish(other, id);
    expect(await events(other)).toEqual([
      { event: "workout_started", workout_client_id: id, source: "finish" },
      { event: "set_completed", workout_client_id: id, source: "finish" },
      { event: "workout_completed", workout_client_id: id, source: "finish" },
    ]);
  });

  it("discarding an in-progress workout is abandonment; deleting a finished one from history is not", async () => {
    const left = crypto.randomUUID();
    await saveDraftSnapshot(member.client, member.id, draft(left, [true]));
    await discardDraft(member.client, member.id, left);
    const done = (await svc.from("workout_sessions").select("id, client_id").eq("user_id", member.id).eq("status", "completed").single()).data!;
    await deleteWorkout(member.client, member.id, done.id as string);
    const rows = await events(member);
    expect(rows.filter((r) => r.event === "workout_abandoned")).toEqual([{ event: "workout_abandoned", workout_client_id: left, source: "discard" }]);
    // The finished workout's events stay (the member did train that day).
    expect(rows.filter((r) => r.workout_client_id === done.client_id).map((r) => r.event)).toEqual(["workout_started", "set_completed", "workout_completed"]);
  });

  it("members read only their own events and cannot write, change or delete any", async () => {
    const mine = await member.client.from("activation_events").select("user_id");
    expect(mine.error).toBeNull();
    expect(new Set(mine.data!.map((r) => r.user_id))).toEqual(new Set([member.id]));
    expect((await member.client.from("activation_events").select("id").eq("user_id", other.id)).data).toEqual([]);

    const planted = await member.client.from("activation_events").insert({ user_id: member.id, event: "workout_completed", workout_client_id: crypto.randomUUID(), occurred_at: new Date().toISOString(), source: "sync" });
    expect(planted.error?.code).toBe("42501");
    const before = (await events(member)).length;
    await member.client.from("activation_events").update({ source: "backfill" }).eq("user_id", member.id);
    await member.client.from("activation_events").delete().eq("user_id", member.id);
    const after = await events(member);
    expect(after.length).toBe(before);
    expect(after.some((r) => r.source === "backfill")).toBe(false);
    // The recording function itself is not callable from a client.
    const rpc = await member.client.rpc("activation_record", { p_user: member.id, p_event: "workout_completed", p_client: crypto.randomUUID(), p_at: new Date().toISOString(), p_source: "sync" });
    expect(rpc.error).not.toBeNull();
  });

  it("the cohort summary is for admins only, and counts these new members", async () => {
    const denied = await member.client.rpc("admin_activation_metrics", { p_from: since });
    expect(denied.error?.code).toBe("42501");

    const { data, error } = await admin.client.rpc("admin_activation_metrics", { p_from: since });
    expect(error).toBeNull();
    const m = data as { new_members: Record<string, number>; abandonment: Record<string, number>; median_minutes: Record<string, number | null>; return_activity: Record<string, { eligible: number; returned: number }> };
    // Other test files may create accounts at the same time, so these are lower bounds.
    expect(m.new_members.accounts).toBeGreaterThanOrEqual(3);
    expect(m.new_members.started_first_workout).toBeGreaterThanOrEqual(2);
    expect(m.new_members.completed_first_set).toBeGreaterThanOrEqual(2);
    expect(m.new_members.completed_first_workout).toBeGreaterThanOrEqual(2);
    expect(m.abandonment.discarded).toBeGreaterThanOrEqual(1);
    expect(m.median_minutes.signup_to_first_set).not.toBeNull();
    // Nobody in a one-minute-old cohort has had a day 1 yet.
    expect(m.return_activity.day1!.eligible).toBe(0);
  });

  it("deleting an account with a workout in progress removes its events and records no abandonment", async () => {
    const leaving = await createTestUser("activation-leaving");
    await saveDraftSnapshot(leaving.client, leaving.id, draft(crypto.randomUUID(), [true]));
    expect((await events(leaving)).length).toBe(2);
    const { error } = await svc.auth.admin.deleteUser(leaving.id);
    expect(error).toBeNull();
    expect(await events(leaving)).toEqual([]);
  });
});
