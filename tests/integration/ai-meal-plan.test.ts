import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** AI meal-plan drafts: written only by the server, approved into a normal plan with database nutrition. */
describe.skipIf(!available)("AI meal plan drafts", async () => {
  const { approveMealPlanDraft, loadDraft } = await import("@/server/services/ai-meal-plan");
  let pro: TestUser;
  let other: TestUser;

  const draftRow = (userId: string, meals: ({ slotIndex: number; key: string; portion: number; by: "ai" | "planner" } | null)[]) => ({
    user_id: userId,
    start_date: "2026-11-02",
    days: 1,
    focus: "high_protein",
    notes: "quick breakfasts",
    targets: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, explanation: ["test"] },
    settings: { mealsPerDay: 3, diet: "balanced", budget: "any", allergies: [], dislikes: [] },
    days_plan: [{ date: "2026-11-02", meals }],
    summary: "Test plan.",
    model: "test",
  });

  beforeAll(async () => {
    [pro, other] = await Promise.all([createTestUser("ai-meal-pro"), createTestUser("ai-meal-other")]);
    await Promise.all([grantPlan(pro, "pro"), grantPlan(other, "pro")]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(pro), deleteTestUser(other)]);
  });

  it("can't be written by members themselves, and is private to its owner", async () => {
    const own = await pro.client.from("meal_plan_drafts").insert(draftRow(pro.id, [null, null, null]));
    expect(own.error).not.toBeNull();
    expect((await serviceClient().from("meal_plan_drafts").insert(draftRow(pro.id, [null, null, null]))).error).toBeNull();
    expect(await loadDraft(pro.client, pro.id)).toMatchObject({ focus: "high_protein", days: 1 });
    expect((await other.client.from("meal_plan_drafts").select("user_id").eq("user_id", pro.id)).data).toEqual([]);
    expect((await other.client.from("meal_plan_drafts").delete({ count: "exact" }).eq("user_id", pro.id)).count).toBe(0);
  });

  it("approves into a normal plan, with nutrition from the database and unknown dishes left out", async () => {
    const { plannerDishes } = await import("@/server/services/recipes");
    const dishes = await plannerDishes(pro.client, pro.id, true);
    const breakfast = dishes.find((d) => d.slots.includes("breakfast"))!;
    const lunch = dishes.find((d) => d.slots.includes("lunch") && d.key !== breakfast.key)!;
    await serviceClient().from("meal_plan_drafts").upsert(
      draftRow(pro.id, [
        { slotIndex: 0, key: breakfast.key, portion: 1.5, by: "ai" },
        { slotIndex: 1, key: lunch.key, portion: 1, by: "ai" },
        { slotIndex: 2, key: "app:no-such-dish", portion: 1, by: "ai" },
      ]),
    );
    expect(await approveMealPlanDraft(pro.client, pro.id)).toEqual({ dropped: 1 });
    const { data: plan } = await pro.client.from("meal_plans").select("id, targets, meal_plan_entries(slot, source_key, portion, per_serving)").eq("user_id", pro.id).eq("start_date", "2026-11-02").single();
    expect(plan!.targets).toMatchObject({ calories: 2200, protein_g: 160 });
    const entries = (plan!.meal_plan_entries as { slot: number; source_key: string; portion: number; per_serving: { calories: number } }[]).sort((a, b) => a.slot - b.slot);
    expect(entries.map((e) => e.source_key)).toEqual([breakfast.key, lunch.key]);
    expect(Number(entries[0]!.portion)).toBe(1.5);
    expect(entries[0]!.per_serving.calories).toBe(breakfast.perServing.calories);
    // The draft is gone once approved.
    expect(await loadDraft(pro.client, pro.id)).toBeNull();
    expect(await approveMealPlanDraft(pro.client, pro.id)).toBeNull();
  });

  it("is removed with the account", async () => {
    const victim = await createTestUser("ai-meal-delete");
    await serviceClient().from("meal_plan_drafts").insert(draftRow(victim.id, [null, null, null]));
    await deleteTestUser(victim);
    expect((await serviceClient().from("meal_plan_drafts").select("user_id", { count: "exact", head: true }).eq("user_id", victim.id)).count).toBe(0);
  });
});
