import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Requires migration 20261017000001_custom_programs.sql and a seed that includes the new exercises
 * (run `supabase db reset` after merging).
 */
describe.skipIf(!available)("custom program builder persistence", async () => {
  const { createPrivateProgram, activateProgram } = await import("@/server/services/programs");
  const { getActiveProgram } = await import("@/server/services/training");
  const { loadExercises, toCatalog } = await import("@/server/services/catalog");
  const { buildCustomProgram } = await import("@/lib/domain/custom-programs");

  let owner: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    [owner, other] = await Promise.all([createTestUser("builder"), createTestUser("outsider")]);
  });
  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("saves a periodized custom program with week-specific loads, privately, and activates it", async () => {
    const catalog = toCatalog(await loadExercises(owner.client));
    const seed = buildCustomProgram(
      {
        type: "bench",
        goal: "increase_1rm",
        experience: "intermediate",
        daysPerWeek: 4,
        sessionMinutes: 60,
        weeks: 8,
        units: "metric",
        age: 30,
        heightCm: 180,
        bodyweightKg: 85,
        maxesKg: { bench: 100 },
        equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pull_up_bar"],
      },
      catalog,
    );
    const programId = await createPrivateProgram(owner.client, owner.id, seed, "custom");
    await activateProgram(owner.client, owner.id, programId);

    const { data: program } = await owner.client.from("training_programs").select("source, tier, is_published, owner_id, duration_weeks, category_id").eq("id", programId).single();
    expect(program).toMatchObject({ source: "custom", tier: "free", is_published: false, owner_id: owner.id, duration_weeks: 8 });
    expect(program!.category_id).not.toBeNull();

    const { data: weeks } = await owner.client.from("program_weeks").select("id, week_number, is_deload, focus").eq("program_id", programId).order("week_number");
    expect(weeks).toHaveLength(8);
    expect(weeks!.at(-1)!.focus).toMatch(/Test week/);

    const intensityFor = async (weekNumber: number) => {
      const week = weeks!.find((w) => w.week_number === weekNumber)!;
      const { data: day } = await owner.client.from("program_days").select("id").eq("week_id", week.id).eq("day_number", 1).single();
      const { data: ex } = await owner.client.from("program_exercises").select("intensity").eq("day_id", day!.id).eq("position", 0).single();
      return ex!.intensity as string;
    };
    expect(await intensityFor(1)).toBe("70% · 70 kg");
    expect(await intensityFor(2)).toBe("72.5% · 72.5 kg");

    const active = await getActiveProgram(owner.client, owner.id);
    expect(active?.programName).toBe(seed.name);

    // Private to the owner.
    const { data: seen } = await other.client.from("training_programs").select("id").eq("id", programId);
    expect(seen).toEqual([]);
  });

  it("does not let users publish custom programs or create them for someone else", async () => {
    const base = { name: "Sneaky", difficulty: "beginner", duration_weeks: 1, days_per_week: 1, session_minutes: 30, source: "custom" };
    const published = await owner.client.from("training_programs").insert({ ...base, slug: `it-custom-pub-${Date.now()}`, owner_id: owner.id, is_published: true });
    expect(published.error).not.toBeNull();
    const forOther = await owner.client.from("training_programs").insert({ ...base, slug: `it-custom-other-${Date.now()}`, owner_id: other.id });
    expect(forOther.error).not.toBeNull();
    const bogusSource = await owner.client.from("training_programs").insert({ ...base, slug: `it-custom-src-${Date.now()}`, owner_id: owner.id, source: "hacked" });
    expect(bogusSource.error).not.toBeNull();
  });
});
