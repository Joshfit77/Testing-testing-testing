import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Food photos in the database: separate consent, a daily image cap on top of the monthly allowance, photo-sourced diary entries. */
describe.skipIf(!available)("AI food photos", async () => {
  const { analyzeFoodPhoto } = await import("@/server/services/food-photo");
  let pro: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    [pro, other] = await Promise.all([createTestUser("photo-pro"), createTestUser("photo-other")]);
    await grantPlan(pro, "pro");
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(pro), deleteTestUser(other)]);
  });

  const reserve = (kind: string) =>
    serviceClient().rpc("reserve_ai_usage", { p_user_id: pro.id, p_kind: kind, p_tier: "fast", p_chat_limit: 1000, p_plan_limit: 15, p_smart_limit: 15, p_per_minute: 1000, p_estimate_micros: 0, p_user_budget_micros: 1_000_000_000, p_global_budget_micros: 1_000_000_000_000, p_max_inflight_user: 1000, p_max_inflight_global: 100000, p_inflight_seconds: 180 });

  it("refuses to analyse anything before the member agrees to send photos", async () => {
    await expect(analyzeFoodPhoto(pro.client, pro.id, "pro", { base64: "AAAA", mediaType: "image/jpeg" }, "")).rejects.toMatchObject({ code: "consent_required" });
    const { count } = await serviceClient().from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    expect(count).toBe(0); // nothing was reserved or sent
  });

  it("lets only the member record or withdraw their photo consent", async () => {
    await other.client.from("profiles").update({ food_photo_consent_at: new Date().toISOString() }).eq("id", pro.id);
    expect((await serviceClient().from("profiles").select("food_photo_consent_at").eq("id", pro.id).single()).data?.food_photo_consent_at).toBeNull();
    expect((await pro.client.from("profiles").update({ food_photo_consent_at: new Date().toISOString() }).eq("id", pro.id)).error).toBeNull();
  });

  it("caps photo analyses at 20 a day under the usage lock, without blocking other AI requests", async () => {
    const results = await Promise.all(Array.from({ length: 23 }, () => reserve("food_photo")));
    expect(results.filter((r) => !r.error)).toHaveLength(20);
    expect(results.filter((r) => r.error?.message.includes("ai_quota_photo"))).toHaveLength(3);
    expect((await reserve("chat")).error).toBeNull();
  });

  it("stores confirmed items as photo estimates in the member's own diary", async () => {
    const { data: meal } = await pro.client.from("meals").insert({ user_id: pro.id, eaten_on: "2026-10-22", meal_type: "lunch" }).select("id").single();
    const row = { meal_id: meal!.id, user_id: pro.id, name: "Grilled chicken breast", servings: 1, calories: 250, protein_g: 46, carbs_g: 0, fat_g: 5, is_estimate: true, source: "photo", amount_label: "a palm-sized fillet (estimated from a photo)" };
    expect((await pro.client.from("meal_items").insert(row)).error).toBeNull();
    expect((await pro.client.from("meal_items").insert({ ...row, source: "photo2" })).error).not.toBeNull();
    expect((await other.client.from("meal_items").select("id").eq("meal_id", meal!.id)).data).toEqual([]);
  });

  it("saves a reviewed photo once, however often the save is sent (all rows or none)", async () => {
    const { derivedClientId } = await import("@/server/services/idempotency");
    const { data: meal } = await pro.client.from("meals").insert({ user_id: pro.id, eaten_on: "2026-10-23", meal_type: "dinner" }).select("id").single();
    const saveId = crypto.randomUUID();
    const rows = ["Rice", "Broccoli"].map((name, i) => ({ meal_id: meal!.id, user_id: pro.id, client_id: derivedClientId(saveId, i), name, servings: 1, calories: 100, protein_g: 2, carbs_g: 20, fat_g: 1, is_estimate: true, source: "photo" }));
    expect((await pro.client.from("meal_items").insert(rows)).error).toBeNull();
    // The retry (same review, same ids) is refused as a whole with a unique violation, which the action reports as saved.
    const retry = await pro.client.from("meal_items").insert(rows);
    expect(retry.error?.code).toBe("23505");
    const { count } = await pro.client.from("meal_items").select("id", { count: "exact", head: true }).eq("meal_id", meal!.id);
    expect(count).toBe(2);
    // Another member reusing the same ids is a different save, not a conflict with this one.
    const { data: theirMeal } = await other.client.from("meals").insert({ user_id: other.id, eaten_on: "2026-10-23", meal_type: "dinner" }).select("id").single();
    expect((await other.client.from("meal_items").insert(rows.map((r) => ({ ...r, meal_id: theirMeal!.id, user_id: other.id })))).error).toBeNull();
  });
});
