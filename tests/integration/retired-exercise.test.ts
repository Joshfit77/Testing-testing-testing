import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Retiring an exercise (migration 082) keeps every member's history intact: the row stays, unpublished, and a member
 * can still read it when their own data references it, so logged workouts keep the exercise's name. Nobody else can,
 * and the library, search and AI catalog (all "is_published") no longer return it.
 */
describe.skipIf(!available)("retired exercise (90/90 Hip Switch)", () => {
  const admin = serviceClient();
  let logger: TestUser;
  let stranger: TestUser;
  let exId: string;
  let sessionId: string;

  beforeAll(async () => {
    [logger, stranger] = await Promise.all([createTestUser("retired-logger"), createTestUser("retired-stranger")]);
    // A database from before the retirement still has the exercise, published, and a member who logged it.
    const { data: row, error } = await admin
      .from("exercises")
      .upsert(
        { slug: "90-90-hip-switch", name: "90/90 Hip Switch", category: "mobility", movement_pattern: "mobility", difficulty: "beginner", is_published: true },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw error;
    exId = row.id;
    const { data: s, error: sErr } = await logger.client
      .from("workout_sessions")
      .insert({ user_id: logger.id, client_id: crypto.randomUUID(), name: "Mobility", status: "completed", started_at: "2026-11-01T10:00:00Z", ended_at: "2026-11-01T10:30:00Z" })
      .select("id")
      .single();
    if (sErr) throw sErr;
    sessionId = s.id;
    const { error: weErr } = await logger.client.from("workout_exercises").insert({ session_id: sessionId, user_id: logger.id, exercise_id: exId, position: 0 });
    if (weErr) throw weErr;
    // Retire it exactly as the migration does.
    const sql = readFileSync("supabase/migrations/20261120000082_retire_exercises.sql", "utf8");
    expect(sql).toContain("update public.exercises set is_published = false where slug = '90-90-hip-switch';");
    const { error: upErr } = await admin.from("exercises").update({ is_published: false }).eq("slug", "90-90-hip-switch");
    if (upErr) throw upErr;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(logger), deleteTestUser(stranger)]);
    await admin.from("exercises").delete().eq("id", exId);
  });

  it("is gone from the library for everyone (published-only reads)", async () => {
    for (const c of [logger.client, stranger.client, anonClient()]) {
      const { data } = await c.from("exercises").select("slug").eq("is_published", true).eq("slug", "90-90-hip-switch");
      expect(data ?? []).toEqual([]);
    }
  });

  it("the member who logged it still sees its name in their workout history", async () => {
    const { data, error } = await logger.client
      .from("workout_sessions")
      .select("id, workout_exercises(exercise:exercises!workout_exercises_exercise_id_fkey(slug, name))")
      .eq("id", sessionId)
      .single();
    expect(error).toBeNull();
    const ex = (data!.workout_exercises as unknown as { exercise: { slug: string; name: string } | null }[])[0]!.exercise;
    expect(ex).toEqual({ slug: "90-90-hip-switch", name: "90/90 Hip Switch" });
    const { data: direct } = await logger.client.from("exercises").select("name, is_published").eq("id", exId).maybeSingle();
    expect(direct).toEqual({ name: "90/90 Hip Switch", is_published: false });
  });

  it("another member and a signed-out visitor cannot read the unpublished row", async () => {
    const { data: s } = await stranger.client.from("exercises").select("id").eq("id", exId);
    expect(s ?? []).toEqual([]);
    const { data: a } = await anonClient().from("exercises").select("id").eq("id", exId);
    expect(a ?? []).toEqual([]);
  });

  it("the helper answers only for the caller and is not callable signed out", async () => {
    const { data: mine } = await logger.client.rpc("member_references_exercise", { p_exercise_id: exId });
    expect(mine).toBe(true);
    const { data: theirs } = await stranger.client.rpc("member_references_exercise", { p_exercise_id: exId });
    expect(theirs).toBe(false);
    const { error } = await anonClient().rpc("member_references_exercise", { p_exercise_id: exId });
    expect(error).not.toBeNull();
  });

  it("the logged workout is not deleted or changed by the retirement", async () => {
    const { data } = await admin.from("workout_exercises").select("exercise_id").eq("session_id", sessionId);
    expect(data).toEqual([{ exercise_id: exId }]);
  });
});
