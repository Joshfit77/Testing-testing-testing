import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Adaptive training against the real database: accepted changes are applied to the member's own program, recorded
 * with what they replaced, and can be undone; workout history is never touched; only Pro can create them.
 */
describe.skipIf(!available)("adaptive training changes", async () => {
  const { createPrivateProgram, activateProgram } = await import("@/server/services/programs");
  const { loadExercises, toCatalog } = await import("@/server/services/catalog");
  const { buildCustomProgram } = await import("@/lib/domain/custom-programs");
  const { applyTrainingChange, undoTrainingAdjustment, loadReviewInput, TrainingChangeError } = await import("@/server/services/adaptive-training");

  let pro: TestUser;
  let plus: TestUser;
  let programId: string;
  const meta = { source: "review" as const, reason: "Test", units: "metric" as const };

  beforeAll(async () => {
    [pro, plus] = await Promise.all([createTestUser("adaptive-pro"), createTestUser("adaptive-plus")]);
    await grantPlan(pro, "pro");
    await grantPlan(plus, "plus");
    const catalog = toCatalog(await loadExercises(pro.client));
    const seed = buildCustomProgram(
      { type: "strength", goal: "get_stronger", experience: "intermediate", daysPerWeek: 3, sessionMinutes: 60, weeks: 8, units: "metric", age: 30, heightCm: 180, bodyweightKg: 85, maxesKg: {}, equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pull_up_bar"] } as Parameters<typeof buildCustomProgram>[0],
      catalog,
    );
    programId = await createPrivateProgram(pro.client, pro.id, seed, "custom");
    await activateProgram(pro.client, pro.id, programId);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(pro), deleteTestUser(plus)]);
  });

  // Week → days → exercises by id (an embedded-join filter would scan every program's exercises; see programDays).
  const weekRows = async (week: number) => {
    const { data: w } = await pro.client.from("program_weeks").select("id").eq("program_id", programId).eq("week_number", week).single();
    const { data: days } = await pro.client.from("program_days").select("id").eq("week_id", w!.id);
    const { data } = await pro.client
      .from("program_exercises")
      .select("id, sets, rpe, exercise:exercises(slug)")
      .in("day_id", (days ?? []).map((d) => d.id))
      .order("id");
    return (data ?? []) as unknown as { id: string; sets: number; rpe: number | null; exercise: { slug: string } }[];
  };

  it("turns a week into a recovery week, records it, and undoes it exactly", async () => {
    const before = await weekRows(2);
    expect(before.length).toBeGreaterThan(0);
    const r = await applyTrainingChange(pro.client, pro.id, { kind: "deload_week", programId, weekNumber: 2, setsFactor: 0.6, rpeCap: 7 }, meta);
    expect(r.summary).toMatch(/Week 2 is now a recovery week: 60% of the sets, effort up to RPE 7/);
    const after = await weekRows(2);
    for (const row of after) {
      const b = before.find((x) => x.id === row.id)!;
      expect(row.sets).toBe(Math.max(1, Math.round(b.sets * 0.6)));
      expect(Number(row.rpe)).toBeLessThanOrEqual(7);
    }
    expect((await pro.client.from("program_weeks").select("is_deload").eq("program_id", programId).eq("week_number", 2).single()).data!.is_deload).toBe(true);
    // A second time is refused.
    await expect(applyTrainingChange(pro.client, pro.id, { kind: "deload_week", programId, weekNumber: 2, setsFactor: 0.6, rpeCap: 7 }, meta)).rejects.toBeInstanceOf(TrainingChangeError);

    expect(await undoTrainingAdjustment(pro.client, pro.id, r.adjustmentId)).toMatch(/^Undone:/);
    const restored = await weekRows(2);
    expect(restored.map((x) => [x.id, x.sets, x.rpe == null ? null : Number(x.rpe)]).sort()).toEqual(before.map((x) => [x.id, x.sets, x.rpe == null ? null : Number(x.rpe)]).sort());
    expect((await pro.client.from("program_weeks").select("is_deload").eq("program_id", programId).eq("week_number", 2).single()).data!.is_deload).toBe(false);
    await expect(undoTrainingAdjustment(pro.client, pro.id, r.adjustmentId)).rejects.toThrow(/already undone/);
  });

  it("adds a set for the rest of the program and won't undo over a later edit", async () => {
    const slug = (await weekRows(3))[0]!.exercise.slug;
    const r = await applyTrainingChange(pro.client, pro.id, { kind: "volume_change", programId, exerciseSlug: slug, exerciseName: slug, fromWeek: 3, deltaSets: 1 }, meta);
    const { data: adj } = await pro.client.from("training_adjustments").select("changes").eq("id", r.adjustmentId).single();
    const changes = adj!.changes as { id: string; before: { sets: number }; after: { sets: number } }[];
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((c) => c.after.sets === c.before.sets + 1 || c.after.sets === 10)).toBe(true);
    // The member edits one of those rows by hand afterwards: undo refuses rather than overwrite it.
    await pro.client.from("program_exercises").update({ sets: 9 }).eq("id", changes[0]!.id);
    await expect(undoTrainingAdjustment(pro.client, pro.id, r.adjustmentId)).rejects.toThrow(/changed again since/);
  });

  it("sets a target load that the logger reads, and undo removes it", async () => {
    const r = await applyTrainingChange(pro.client, pro.id, { kind: "exercise_target", exerciseSlug: "bench-press", exerciseName: "Bench Press", weightKg: 82.5, reps: 5 }, meta);
    const { data: t } = await pro.client.from("exercise_targets").select("weight_kg, reps, source").eq("user_id", pro.id).single();
    expect(t).toMatchObject({ reps: 5, source: "review" });
    expect(Number(t!.weight_kg)).toBe(82.5);
    await undoTrainingAdjustment(pro.client, pro.id, r.adjustmentId);
    expect((await pro.client.from("exercise_targets").select("id").eq("user_id", pro.id)).data).toEqual([]);
  });

  it("only Pro can create changes, members only see their own, and the review reads their data", async () => {
    const { data: ex } = await plus.client.from("exercises").select("id").eq("slug", "bench-press").single();
    expect((await plus.client.from("exercise_targets").insert({ user_id: plus.id, exercise_id: ex!.id, weight_kg: 60, source: "review" })).error).not.toBeNull();
    expect((await plus.client.from("training_adjustments").insert({ user_id: plus.id, kind: "exercise_target", summary: "x", source: "review" })).error).not.toBeNull();
    expect((await plus.client.from("training_adjustments").select("id").eq("user_id", pro.id)).data).toEqual([]);
    // Adjustment rows can only be marked undone, not rewritten.
    const { data: own } = await pro.client.from("training_adjustments").select("id").eq("user_id", pro.id).limit(1).single();
    expect((await pro.client.from("training_adjustments").update({ summary: "rewritten" }).eq("id", own!.id)).error).not.toBeNull();

    const { input } = await loadReviewInput(pro.client, pro.id);
    expect(input.program?.programId).toBe(programId);
    expect(input.program?.editable).toBe(true);
    expect(input.workouts).toEqual([]);
  });

  it("lets the AI coach suggest (never apply) target loads and volume changes, with checks", async () => {
    const { executeCoachTool } = await import("@/server/coach/tools");
    const { loadAthleteSnapshot } = await import("@/server/coach/snapshot");
    const ctx = { supabase: pro.client, userId: pro.id, timeZone: "UTC", snapshot: await loadAthleteSnapshot(pro.client, pro.id), proposal: null };
    const slug = (await weekRows(1))[0]!.exercise.slug;
    const before = await weekRows(1);

    const vol = await executeCoachTool(ctx, "propose_volume_change", { exercise_slug: slug, delta_sets: 1, reason: "Chest volume is low." });
    expect(vol.isError).toBe(false);
    expect(vol.proposal).toMatchObject({ kind: "training_change", change: { kind: "volume_change", exerciseSlug: slug, deltaSets: 1, fromWeek: 1 } });
    expect(await weekRows(1)).toEqual(before); // nothing applied
    expect((await executeCoachTool({ ...ctx, proposal: null }, "propose_volume_change", { exercise_slug: "made-up-lift", delta_sets: 1, reason: "x x x" })).isError).toBe(true);

    const target = await executeCoachTool({ ...ctx, proposal: null }, "propose_target_load", { exercise_slug: "bench-press", weight: 80, unit: "kg", reps: 5, reason: "Stated by the athlete." });
    expect(target.proposal).toMatchObject({ kind: "training_change", change: { kind: "exercise_target", exerciseSlug: "bench-press", weightKg: 80, reps: 5 } });
    expect((await pro.client.from("exercise_targets").select("id").eq("user_id", pro.id)).data).toEqual([]);

    // With a logged history, a load far from what they've actually lifted is refused.
    const { data: ex } = await pro.client.from("exercises").select("id").eq("slug", "bench-press").single();
    const { data: sess } = await pro.client.from("workout_sessions").insert({ user_id: pro.id, client_id: crypto.randomUUID(), name: "Bench day", status: "completed", started_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), ended_at: new Date(Date.now() - 2 * 86_400_000 + 3_600_000).toISOString() }).select("id").single();
    const { data: we } = await pro.client.from("workout_exercises").insert({ session_id: sess!.id, user_id: pro.id, exercise_id: ex!.id, position: 0 }).select("id").single();
    await pro.client.from("workout_sets").insert({ workout_exercise_id: we!.id, user_id: pro.id, set_number: 1, reps: 5, weight_kg: 60, completed: true, is_warmup: false });
    const far = await executeCoachTool({ ...ctx, proposal: null }, "propose_target_load", { exercise_slug: "bench-press", weight: 120, unit: "kg", reps: 5, reason: "Too big a jump." });
    expect(far.isError).toBe(true);
    expect(far.content).toMatch(/far from their recent top set of (60 kg|132.3 lb)/);
  });

  it("removes everything with the account", async () => {
    const victim = await createTestUser("adaptive-delete");
    await grantPlan(victim, "pro");
    const { data: ex } = await victim.client.from("exercises").select("id").eq("slug", "bench-press").single();
    expect((await victim.client.from("exercise_targets").insert({ user_id: victim.id, exercise_id: ex!.id, weight_kg: 60, source: "review" })).error).toBeNull();
    await deleteTestUser(victim);
    expect((await serviceClient().from("exercise_targets").select("id", { count: "exact", head: true }).eq("user_id", victim.id)).count).toBe(0);
  });
});
