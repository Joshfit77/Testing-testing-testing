import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * The demo's reset (the in-app Reset demo button and `npm run demo:reset`) puts the sample account back to its starting
 * state. It must never touch anyone else: not a new-member demo account someone is using right now, not a test's
 * account. Every delete is scoped by the sample account's id; this proves it against the real database.
 */
describe.skipIf(!available)("demo reset touches only the sample account", async () => {
  const { resetSampleAccount } = await import("@/server/demo-seed");
  let sample: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    sample = await createTestUser("demo-sample");
    other = await createTestUser("demo-other-member");
  });
  afterAll(async () => {
    await deleteTestUser(sample);
    await deleteTestUser(other);
  });

  it("re-seeds the sample account and leaves another member's rows and profile exactly as they were", async () => {
    const svc = serviceClient();
    const day = "2026-11-01";
    const { data: mine, error: e1 } = await svc.from("water_entries").insert({ user_id: sample.id, recorded_on: day, amount_ml: 111 }).select("id").single();
    expect(e1).toBeNull();
    const { data: theirs, error: e2 } = await svc.from("water_entries").insert({ user_id: other.id, recorded_on: day, amount_ml: 222 }).select("id").single();
    expect(e2).toBeNull();
    const { data: profileBefore } = await svc.from("profiles").select("*").eq("id", other.id).single();

    await resetSampleAccount(svc, sample.id);

    // The sample account's own entry is gone (replaced by the sample history)...
    expect((await svc.from("water_entries").select("id").eq("id", mine!.id)).data).toEqual([]);
    expect((await svc.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", sample.id)).count).toBeGreaterThan(0);
    // ...and the other member's entry, profile and (empty) history are untouched.
    expect((await svc.from("water_entries").select("id, amount_ml").eq("id", theirs!.id)).data).toEqual([{ id: theirs!.id, amount_ml: 222 }]);
    expect((await svc.from("profiles").select("*").eq("id", other.id).single()).data).toEqual(profileBefore);
    expect((await svc.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", other.id)).count).toBe(0);
    // The other member can still sign in with their own session: the reset deleted no account.
    expect((await svc.auth.admin.getUserById(other.id)).data.user?.id).toBe(other.id);
  }, 120_000);
});
