import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchPersonal } from "@/server/services/personal-search";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The unified search's personal groups (workouts, saved meals/recipes/foods, prayer journal) show a member their own
 * rows and nobody else's: Bob's session cannot see Alice's rows even when he asks for them by her id (row-level
 * security), and a journal hit never carries the prayer's text.
 */
const available = await stackAvailable();

describe.skipIf(!available)("unified search: personal results are isolated per account", () => {
  const svc = serviceClient();
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    [alice, bob] = await Promise.all([createTestUser("search-alice"), createTestUser("search-bob")]);
    const started = new Date(Date.now() - 3600_000).toISOString();
    const rows = await Promise.all([
      svc.from("workout_sessions").insert({ user_id: alice.id, client_id: crypto.randomUUID(), name: "Alicefind leg day", status: "completed", started_at: started, ended_at: new Date().toISOString() }),
      svc.from("workout_sessions").insert({ user_id: alice.id, client_id: crypto.randomUUID(), name: "Alicefind abandoned", status: "in_progress", started_at: started }),
      svc.from("meals").insert({ user_id: alice.id, name: "Alicefind overnight oats", is_template: true }),
      svc.from("recipes").insert({ user_id: alice.id, name: "Alicefind chili" }),
      svc.from("foods").insert({ owner_id: alice.id, name: "Alicefind protein bar", serving_size: 60, serving_unit: "g", calories: 220 }),
      svc.from("faith_journal_entries").insert({ user_id: alice.id, title: "Alicefind morning prayer", body: "secretwords in the prayer text", theme: "gratitude" }),
      svc.from("faith_journal_entries").insert({ user_id: alice.id, title: null, body: "Alicefind only in the body", theme: "other" }),
      svc.from("faith_journal_entries").insert({ user_id: bob.id, title: "Alicefind is not mine", body: "Bob's entry that happens to match", theme: "other" }),
    ]);
    for (const r of rows) if (r.error) throw new Error(r.error.message);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob)]);
  });

  it("finds Alice's own completed workouts, saved meals, recipes, foods and journal entries", async () => {
    const r = await searchPersonal(alice.client, alice.id, "alicefind", { nutritionTools: true, timeZone: "America/New_York" });
    expect(r.workouts.map((w) => w.title)).toEqual(["Alicefind leg day"]); // the in-progress one is not history
    expect(r.meals.map((m) => m.title).sort()).toEqual(["Alicefind chili", "Alicefind overnight oats", "Alicefind protein bar"]);
    expect(r.journal.map((j) => j.title).sort()).toEqual(["Alicefind morning prayer", "Prayer journal entry"]);
    expect(JSON.stringify(r)).not.toContain("secretwords");
    expect(JSON.stringify(r)).not.toContain("only in the body");
  });

  it("shows Bob nothing of Alice's, even when he asks by her id, and only his own entry by his", async () => {
    const byHerId = await searchPersonal(bob.client, alice.id, "alicefind", { nutritionTools: true });
    expect(byHerId).toEqual({ workouts: [], meals: [], journal: [] });
    const his = await searchPersonal(bob.client, bob.id, "alicefind", { nutritionTools: true });
    expect(his.workouts).toEqual([]);
    expect(his.meals).toEqual([]);
    expect(his.journal.map((j) => j.title)).toEqual(["Alicefind is not mine"]);
  });

  it("keeps saved meals, recipes and foods out of the results when the plan has no nutrition tools, and treats pattern characters literally", async () => {
    const r = await searchPersonal(alice.client, alice.id, "alicefind", { nutritionTools: false });
    expect(r.meals).toEqual([]);
    expect(r.workouts.length).toBe(1);
    const none = await searchPersonal(alice.client, alice.id, "100%", { nutritionTools: true });
    expect(none).toEqual({ workouts: [], meals: [], journal: [] });
    const comma = await searchPersonal(alice.client, alice.id, "alicefind, (chili)", { nutritionTools: true });
    expect(comma.journal).toEqual([]);
  });
});
