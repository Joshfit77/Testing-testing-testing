import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Import records: owner-only, consent to add, and the source constraint. */
describe.skipIf(!available)("sleep import runs", () => {
  let owner: TestUser;
  let other: TestUser;
  beforeAll(async () => {
    [owner, other] = await Promise.all([createTestUser("imp-owner"), createTestUser("imp-other")]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(owner), deleteTestUser(other)]);
  });

  it("needs consent, then records a run the owner alone can see", async () => {
    const run = { user_id: owner.id, source: "apple_health", range_start: "2026-10-09T00:00:00Z", range_end: "2026-10-23T00:00:00Z", added: 3, duplicates: 1, conflicts: 0, device: "Apple Watch" };
    expect((await owner.client.from("sleep_import_runs").insert(run)).error).not.toBeNull();
    await owner.client.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", owner.id);
    expect((await owner.client.from("sleep_import_runs").insert(run)).error).toBeNull();
    expect((await owner.client.from("sleep_import_runs").insert({ ...run, source: "fitbit" })).error).not.toBeNull();
    expect((await owner.client.from("sleep_import_runs").insert({ ...run, range_end: "2026-10-01T00:00:00Z" })).error).not.toBeNull();
    expect((await other.client.from("sleep_import_runs").select("id").eq("user_id", owner.id)).data).toEqual([]);
    const { data } = await owner.client.from("sleep_import_runs").select("added, device").eq("user_id", owner.id);
    expect(data).toEqual([{ added: 3, device: "Apple Watch" }]);
  });

  it("lets the member switch import off on their own profile", async () => {
    expect((await owner.client.from("profiles").update({ sleep_import_enabled: false }).eq("id", owner.id)).error).toBeNull();
    const { data } = await owner.client.from("profiles").select("sleep_import_enabled").eq("id", owner.id).single();
    expect(data?.sleep_import_enabled).toBe(false);
  });
});
