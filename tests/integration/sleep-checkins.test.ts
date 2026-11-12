import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Sleep check-ins: consent to add or edit, owner-only, one per day, fixed disturbance list, partial updates keep the rest. */
describe.skipIf(!available)("sleep check-ins", () => {
  let owner: TestUser;
  let other: TestUser;
  const consent = (u: TestUser, on = true) => u.client.from("profiles").update({ wellness_consent_at: on ? new Date().toISOString() : null }).eq("id", u.id);

  beforeAll(async () => {
    [owner, other] = await Promise.all([createTestUser("ci-owner"), createTestUser("ci-other")]);
    await consent(other);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(owner), deleteTestUser(other)]);
  });

  it("needs wellness consent, then stores one row per day that only the owner sees", async () => {
    expect((await owner.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-23", restedness: 4 })).error).not.toBeNull();
    await consent(owner);
    expect((await owner.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-23", restedness: 4, disturbances: ["noise", "worry"] })).error).toBeNull();
    expect((await owner.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-23", restedness: 2 })).error?.code).toBe("23505");
    expect((await other.client.from("sleep_checkins").select("day").eq("user_id", owner.id)).data).toEqual([]);
    expect((await other.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-24", restedness: 1 })).error).not.toBeNull();
  });

  it("rejects values outside the scales and unknown disturbances", async () => {
    expect((await owner.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-20", restedness: 6 })).error).not.toBeNull();
    expect((await owner.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-20", exercise_timing: "night" })).error).not.toBeNull();
    expect((await owner.client.from("sleep_checkins").insert({ user_id: owner.id, day: "2026-10-20", disturbances: ["aliens"] })).error).not.toBeNull();
  });

  it("a quick one-field upsert keeps the other answers", async () => {
    expect((await owner.client.from("sleep_checkins").upsert({ user_id: owner.id, day: "2026-10-23", restedness: 5 }, { onConflict: "user_id,day" })).error).toBeNull();
    const { data } = await owner.client.from("sleep_checkins").select("restedness, disturbances").eq("day", "2026-10-23").single();
    expect(data).toEqual({ restedness: 5, disturbances: ["noise", "worry"] });
  });

  it("keeps reading and deleting after consent is withdrawn", async () => {
    await consent(owner, false);
    expect((await owner.client.from("sleep_checkins").update({ restedness: 1 }).eq("day", "2026-10-23").select("day")).error).not.toBeNull();
    expect((await owner.client.from("sleep_checkins").select("day").eq("user_id", owner.id)).data).toEqual([{ day: "2026-10-23" }]);
    expect((await owner.client.from("sleep_checkins").delete().eq("day", "2026-10-23").select("day")).data).toEqual([{ day: "2026-10-23" }]);
  });
});
