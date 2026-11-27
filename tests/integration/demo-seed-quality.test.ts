import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { kgToLb } from "@/lib/domain/units";

const available = await stackAvailable();

/**
 * The sample member is what the owner and testers judge the app by, so its data has to look like a real person's:
 * an ordinary name, weights that are plates on a bar (in the pounds they train in), no false "missed sessions", and a
 * populated meal planner, recipe book and grocery list built by the app's own planner.
 */
describe.skipIf(!available)("demo sample data looks like a real member's", async () => {
  const { resetSampleAccount } = await import("@/server/demo-seed");
  const { loadProgramSchedule } = await import("@/server/services/schedule");
  let sample: TestUser;

  beforeAll(async () => {
    sample = await createTestUser("demo-quality");
    await resetSampleAccount(serviceClient(), sample.id);
  }, 120_000);
  afterAll(async () => {
    await deleteTestUser(sample);
  });

  it("has an ordinary name, not 'Demo'", async () => {
    const { data } = await serviceClient().from("profiles").select("display_name, unit_system").eq("id", sample.id).single();
    expect(data!.display_name).toBe("Jordan Hayes");
    expect(data!.display_name).not.toMatch(/demo/i);
    expect(data!.unit_system).toBe("imperial");
  });

  it("logs every load as a whole 5 lb step, so it reads back as the number lifted", async () => {
    const { data } = await serviceClient().from("workout_sets").select("weight_kg").eq("user_id", sample.id).not("weight_kg", "is", null);
    expect(data!.length).toBeGreaterThan(100);
    for (const { weight_kg } of data!) {
      const lb = Math.round(kgToLb(Number(weight_kg)) * 10) / 10;
      expect(lb % 5, `${weight_kg} kg reads as ${lb} lb`).toBe(0);
    }
    const goals = (await serviceClient().from("fitness_goals").select("title, target_value, unit").eq("user_id", sample.id).eq("unit", "kg")).data!;
    for (const g of goals) {
      const lb = Math.round(kgToLb(Number(g.target_value)) * 10) / 10;
      // The title names the same number the goal tracks.
      expect(g.title, `${g.title}: target ${lb} lb`).toContain(`${lb} lb`);
    }
  });

  it("doesn't tell the member that program sessions came and went", async () => {
    const schedule = await loadProgramSchedule(serviceClient(), sample.id, "America/New_York");
    expect(schedule).not.toBeNull();
    expect(schedule!.missed.missed).toEqual([]);
  });

  it("has recipes, a week's meal plan and a grocery list built from it", async () => {
    const svc = serviceClient();
    const recipes = (await svc.from("recipes").select("id, name, recipe_ingredients(grams)").eq("user_id", sample.id)).data!;
    expect(recipes.map((r) => r.name).sort()).toEqual(["Chicken rice bowl", "Overnight protein oats", "Salmon, sweet potato and spinach"]);
    for (const r of recipes) for (const i of r.recipe_ingredients as { grams: number | null }[]) expect(Number(i.grams)).toBeGreaterThan(0);
    const { data: plan } = await svc.from("meal_plans").select("id, days, meal_plan_entries(plan_date)").eq("user_id", sample.id).single();
    expect(plan!.days).toBe(7);
    const days = new Set((plan!.meal_plan_entries as { plan_date: string }[]).map((e) => e.plan_date));
    expect(days.size).toBe(7);
    const { data: items } = await svc.from("grocery_items").select("name, origin, quantity").eq("user_id", sample.id);
    expect(items!.filter((i) => i.origin === "plan").length).toBeGreaterThan(5);
    expect(items!.some((i) => i.origin === "manual")).toBe(true);
    expect((await svc.from("grocery_lists").select("from_date, to_date").eq("user_id", sample.id).single()).data).not.toBeNull();
  });
});
