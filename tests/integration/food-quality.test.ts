import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { Q, startOffMock } from "../../e2e/off-mock";

const available = await stackAvailable();

/** Food IQ's Open Food Facts reads (against the local mock) and the member's saved filters. */
describe("food quality service (Open Food Facts mock)", async () => {
  let server: Server;
  let svc: typeof import("@/server/services/food-quality");

  beforeAll(async () => {
    server = await startOffMock(0);
    const { port } = server.address() as { port: number };
    process.env.OFF_API_BASE_URL = `http://127.0.0.1:${port}`;
    svc = await import("@/server/services/food-quality");
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("reads a product's quality facts and its diary form, and returns null for unknown codes", async () => {
    const found = await svc.getQualityProduct(Q.honey);
    expect(found?.quality).toMatchObject({ name: "Honey Crunch", nova: 4, nutriScore: { grade: "d" }, allergens: ["en:gluten", "en:soybeans"], additives: ["e322", "e951"] });
    expect(found?.diary).toMatchObject({ code: Q.honey, servingQuantity: 40 });
    const mystery = await svc.getQualityProduct(Q.mystery);
    expect(mystery?.quality.incomplete).toEqual(["ingredients", "nutrition", "categories"]);
    expect(mystery?.diary).toBeNull(); // nothing to log with exact numbers
    expect(await svc.getQualityProduct("0000000000017")).toBeNull();
    expect(await svc.getQualityProduct("not a code")).toBeNull();
  });

  it("searches products by name or brand (every word must match), and rejects too-short queries", async () => {
    const r = await svc.searchProducts("protein bar");
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.products.map((p) => p.name).sort()).toEqual(["Lean Protein Bar Vanilla", "Peak Protein Bar Chocolate", "Peanut Protein Bar"]);
    const none = await svc.searchProducts("zzzz nothing");
    expect(none).toEqual({ status: "ok", products: [] });
    expect(await svc.searchProducts("a")).toEqual({ status: "invalid" });
    // Odd characters are stripped, not sent.
    const cleaned = await svc.searchProducts("  Peak!!! <bar> ");
    expect(cleaned.status === "ok" && cleaned.products.length).toBe(2); // Peak Protein Bar Chocolate and Lean Protein Bar Vanilla (brand Peak)
  });

  it("finds products in the same category, caches them, and throttles searches", async () => {
    const r = await svc.searchCategory("en:breakfast-cereals");
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.candidates.map((p) => p.name).sort()).toEqual(["Choco Puffs", "Honey Crunch", "Oat Hoops", "Rice Flakes"]);
    expect(await svc.searchCategory(null)).toEqual({ status: "no_category" });
    expect(await svc.searchCategory("not a tag")).toEqual({ status: "no_category" });
    // Cached categories don't count; new ones are limited to 8 searches a minute from this server.
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => svc.searchCategory(`en:category-${i}`)));
    expect(results.filter((x) => x.status === "busy").length).toBeGreaterThanOrEqual(3);
    expect((await svc.searchCategory("en:breakfast-cereals")).status).toBe("ok");
  });
});

describe.skipIf(!available)("food quality filters in the database", () => {
  let member: TestUser;
  let other: TestUser;
  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("quality-filters"), createTestUser("quality-other")]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(member), deleteTestUser(other)]);
  });

  it("stores a member's own filters only, as a small object", async () => {
    const filters = { allergens: ["en:gluten"], diet: "vegan", nutrition: ["low_sugar"] };
    expect((await member.client.from("profiles").update({ food_filters: filters }).eq("id", member.id)).error).toBeNull();
    expect((await member.client.from("profiles").update({ food_filters: ["not", "an", "object"] }).eq("id", member.id)).error).not.toBeNull();
    expect((await member.client.from("profiles").update({ food_filters: { notes: "x".repeat(3000) } }).eq("id", member.id)).error).not.toBeNull();
    await other.client.from("profiles").update({ food_filters: { allergens: [] } }).eq("id", member.id);
    const { data } = await serviceClient().from("profiles").select("food_filters").eq("id", member.id).single();
    expect(data?.food_filters).toEqual(filters);
  });
});
