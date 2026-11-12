import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** GPS activities and running goals in the database: private, size-limited, saved once. */
describe.skipIf(!available)("GPS runs and running goals", () => {
  let runner: TestUser;
  let other: TestUser;
  const base = (over: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    user_id: runner.id,
    kind: "run",
    source: "gps",
    started_at: new Date(Date.now() - 3600_000).toISOString(),
    timezone: "UTC",
    distance_m: 5012.3,
    elapsed_s: 1900,
    moving_s: 1800,
    route: { type: "MultiLineString", coordinates: [[[-75, 40], [-75, 40.01]]] },
    splits: [{ index: 1, unit: "km", distance_m: 1000, moving_s: 360, elapsed_s: 365, split_s: 360 }],
    gps_quality: { gaps: 1, rejected: 12, lastAccuracy: 6 },
    ...over,
  });

  beforeAll(async () => {
    [runner, other] = await Promise.all([createTestUser("gps-runner"), createTestUser("gps-other")]);
    // Live GPS recording is part of Pro All Access; `other` stays on Free.
    await grantPlan(runner, "pro");
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(runner), deleteTestUser(other)]);
  });

  it("saves a GPS run once (same id or same start), privately, on Pro", async () => {
    const row = base();
    expect((await runner.client.from("activities").insert(row)).error).toBeNull();
    const again = await runner.client.from("activities").insert(row);
    expect(again.error?.code).toBe("23505");
    const sameStart = await runner.client.from("activities").insert({ ...row, id: crypto.randomUUID() });
    expect(sameStart.error?.code).toBe("23505");
    const { data } = await runner.client.from("activities").select("is_private, route, gps_quality").eq("id", row.id).single();
    expect(data).toMatchObject({ is_private: true, gps_quality: { gaps: 1 } });
    expect((await other.client.from("activities").select("id").eq("id", row.id)).data).toEqual([]);
  });

  it("live GPS is Pro: Free can't record or attach a route, but keeps managing runs recorded earlier", async () => {
    const freeRow = { ...base(), user_id: other.id, started_at: new Date(Date.now() - 9000_000).toISOString() };
    const refused = await other.client.from("activities").insert(freeRow);
    expect(refused.error?.message).toContain("Live GPS recording is included with Pro");
    // A manual entry is free, but it can't be turned into a GPS recording afterwards.
    const manualId = crypto.randomUUID();
    const manual = { id: manualId, user_id: other.id, kind: "walk", source: "manual", started_at: new Date(Date.now() - 9100_000).toISOString(), timezone: "UTC", distance_m: 2000, elapsed_s: 1500, moving_s: 1500 };
    expect((await other.client.from("activities").insert(manual)).error).toBeNull();
    const upgraded = await other.client.from("activities").update({ source: "gps", route: freeRow.route }).eq("id", manualId).select("id");
    expect(upgraded.error?.message).toContain("Live GPS recording is included with Pro");
    // A run recorded while they had Pro (written here by the service role) stays theirs to edit and delete.
    const earlier = { ...freeRow, id: crypto.randomUUID(), started_at: new Date(Date.now() - 9200_000).toISOString() };
    expect((await serviceClient().from("activities").insert(earlier)).error).toBeNull();
    const edited = await other.client.from("activities").update({ notes: "Hilly", perceived_effort: 6 }).eq("id", earlier.id).select("notes");
    expect(edited.error).toBeNull();
    expect(edited.data).toEqual([{ notes: "Hilly" }]);
    const removed = await other.client.from("activities").update({ deleted_at: new Date().toISOString(), route: null, splits: null, gps_quality: null }).eq("id", earlier.id).select("id");
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);
  });

  it("refuses oversized routes and splits, and routes on manual entries", async () => {
    const huge = { type: "MultiLineString", coordinates: [Array.from({ length: 9000 }, (_, i) => [-75 + i * 1e-5, 40 + i * 1e-5])] };
    expect((await runner.client.from("activities").insert(base({ route: huge, started_at: new Date(Date.now() - 7200_000).toISOString() }))).error).not.toBeNull();
    const splits = Array.from({ length: 601 }, (_, i) => ({ index: i + 1 }));
    expect((await runner.client.from("activities").insert(base({ splits, started_at: new Date(Date.now() - 7300_000).toISOString() }))).error).not.toBeNull();
    expect((await runner.client.from("activities").insert(base({ source: "manual", started_at: new Date(Date.now() - 7400_000).toISOString() }))).error).not.toBeNull();
  });

  it("keeps running goals private, valid and limited to 10 open goals", async () => {
    const goal = (over: Record<string, unknown> = {}) => runner.client.from("running_goals").insert({ user_id: runner.id, kind: "weekly_distance", distance_m: 20000, ...over });
    expect((await goal()).error).toBeNull();
    expect((await goal({ kind: "race_time", distance_m: 5000, target_s: 1680 })).error).toBeNull();
    expect((await goal({ kind: "race_time", distance_m: 5000 })).error).not.toBeNull(); // a target time needs a time
    expect((await goal({ target_s: 1680 })).error).not.toBeNull(); // and a distance goal can't have one
    expect((await other.client.from("running_goals").select("id").eq("user_id", runner.id)).data).toEqual([]);
    expect((await other.client.from("running_goals").insert({ user_id: runner.id, kind: "weekly_distance", distance_m: 1000 })).error).not.toBeNull();
    await serviceClient()
      .from("running_goals")
      .insert(Array.from({ length: 8 }, () => ({ user_id: runner.id, kind: "monthly_distance", distance_m: 50000 })));
    const over = await goal();
    expect(over.error?.message).toContain("running_goal_limit");
  });

  it("removes goals and runs with the account", async () => {
    const victim = await createTestUser("gps-delete");
    await grantPlan(victim, "pro");
    await victim.client.from("running_goals").insert({ user_id: victim.id, kind: "weekly_distance", distance_m: 1000 });
    await deleteTestUser(victim);
    expect((await serviceClient().from("running_goals").select("id", { count: "exact", head: true }).eq("user_id", victim.id)).count).toBe(0);
  });
});
