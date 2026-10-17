import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

describe.skipIf(!available)("onboarding plan columns: constraints & RLS", () => {
  let alice: TestUser;
  let bob: TestUser;

  const base = (userId: string) => ({
    user_id: userId,
    primary_goal: "lose_fat",
    experience: "beginner",
    days_per_week: 3,
    session_minutes: 45,
    equipment: ["dumbbell", "bench", "band"],
  });

  beforeAll(async () => {
    [alice, bob] = await Promise.all([createTestUser("plan-alice"), createTestUser("plan-bob")]);
    const { error } = await alice.client
      .from("onboarding_answers")
      .upsert({ ...base(alice.id), goal_weight_kg: 72.5, weekly_change_kg: -0.5, activity_level: "light" });
    if (error) throw error;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob)]);
  });

  it("owners read back goal weight, pace and activity", async () => {
    const { data, error } = await alice.client.from("onboarding_answers").select("goal_weight_kg, weekly_change_kg, activity_level, session_minutes, equipment").single();
    expect(error).toBeNull();
    expect(Number(data?.goal_weight_kg)).toBe(72.5);
    expect(Number(data?.weekly_change_kg)).toBe(-0.5);
    expect(data?.activity_level).toBe("light");
    expect(data?.session_minutes).toBe(45);
  });

  it("rejects paces, activity levels and goal weights outside the allowed values", async () => {
    for (const bad of [{ weekly_change_kg: -2 }, { weekly_change_kg: 0.3 }, { activity_level: "couch" }, { goal_weight_kg: 10 }, { goal_weight_kg: 500 }]) {
      const { error } = await alice.client.from("onboarding_answers").update(bad).eq("user_id", alice.id);
      expect(error, JSON.stringify(bad)).not.toBeNull();
    }
    const { data } = await alice.client.from("onboarding_answers").select("weekly_change_kg, activity_level").single();
    expect(Number(data?.weekly_change_kg)).toBe(-0.5);
    expect(data?.activity_level).toBe("light");
  });

  it("allows the columns to be empty (older accounts)", async () => {
    const { error } = await bob.client.from("onboarding_answers").insert(base(bob.id));
    expect(error).toBeNull();
    const { data } = await bob.client.from("onboarding_answers").select("goal_weight_kg, weekly_change_kg, activity_level").single();
    expect(data).toEqual({ goal_weight_kg: null, weekly_change_kg: null, activity_level: null });
  });

  it("other users can't read or change them", async () => {
    const { data } = await bob.client.from("onboarding_answers").select("*").eq("user_id", alice.id);
    expect(data).toEqual([]);
    const { data: upd } = await bob.client.from("onboarding_answers").update({ weekly_change_kg: 0.5 }).eq("user_id", alice.id).select("user_id");
    expect(upd).toEqual([]);
    const { data: still } = await alice.client.from("onboarding_answers").select("weekly_change_kg").single();
    expect(Number(still?.weekly_change_kg)).toBe(-0.5);
  });
});
