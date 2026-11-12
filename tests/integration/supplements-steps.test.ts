import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

describe.skipIf(!available)("supplement and step tables: RLS & constraints", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("ss-alice"), createTestUser("ss-bob"), createTestUser("ss-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const writes = await Promise.all([
      alice.client.from("supplement_stack").insert({ user_id: alice.id, supplement_id: "creatine" }),
      alice.client.from("supplement_logs").insert({ user_id: alice.id, supplement_id: "creatine", taken_on: "2026-10-17" }),
      alice.client.from("daily_steps").insert({ user_id: alice.id, day: "2026-10-17", steps: 9100, source: "manual" }),
    ]);
    for (const w of writes) if (w.error) throw w.error;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("owners can read their own rows", async () => {
    const { data: stack } = await alice.client.from("supplement_stack").select("supplement_id");
    expect(stack).toEqual([{ supplement_id: "creatine" }]);
    const { data: logs } = await alice.client.from("supplement_logs").select("taken_on");
    expect(logs).toEqual([{ taken_on: "2026-10-17" }]);
    const { data: steps } = await alice.client.from("daily_steps").select("steps, source");
    expect(steps).toEqual([{ steps: 9100, source: "manual" }]);
  });

  it("other users and admins can't read, change or delete them", async () => {
    for (const client of [bob.client, admin.client]) {
      for (const table of ["supplement_stack", "supplement_logs", "daily_steps"]) {
        const { data, error } = await client.from(table).select("*").eq("user_id", alice.id);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    }
    const { data: upd } = await bob.client.from("daily_steps").update({ steps: 1 }).eq("user_id", alice.id).select("day");
    expect(upd).toEqual([]);
    const { data: del } = await bob.client.from("supplement_stack").delete().eq("user_id", alice.id).select("supplement_id");
    expect(del).toEqual([]);
    const { data: still } = await alice.client.from("daily_steps").select("steps").single();
    expect(still?.steps).toBe(9100);
  });

  it("users can't write rows for someone else", async () => {
    const results = await Promise.all([
      bob.client.from("supplement_stack").insert({ user_id: alice.id, supplement_id: "whey" }),
      bob.client.from("supplement_logs").insert({ user_id: alice.id, supplement_id: "whey", taken_on: "2026-10-17" }),
      bob.client.from("daily_steps").insert({ user_id: alice.id, day: "2026-10-16", steps: 5, source: "manual" }),
    ]);
    for (const r of results) expect(r.error).not.toBeNull();
  });

  it("enforces step range, source and one row per day (upsert overwrites)", async () => {
    const { error: tooMany } = await alice.client.from("daily_steps").insert({ user_id: alice.id, day: "2026-10-15", steps: 200_001, source: "manual" });
    expect(tooMany).not.toBeNull();
    const { error: badSource } = await alice.client.from("daily_steps").insert({ user_id: alice.id, day: "2026-10-15", steps: 10, source: "fitbit" });
    expect(badSource).not.toBeNull();
    const { error: up } = await alice.client
      .from("daily_steps")
      .upsert({ user_id: alice.id, day: "2026-10-17", steps: 12000, source: "apple_health" }, { onConflict: "user_id,day" });
    expect(up).toBeNull();
    const { data } = await alice.client.from("daily_steps").select("steps, source").eq("day", "2026-10-17").single();
    expect(data).toEqual({ steps: 12000, source: "apple_health" });
  });

  it("rejects empty and over-long supplement ids", async () => {
    const { error: empty } = await alice.client.from("supplement_stack").insert({ user_id: alice.id, supplement_id: "" });
    expect(empty).not.toBeNull();
    const { error: long } = await alice.client.from("supplement_stack").insert({ user_id: alice.id, supplement_id: "x".repeat(65) });
    expect(long).not.toBeNull();
  });

  it("lets users set their own step goal within 1,000–50,000 but not someone else's", async () => {
    const { data: def } = await alice.client.from("profiles").select("step_goal").eq("id", alice.id).single();
    expect(def?.step_goal).toBe(8000);
    const { error: ok } = await alice.client.from("profiles").update({ step_goal: 10000 }).eq("id", alice.id);
    expect(ok).toBeNull();
    const { error: low } = await alice.client.from("profiles").update({ step_goal: 999 }).eq("id", alice.id);
    expect(low).not.toBeNull();
    const { data: other } = await bob.client.from("profiles").update({ step_goal: 20000 }).eq("id", alice.id).select("id");
    expect(other).toEqual([]);
    const { data: after } = await alice.client.from("profiles").select("step_goal").eq("id", alice.id).single();
    expect(after?.step_goal).toBe(10000);
  });
});
