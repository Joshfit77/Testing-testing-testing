import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

/**
 * F-29 / F-30 (security assessment 2026-11-20) against the real database: two devices working on workouts at once.
 *  - A backup must name the revision it was built on; an older copy never replaces a newer one (the server answers with
 *    its copy instead), two simultaneous backups on the same revision can't both land, and a finished or discarded
 *    workout is never brought back.
 *  - Every unfinished workout stays on the account (none replaces another).
 *  - Finish on an older copy is refused (combine first); a second Finish of a saved workout adds its sets set by set,
 *    keeping the sets only the first Finish had.
 */
const available = await stackAvailable();

describe.skipIf(!available)("workout revisions: two devices at once", async () => {
  const { saveDraftSnapshot, getServerDrafts, finishWorkout, discardDraft, DraftConflictError } = await import("@/server/services/workouts");
  let user: TestUser;
  let ex: Record<string, string>;
  const startedAt = "2026-11-21T09:00:00Z";
  const snap = (clientId: string, marker: string, baseRev: number | null | undefined) => ({
    clientId,
    name: "Two devices",
    startedAt,
    userProgramId: null,
    programDayId: null,
    draft: { version: 2, marker },
    baseRev,
  });
  const set = (w: number, completed = true) => ({ reps: 5, weightKg: w, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, isDrop: false, completed });
  const finishInput = (clientId: string, exercises: FinishWorkoutInput["exercises"], baseRev?: number | null): FinishWorkoutInput => ({
    clientId,
    name: "Two devices",
    userProgramId: null,
    programDayId: null,
    startedAt,
    endedAt: "2026-11-21T10:00:00Z",
    pausedSeconds: 0,
    notes: "",
    exercises,
    ...(baseRev === undefined ? {} : { baseRev }),
  });
  const savedSets = async (clientId: string) => {
    const { data } = await user.client
      .from("workout_sessions")
      .select("workout_exercises(position, exercise_id, workout_sets(set_number, weight_kg, completed))")
      .eq("client_id", clientId)
      .single();
    type Row = { position: number; exercise_id: string; workout_sets: { set_number: number; weight_kg: number; completed: boolean }[] };
    return ((data?.workout_exercises ?? []) as Row[])
      .sort((a, b) => a.position - b.position)
      .map((e) => [...e.workout_sets].sort((a, b) => a.set_number - b.set_number).filter((s) => s.completed).map((s) => Number(s.weight_kg)));
  };

  beforeAll(async () => {
    user = await createTestUser("revisions");
    ex = await exerciseIds(["back-squat", "bench-press"]);
  });
  afterAll(async () => {
    await user.client.from("workout_sessions").delete().eq("user_id", user.id);
    await deleteTestUser(user);
  });

  it("an older copy never replaces a newer one: the server answers with its copy and revision", async () => {
    const id = crypto.randomUUID();
    expect(await saveDraftSnapshot(user.client, user.id, snap(id, "phone-1", null))).toEqual({ status: "saved", rev: 1 });
    // The tablet picked it up at revision 1 and saved its sets: revision 2.
    expect(await saveDraftSnapshot(user.client, user.id, snap(id, "tablet-2", 1))).toEqual({ status: "saved", rev: 2 });
    // The phone, still on revision 1, sends its next copy: refused, with the tablet's copy to combine.
    expect(await saveDraftSnapshot(user.client, user.id, snap(id, "phone-2", 1))).toEqual({ status: "conflict", rev: 2, draft: { version: 2, marker: "tablet-2" } });
    // A device that never had the account's copy (no revision) can't overwrite it either.
    expect(await saveDraftSnapshot(user.client, user.id, snap(id, "stranger", null))).toMatchObject({ status: "conflict", rev: 2 });
    // The combined copy on revision 2 is accepted.
    expect(await saveDraftSnapshot(user.client, user.id, snap(id, "combined-3", 2))).toEqual({ status: "saved", rev: 3 });
    const { data } = await user.client.from("workout_sessions").select("draft, draft_rev").eq("client_id", id).single();
    expect(data).toEqual({ draft: { version: 2, marker: "combined-3" }, draft_rev: 3 });
  });

  it("two backups on the same revision at the same moment: exactly one lands, the other is told to combine", async () => {
    const id = crypto.randomUUID();
    await saveDraftSnapshot(user.client, user.id, snap(id, "start", null));
    const results = await Promise.all([saveDraftSnapshot(user.client, user.id, snap(id, "a", 1)), saveDraftSnapshot(user.client, user.id, snap(id, "b", 1))]);
    expect(results.filter((r) => r.status === "saved")).toHaveLength(1);
    expect(results.filter((r) => r.status === "conflict")).toHaveLength(1);
  });

  it("a finished workout is never brought back, nor a discarded one created again", async () => {
    const done = crypto.randomUUID();
    await saveDraftSnapshot(user.client, user.id, snap(done, "x", null));
    await finishWorkout(user.client, user.id, finishInput(done, [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(100)] }], 1));
    expect(await saveDraftSnapshot(user.client, user.id, snap(done, "late", 1))).toEqual({ status: "finished" });

    const gone = crypto.randomUUID();
    await saveDraftSnapshot(user.client, user.id, snap(gone, "x", null));
    await discardDraft(user.client, user.id, gone);
    expect(await saveDraftSnapshot(user.client, user.id, snap(gone, "late", 1))).toEqual({ status: "discarded" });
    const { count } = await user.client.from("workout_sessions").select("id", { count: "exact", head: true }).eq("client_id", gone);
    expect(count).toBe(0);
  });

  it("every unfinished workout stays on the account and is offered (F-29)", async () => {
    const legs = crypto.randomUUID();
    const push = crypto.randomUUID();
    await saveDraftSnapshot(user.client, user.id, snap(legs, "legs", null));
    await saveDraftSnapshot(user.client, user.id, snap(push, "push", null));
    const drafts = await getServerDrafts(user.client, user.id);
    const markers = drafts.map((d) => (d.draft as { marker: string }).marker);
    expect(markers).toEqual(expect.arrayContaining(["legs", "push"]));
    expect(drafts.every((d) => typeof d.rev === "number" && d.rev >= 1)).toBe(true);
  });

  it("six or more unfinished workouts are all offered, none hidden (external review: the list stopped at five)", async () => {
    const seven = Array.from({ length: 7 }, () => crypto.randomUUID());
    for (const [i, id] of seven.entries()) await saveDraftSnapshot(user.client, user.id, snap(id, `w${i}`, null));
    const offered = (await getServerDrafts(user.client, user.id)).map((d) => (d.draft as { marker: string }).marker);
    for (let i = 0; i < 7; i++) expect(offered).toContain(`w${i}`);
  });

  it("Finish on an older copy is refused with the account's copy (nothing saved); on the current revision it saves", async () => {
    const id = crypto.randomUUID();
    await saveDraftSnapshot(user.client, user.id, snap(id, "phone", null));
    await saveDraftSnapshot(user.client, user.id, snap(id, "tablet", 1));
    const squat = [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null as null, sets: [set(100)] }];
    const err = await finishWorkout(user.client, user.id, finishInput(id, squat, 1)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DraftConflictError);
    expect(err).toMatchObject({ rev: 2, draft: { marker: "tablet" } });
    const { data } = await user.client.from("workout_sessions").select("status").eq("client_id", id).single();
    expect(data?.status).toBe("in_progress");
    await expect(finishWorkout(user.client, user.id, finishInput(id, squat, 2))).resolves.toMatchObject({ alreadyCompleted: false });
  });

  it("finished on two devices: the second Finish adds its sets and keeps the first's (the old rule dropped them)", async () => {
    const id = crypto.randomUUID();
    const squat = ex["back-squat"]!;
    const bench = ex["bench-press"]!;
    const row = (exerciseId: string, sets: ReturnType<typeof set>[]) => ({ exerciseId, substitutedFromId: null, notes: "", skipped: false, skipReason: null as null, sets });
    // Phone: all three squat sets. Tablet: one squat set and two bench sets (more in total, but not the phone's squats).
    await finishWorkout(user.client, user.id, finishInput(id, [row(squat, [set(100), set(100), set(100)]), row(bench, [set(60, false), set(60, false)])]));
    const second = await finishWorkout(user.client, user.id, finishInput(id, [row(squat, [set(100), set(0, false), set(0, false)]), row(bench, [set(60), set(62.5)])]));
    expect(second).toMatchObject({ alreadyCompleted: true, addedSets: 2, differingSets: 0 });
    expect(await savedSets(id)).toEqual([[100, 100, 100], [60, 62.5]]);
    // A plain repeat adds nothing.
    expect(await finishWorkout(user.client, user.id, finishInput(id, [row(squat, [set(100), set(100), set(100)])]))).toMatchObject({ addedSets: 0, differingSets: 0 });
    // The same sets completed with different numbers on the other device: the saved numbers stay, and it's reported.
    expect(await finishWorkout(user.client, user.id, finishInput(id, [row(squat, [set(100), set(105), set(110)])]))).toMatchObject({ addedSets: 0, differingSets: 2 });
    expect(await savedSets(id)).toEqual([[100, 100, 100], [60, 62.5]]);
  });
});
