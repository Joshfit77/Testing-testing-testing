import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/server/services/account";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser, grantPlan } from "./helpers";

const available = await stackAvailable();

const basis = { per100: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 } };
const perServing = { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15, complete: true };

/** Stage 2A tables: recipes, recipe_ingredients, meal planner, grocery list and day marks. */
describe.skipIf(!available)("recipes, meal plans, grocery list and day marks: RLS, constraints, export and deletion", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let recipeId: string;
  let planId: string;
  let entryId: string;
  let groceryId: string;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("rp-alice"), createTestUser("rp-bob"), createTestUser("rp-admin")]);
    // Recipes, the planner and grocery lists are Plus features, checked by the database too.
    await Promise.all([grantPlan(alice, "plus"), grantPlan(bob, "plus")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const c = alice.client;
    const { data: r, error: rErr } = await c.from("recipes").insert({ user_id: alice.id, name: "Rice bowl", servings: 2 }).select("id").single();
    if (rErr) throw rErr;
    recipeId = r.id as string;
    const { error: iErr } = await c
      .from("recipe_ingredients")
      .insert({ recipe_id: recipeId, user_id: alice.id, name: "Rice", source: "usda:168878", quantity: 1, unit_label: "1 cup", grams: 158, basis });
    if (iErr) throw iErr;
    await c.from("meal_plan_settings").insert({ user_id: alice.id, meals_per_day: 3, budget: "low", allergies: ["peanuts"], dislikes: [] });
    const { data: p, error: pErr } = await c
      .from("meal_plans")
      .insert({ user_id: alice.id, start_date: "2026-10-21", days: 7, targets: { calories: 2000 }, settings: { mealsPerDay: 3 } })
      .select("id")
      .single();
    if (pErr) throw pErr;
    planId = p.id as string;
    const { data: e, error: eErr } = await c
      .from("meal_plan_entries")
      .insert({ plan_id: planId, user_id: alice.id, plan_date: "2026-10-21", slot: 0, meal_type: "breakfast", label: "Breakfast", source_key: `recipe:${recipeId}`, name: "Rice bowl", portion: 1, per_serving: perServing })
      .select("id")
      .single();
    if (eErr) throw eErr;
    entryId = e.id as string;
    await c.from("grocery_lists").insert({ user_id: alice.id, from_date: "2026-10-21", to_date: "2026-10-27" });
    const { data: g, error: gErr } = await c.from("grocery_items").insert({ user_id: alice.id, name: "Rice", quantity: 2, unit: "cups", origin: "plan" }).select("id").single();
    if (gErr) throw gErr;
    groceryId = g.id as string;
    await c.from("nutrition_day_marks").insert({ user_id: alice.id, day: "2026-10-20", status: "fasted" });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  const TABLES = ["recipes", "recipe_ingredients", "meal_plan_settings", "meal_plans", "meal_plan_entries", "grocery_lists", "grocery_items", "nutrition_day_marks"];

  it("owners read their own rows", async () => {
    for (const t of TABLES) {
      const { data, error } = await alice.client.from(t).select("*");
      expect(error, t).toBeNull();
      expect(data?.length, t).toBe(1);
    }
  });

  it("other users and admins can't read, change or delete them", async () => {
    for (const client of [bob.client, admin.client]) {
      for (const t of TABLES) {
        const { data } = await client.from(t).select("*").eq("user_id", alice.id);
        expect(data, t).toEqual([]);
      }
      const upd = await client.from("recipes").update({ name: "pwned" }).eq("id", recipeId).select("id");
      expect(upd.data).toEqual([]);
      const tick = await client.from("grocery_items").update({ checked: true }).eq("id", groceryId).select("id");
      expect(tick.data).toEqual([]);
      const del = await client.from("meal_plan_entries").delete().eq("id", entryId).select("id");
      expect(del.data).toEqual([]);
      const delPlan = await client.from("meal_plans").delete().eq("id", planId).select("id");
      expect(delPlan.data).toEqual([]);
    }
    const { count } = await alice.client.from("meal_plan_entries").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("nobody can plant rows for another user or into another user's recipe or plan", async () => {
    const asAlice = await bob.client.from("recipes").insert({ user_id: alice.id, name: "X", servings: 1 });
    expect(asAlice.error).not.toBeNull();
    // Bob's own row pointing at Alice's recipe / plan.
    const ing = await bob.client.from("recipe_ingredients").insert({ recipe_id: recipeId, user_id: bob.id, name: "X", source: "usda:1", quantity: 1, unit_label: "g", basis });
    expect(ing.error).not.toBeNull();
    const entry = await bob.client
      .from("meal_plan_entries")
      .insert({ plan_id: planId, user_id: bob.id, plan_date: "2026-10-22", slot: 1, meal_type: "lunch", label: "Lunch", source_key: "app:lentil-rice-bowl", name: "X", portion: 1, per_serving: perServing });
    expect(entry.error).not.toBeNull();
    const mark = await bob.client.from("nutrition_day_marks").insert({ user_id: alice.id, day: "2026-10-19", status: "complete" });
    expect(mark.error).not.toBeNull();
  });

  it("enforces the constraints", async () => {
    const c = alice.client;
    const bad = [
      c.from("recipes").insert({ user_id: alice.id, name: "", servings: 1 }),
      c.from("recipes").insert({ user_id: alice.id, name: "X", servings: 0 }),
      c.from("recipe_ingredients").insert({ recipe_id: recipeId, user_id: alice.id, name: "X", source: "custom", quantity: 1, unit_label: "g", basis }),
      c.from("recipe_ingredients").insert({ recipe_id: recipeId, user_id: alice.id, name: "X", source: "usda:1", quantity: 1, unit_label: "g", basis: { kcal: 1 } }),
      c.from("meal_plan_settings").upsert({ user_id: alice.id, meals_per_day: 6 }),
      c.from("meal_plan_settings").upsert({ user_id: alice.id, budget: "cheap" }),
      c.from("meal_plans").insert({ user_id: alice.id, start_date: "2026-10-21", days: 7, targets: {}, settings: {} }), // one plan per start date
      c.from("meal_plan_entries").insert({ plan_id: planId, user_id: alice.id, plan_date: "2026-10-21", slot: 0, meal_type: "breakfast", label: "B", source_key: "app:x", name: "X", portion: 1, per_serving: perServing }), // slot taken
      c.from("meal_plan_entries").insert({ plan_id: planId, user_id: alice.id, plan_date: "2026-10-22", slot: 0, meal_type: "breakfast", label: "B", source_key: "usda:1", name: "X", portion: 1, per_serving: perServing }),
      c.from("meal_plan_entries").insert({ plan_id: planId, user_id: alice.id, plan_date: "2026-10-22", slot: 0, meal_type: "breakfast", label: "B", source_key: "app:x", name: "X", portion: 9, per_serving: perServing }),
      c.from("grocery_items").insert({ user_id: alice.id, name: "X", origin: "robot" }),
      c.from("grocery_items").insert({ user_id: alice.id, name: "X", origin: "manual", quantity: 0 }),
      c.from("nutrition_day_marks").insert({ user_id: alice.id, day: "2026-10-18", status: "skipped" }),
    ];
    for (const [i, q] of bad.entries()) expect((await q).error, `case ${i}`).not.toBeNull();
  });

  it("diary entries can point back at a recipe or a built-in recipe", async () => {
    const { data: meal } = await alice.client.from("meals").insert({ user_id: alice.id, eaten_on: "2026-10-21", meal_type: "dinner" }).select("id").single();
    const base = { meal_id: meal!.id, user_id: alice.id, name: "Rice bowl", servings: 1, calories: 250 };
    expect((await alice.client.from("meal_items").insert({ ...base, source: `recipe:${recipeId}` })).error).toBeNull();
    expect((await alice.client.from("meal_items").insert({ ...base, source: "app:lentil-rice-bowl" })).error).toBeNull();
    expect((await alice.client.from("meal_items").insert({ ...base, source: "recipe:nope" })).error).not.toBeNull();
  });

  it("deleting a recipe or plan removes its children", async () => {
    const { data: r } = await alice.client.from("recipes").insert({ user_id: alice.id, name: "Temp", servings: 1 }).select("id").single();
    await alice.client.from("recipe_ingredients").insert({ recipe_id: r!.id, user_id: alice.id, name: "Rice", source: "usda:168878", quantity: 1, unit_label: "g", basis });
    await alice.client.from("recipes").delete().eq("id", r!.id);
    const { count } = await alice.client.from("recipe_ingredients").select("id", { count: "exact", head: true }).eq("recipe_id", r!.id);
    expect(count).toBe(0);
  });

  it("is included in the data export", async () => {
    const out = await exportUserData(alice.client, alice.id, alice.email);
    for (const t of TABLES) expect((out[t] as unknown[]).length, t).toBeGreaterThan(0);
    expect(JSON.stringify(out)).not.toContain(bob.id);
  });

  it("cascades away with the account", async () => {
    const temp = await createTestUser("rp-temp");
    await temp.client.from("recipes").insert({ user_id: temp.id, name: "Gone", servings: 1 });
    await temp.client.from("grocery_items").insert({ user_id: temp.id, name: "Gone", origin: "manual" });
    await temp.client.from("nutrition_day_marks").insert({ user_id: temp.id, day: "2026-10-01", status: "complete" });
    await deleteTestUser(temp);
    const admin = serviceClient();
    for (const t of ["recipes", "grocery_items", "nutrition_day_marks"]) {
      const { count } = await admin.from(t).select("*", { count: "exact", head: true }).eq("user_id", temp.id);
      expect(count, t).toBe(0);
    }
  });
});
