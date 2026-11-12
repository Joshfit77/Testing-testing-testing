import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * A food logged from a checked nutrition label is saved once per check, however often the save is sent: a retry after
 * a lost response, a double tap, or two copies racing. The action itself (not just the index) is exercised here,
 * against the real database, as the member.
 */
let current: SupabaseClient;
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const available = await stackAvailable();

describe.skipIf(!available)("label-photo food log: retry-safe at the action", () => {
  let user: TestUser;
  const svc = serviceClient();
  beforeAll(async () => {
    user = await createTestUser("label-retry");
    current = user.client;
  });
  afterAll(async () => deleteTestUser(user));

  const input = (clientId?: string) => ({
    date: "2026-11-12",
    mealType: "lunch",
    clientId,
    name: "Granola bar (label)",
    nutrition: { basis: "serving", servingGrams: 40, calories: 190, protein_g: 4, carbs_g: 29, fat_g: 7, fiber_g: 2, sugars_g: 11, salt_g: 0.2 },
    quantity: 1,
    unitId: "serving",
  });
  const rows = async (name: string) => (await svc.from("meal_items").select("id, calories, sugar_g, sodium_mg").eq("user_id", user.id).eq("name", name)).data ?? [];

  it("the same check sent three times, two at once, logs one row with the label's values", async () => {
    const { logLabelFoodAction } = await import("@/server/actions/label");
    const id = crypto.randomUUID();
    const [a, b] = await Promise.all([logLabelFoodAction(input(id)), logLabelFoodAction(input(id))]);
    const c = await logLabelFoodAction(input(id));
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true]);
    const saved = await rows("Granola bar (label)");
    expect(saved).toHaveLength(1);
    expect(Number(saved[0]!.calories)).toBe(190);
    expect(Number(saved[0]!.sugar_g)).toBe(11);
    expect(Number(saved[0]!.sodium_mg)).toBe(80);
  });

  it("a new check of the same label is a new entry", async () => {
    const { logLabelFoodAction } = await import("@/server/actions/label");
    await logLabelFoodAction(input(crypto.randomUUID()));
    expect(await rows("Granola bar (label)")).toHaveLength(2);
  });
});
