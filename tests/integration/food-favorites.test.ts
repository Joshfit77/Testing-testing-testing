import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/server/services/account";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

const basis = { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } };

describe.skipIf(!available)("food_favorites: RLS, constraints, export and deletion", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("fav-alice"), createTestUser("fav-bob"), createTestUser("fav-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const { error } = await alice.client.from("food_favorites").insert([
      { user_id: alice.id, food_key: "usda:171477", name: "Chicken breast", basis },
      { user_id: alice.id, food_key: "off:3017620422003", name: "Hazelnut spread", basis, detail: "Open Food Facts" },
    ]);
    if (error) throw error;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("owners read their own favorites", async () => {
    const { data } = await alice.client.from("food_favorites").select("food_key").order("food_key");
    expect(data?.map((r) => r.food_key)).toEqual(["off:3017620422003", "usda:171477"]);
  });

  it("one favorite per food per user (upsert is idempotent)", async () => {
    const dup = await alice.client.from("food_favorites").insert({ user_id: alice.id, food_key: "usda:171477", name: "Again", basis });
    expect(dup.error?.code).toBe("23505");
    const up = await alice.client.from("food_favorites").upsert({ user_id: alice.id, food_key: "usda:171477", name: "Chicken breast", basis }, { onConflict: "user_id,food_key" });
    expect(up.error).toBeNull();
    const { count } = await alice.client.from("food_favorites").select("id", { count: "exact", head: true });
    expect(count).toBe(2);
    // Different users can favorite the same food.
    const bobs = await bob.client.from("food_favorites").insert({ user_id: bob.id, food_key: "usda:171477", name: "Chicken breast", basis });
    expect(bobs.error).toBeNull();
  });

  it("rejects keys that aren't stable food identities and malformed snapshots", async () => {
    for (const food_key of ["custom", "usda:abc", "food:not-a-uuid", "off:12"]) {
      const { error } = await alice.client.from("food_favorites").insert({ user_id: alice.id, food_key, name: "X", basis });
      expect(error, food_key).not.toBeNull();
    }
    const { error } = await alice.client.from("food_favorites").insert({ user_id: alice.id, food_key: "usda:1", name: "X", basis: { kcal: 1 } });
    expect(error).not.toBeNull();
  });

  it("other users and admins can't read, change, delete or plant favorites", async () => {
    for (const client of [bob.client, admin.client]) {
      const { data } = await client.from("food_favorites").select("*").eq("user_id", alice.id);
      expect(data).toEqual([]);
    }
    const upd = await bob.client.from("food_favorites").update({ name: "pwned" }).eq("user_id", alice.id).select("id");
    expect(upd.data).toEqual([]);
    const del = await admin.client.from("food_favorites").delete().eq("user_id", alice.id).select("id");
    expect(del.data).toEqual([]);
    const plant = await bob.client.from("food_favorites").insert({ user_id: alice.id, food_key: "usda:2", name: "X", basis });
    expect(plant.error).not.toBeNull();
  });

  it("is included in the data export, together with steps and supplements", async () => {
    await alice.client.from("daily_steps").insert({ user_id: alice.id, day: "2026-10-18", steps: 4321, source: "manual" });
    const out = await exportUserData(alice.client, alice.id, alice.email);
    expect((out.food_favorites as { food_key: string }[]).map((f) => f.food_key).sort()).toEqual(["off:3017620422003", "usda:171477"]);
    expect((out.daily_steps as { steps: number }[])[0]?.steps).toBe(4321);
    expect(out).toHaveProperty("supplement_stack");
    expect(out).toHaveProperty("activities");
    expect(out).toHaveProperty("training_program_structure");
    // Nobody else's rows leak into an export.
    expect(JSON.stringify(out)).not.toContain(bob.id);
  });

  it("cascades away with the account", async () => {
    const temp = await createTestUser("fav-temp");
    await temp.client.from("food_favorites").insert({ user_id: temp.id, food_key: "usda:3", name: "X", basis });
    await deleteTestUser(temp);
    const { count } = await serviceClient().from("food_favorites").select("id", { count: "exact", head: true }).eq("user_id", temp.id);
    expect(count).toBe(0);
  });
});
