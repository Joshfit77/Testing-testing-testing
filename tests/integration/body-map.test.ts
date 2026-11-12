import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** The muscle map against the real database: built from the member's own completed workouts, never stored. */
describe.skipIf(!available)("muscle map and strength ranks", async () => {
  const { loadBodyMap } = await import("@/server/services/body-map");
  let lifter: TestUser;
  let other: TestUser;

  const logWorkout = async (u: TestUser, daysAgo: number, lifts: { slug: string; sets: { weight: number | null; reps: number; warmup?: boolean }[] }[], status = "completed") => {
    const started = new Date(Date.now() - daysAgo * 86_400_000);
    const { data: sess, error } = await u.client
      .from("workout_sessions")
      .insert({ user_id: u.id, client_id: crypto.randomUUID(), name: "Test", status, started_at: started.toISOString(), ended_at: new Date(started.getTime() + 3_600_000).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    for (const [i, l] of lifts.entries()) {
      const { data: ex } = await u.client.from("exercises").select("id").eq("slug", l.slug).single();
      const { data: we } = await u.client.from("workout_exercises").insert({ session_id: sess!.id, user_id: u.id, exercise_id: ex!.id, position: i }).select("id").single();
      const rows = l.sets.map((s, j) => ({ workout_exercise_id: we!.id, user_id: u.id, set_number: j + 1, reps: s.reps, weight_kg: s.weight, completed: true, is_warmup: Boolean(s.warmup) }));
      const { error: sErr } = await u.client.from("workout_sets").insert(rows);
      if (sErr) throw sErr;
    }
  };

  beforeAll(async () => {
    [lifter, other] = await Promise.all([createTestUser("bodymap-lifter"), createTestUser("bodymap-other")]);
    await grantPlan(lifter, "plus");
    await lifter.client.from("profiles").update({ unit_system: "metric" }).eq("id", lifter.id);
    await logWorkout(lifter, 3, [
      { slug: "bench-press", sets: [{ weight: 40, reps: 10, warmup: true }, { weight: 80, reps: 5 }, { weight: 80, reps: 5 }] },
      { slug: "back-squat", sets: [{ weight: 120, reps: 5 }] },
      { slug: "leg-press", sets: [{ weight: 300, reps: 10 }] },
    ]);
    await logWorkout(lifter, 10, [{ slug: "conventional-deadlift", sets: [{ weight: 140, reps: 3 }] }, { slug: "overhead-press", sets: [{ weight: 45, reps: 5 }] }]);
    // An unfinished workout doesn't count.
    await logWorkout(lifter, 1, [{ slug: "bench-press", sets: [{ weight: 140, reps: 5 }] }], "in_progress");
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(lifter), deleteTestUser(other)]);
  });

  it("asks for a table and a body weight before ranking, and shows training data meanwhile", async () => {
    const map = await loadBodyMap(lifter.client, lifter.id);
    expect(map.table).toBeNull();
    expect(map.overall.level).toBeNull();
    expect(map.regions.every((r) => r.level == null)).toBe(true);
    const chest = map.stats.find((s) => s.region === "chest")!;
    // Bench press (2 working sets; the warm-up and the unfinished workout don't count) plus the overhead press,
    // which works the upper chest as a secondary muscle: half a set.
    expect(chest.last28.workouts).toBe(2);
    expect(chest.last28.sets).toBe(2.5);
    expect(chest.last28.volumeKg).toBe(800); // load volume counts main muscles only
    expect(chest.exercises.map((e) => [e.slug, e.role, e.sets])).toEqual([
      ["bench-press", "primary", 2],
      ["overhead-press", "secondary", 1],
    ]);
    expect(map.sessionsCounted).toBe(2);
  });

  it("ranks each region from its own benchmark lifts once the table and body weight are set", async () => {
    // Only the member can set their table, and only to a known value.
    expect((await lifter.client.from("profiles").update({ strength_standards: "giant" }).eq("id", lifter.id)).error).not.toBeNull();
    await other.client.from("profiles").update({ strength_standards: "women" }).eq("id", lifter.id);
    expect((await lifter.client.from("profiles").update({ strength_standards: "men" }).eq("id", lifter.id)).error).toBeNull();
    const today = new Date().toISOString().slice(0, 10);
    expect((await lifter.client.from("weight_entries").insert({ user_id: lifter.id, recorded_on: today, weight_kg: 80 })).error).toBeNull();

    const map = await loadBodyMap(lifter.client, lifter.id);
    expect(map.table).toBe("men");
    expect(map.bodyweight).toEqual({ kg: 80, date: today });
    const by = Object.fromEntries(map.regions.map((r) => [r.region, r]));
    expect(by.chest!.rank).toBe("gold"); // 80 × 5 → 93.3 kg ÷ 80 = 1.17
    expect(by.quadriceps!.representative!.benchmark.slug).toBe("back-squat"); // the leg press isn't a benchmark
    expect(by.quadriceps!.rank).toBe("platinum"); // 120 × 5 → 140 ÷ 80 = 1.75
    expect(by.calves!.notAssessed).toMatch(/No provisional rule yet/);
    expect(map.overall.assessed).toBeGreaterThanOrEqual(4);
    expect(map.overall.rank).not.toBeNull();
  });

  it("sees nothing of another member", async () => {
    const map = await loadBodyMap(other.client, lifter.id);
    expect(map.sessionsCounted).toBe(0);
    expect(map.table).toBeNull();
  });
});
