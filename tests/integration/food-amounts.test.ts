import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

describe.skipIf(!available)("food amounts on meal items (grams, units, nutrients, basis)", () => {
  let user: TestUser;
  let other: TestUser;
  let mealId: string;

  beforeAll(async () => {
    [user, other] = await Promise.all([createTestUser("amounts"), createTestUser("amounts-other")]);
    const { data, error } = await user.client.from("meals").insert({ user_id: user.id, eaten_on: "2026-10-19", meal_type: "lunch" }).select("id").single();
    if (error) throw error;
    mealId = data.id as string;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(user), deleteTestUser(other)]);
  });

  const item = (extra: Record<string, unknown> = {}) => ({
    meal_id: mealId,
    user_id: user.id,
    name: "Chicken breast, cooked (roasted)",
    servings: 6,
    calories: 281,
    protein_g: 52.7,
    carbs_g: 0,
    fat_g: 6.1,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 126,
    grams: 170.1,
    quantity: 6,
    unit_label: "oz",
    amount_label: "6 oz (170 g)",
    source: "usda:171477",
    basis: { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, sodium_mg: 74 }, portions: [{ label: "1 cup, chopped or diced", grams: 140 }] },
    ...extra,
  });

  it("stores the exact amount, nutrients, source and basis, and lets the owner edit it", async () => {
    const { data, error } = await user.client.from("meal_items").insert(item()).select("id, grams, amount_label, source, basis").single();
    expect(error).toBeNull();
    expect(Number(data!.grams)).toBe(170.1);
    expect(data!.amount_label).toBe("6 oz (170 g)");
    expect((data!.basis as { per100: { calories: number } }).per100.calories).toBe(165);
    const upd = await user.client.from("meal_items").update({ grams: 150, quantity: 150, unit_label: "g", amount_label: "150 g", calories: 248 }).eq("id", data!.id).select("grams").single();
    expect(upd.error).toBeNull();
    expect(Number(upd.data!.grams)).toBe(150);
  });

  it("keeps older entries (no amount columns) valid", async () => {
    const { error } = await user.client.from("meal_items").insert({ meal_id: mealId, user_id: user.id, name: "Quick add", servings: 1, calories: 300 });
    expect(error).toBeNull();
  });

  it("rejects bad values", async () => {
    expect((await user.client.from("meal_items").insert(item({ grams: -5 }))).error).not.toBeNull();
    expect((await user.client.from("meal_items").insert(item({ sodium_mg: -1 }))).error).not.toBeNull();
    expect((await user.client.from("meal_items").insert(item({ source: "scraped:1" }))).error).not.toBeNull();
    expect((await user.client.from("meal_items").insert(item({ basis: { calories: 1 } }))).error).not.toBeNull();
    expect((await user.client.from("meal_items").insert(item({ basis: [1, 2] }))).error).not.toBeNull();
    expect((await user.client.from("meal_items").insert(item({ quantity: 0 }))).error).not.toBeNull();
  });

  it("is private to the owner", async () => {
    const { data: mine } = await user.client.from("meal_items").select("id").eq("meal_id", mealId);
    expect(mine!.length).toBeGreaterThan(0);
    const { data: seen } = await other.client.from("meal_items").select("id, basis").eq("meal_id", mealId);
    expect(seen).toEqual([]);
    const upd = await other.client.from("meal_items").update({ grams: 1 }).eq("meal_id", mealId).select("id");
    expect(upd.data ?? []).toEqual([]);
    // Can't attach an item to someone else's meal.
    expect((await other.client.from("meal_items").insert({ ...item(), user_id: other.id })).error).not.toBeNull();
  });
});
