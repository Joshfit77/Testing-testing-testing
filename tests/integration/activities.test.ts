import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

const base = (userId: string) => ({
  user_id: userId,
  kind: "run",
  source: "manual",
  started_at: "2026-10-19T12:00:00Z",
  timezone: "America/New_York",
  distance_m: 5000,
  elapsed_s: 1800,
  moving_s: 1700,
});

describe.skipIf(!available)("activities: RLS, constraints and duplicate guards", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  const aliceRun = randomUUID();

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("act-alice"), createTestUser("act-bob"), createTestUser("act-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const { error } = await alice.client.from("activities").insert({ id: aliceRun, ...base(alice.id), notes: "Easy loop" });
    if (error) throw error;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("owners read their own activity, private by default", async () => {
    const { data } = await alice.client.from("activities").select("id, distance_m, is_private, route, deleted_at").eq("id", aliceRun).single();
    expect(data).toMatchObject({ id: aliceRun, is_private: true, route: null, deleted_at: null });
    expect(Number(data!.distance_m)).toBe(5000);
  });

  it("other users and admins can't read, edit or delete it", async () => {
    for (const client of [bob.client, admin.client]) {
      const { data, error } = await client.from("activities").select("*").eq("user_id", alice.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    const { data: upd } = await bob.client.from("activities").update({ distance_m: 1 }).eq("id", aliceRun).select("id");
    expect(upd).toEqual([]);
    const { data: soft } = await bob.client.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", aliceRun).select("id");
    expect(soft).toEqual([]);
    const { data: del } = await bob.client.from("activities").delete().eq("id", aliceRun).select("id");
    expect(del).toEqual([]);
    const { data: still } = await alice.client.from("activities").select("distance_m, deleted_at").eq("id", aliceRun).single();
    expect(Number(still!.distance_m)).toBe(5000);
    expect(still!.deleted_at).toBeNull();
  });

  it("users can't insert activities for someone else or reuse another user's id", async () => {
    const { error: forOther } = await bob.client.from("activities").insert(base(alice.id));
    expect(forOther).not.toBeNull();
    const { error: sameId } = await bob.client.from("activities").insert({ id: aliceRun, ...base(bob.id) });
    expect(sameId).not.toBeNull();
  });

  it("a repeated insert with the same stable id is rejected, not duplicated", async () => {
    const { error } = await alice.client.from("activities").insert({ id: aliceRun, ...base(alice.id) });
    expect(error?.code).toBe("23505");
    const { count } = await alice.client.from("activities").select("id", { count: "exact", head: true }).eq("id", aliceRun);
    expect(count).toBe(1);
  });

  it("enforces kind, source, ranges and moving ≤ elapsed", async () => {
    const bad: Record<string, unknown>[] = [
      { kind: "swim" },
      { source: "strava" },
      { distance_m: -1 },
      { distance_m: 500001 },
      { elapsed_s: 0 },
      { elapsed_s: 172801, moving_s: 100 },
      { moving_s: 1801 },
      { moving_s: 0 },
      { perceived_effort: 0 },
      { perceived_effort: 11 },
      { notes: "x".repeat(2001) },
      { splits: { not: "an array" } },
    ];
    for (const patch of bad) {
      const { error } = await alice.client.from("activities").insert({ ...base(alice.id), started_at: "2026-10-01T07:00:00Z", ...patch });
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
  });

  it("allows a missing distance only for manual entries, and a route only for GPS", async () => {
    const { error: timeOnly } = await alice.client.from("activities").insert({ ...base(alice.id), kind: "walk", distance_m: null, started_at: "2026-10-02T07:00:00Z" });
    expect(timeOnly).toBeNull();
    const { error: treadNoDist } = await alice.client.from("activities").insert({ ...base(alice.id), source: "treadmill", distance_m: null });
    expect(treadNoDist).not.toBeNull();
    const route = { type: "LineString", coordinates: [[0, 0], [0, 0.01]] };
    const { error: manualRoute } = await alice.client.from("activities").insert({ ...base(alice.id), route });
    expect(manualRoute).not.toBeNull();
    const { error: treadRoute } = await alice.client.from("activities").insert({ ...base(alice.id), source: "treadmill", route });
    expect(treadRoute).not.toBeNull();
    const { error: gpsRoute } = await alice.client.from("activities").insert({ ...base(alice.id), source: "gps", route, started_at: "2026-10-03T07:00:00Z" });
    expect(gpsRoute).toBeNull();
  });

  it("blocks duplicate GPS recordings and duplicate imports, but not after a soft delete", async () => {
    const gps = { ...base(alice.id), source: "gps", started_at: "2026-10-04T07:00:00Z" };
    const first = randomUUID();
    expect((await alice.client.from("activities").insert({ id: first, ...gps })).error).toBeNull();
    expect((await alice.client.from("activities").insert(gps)).error?.code).toBe("23505");
    // Bob can record at the same instant.
    expect((await bob.client.from("activities").insert({ ...gps, user_id: bob.id })).error).toBeNull();
    // After the first is soft-deleted, the same recording can be saved again.
    await alice.client.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", first);
    expect((await alice.client.from("activities").insert(gps)).error).toBeNull();

    const imp = { ...base(alice.id), source: "gps", started_at: "2026-10-05T07:00:00Z", external_id: "healthkit:ABC" };
    expect((await alice.client.from("activities").insert(imp)).error).toBeNull();
    const again = { ...imp, started_at: "2026-10-05T07:00:01Z" };
    expect((await alice.client.from("activities").insert(again)).error?.code).toBe("23505");
  });

  it("owners can soft-delete and hard-delete their own activity; updated_at moves on edit", async () => {
    const id = randomUUID();
    await alice.client.from("activities").insert({ id, ...base(alice.id), started_at: "2026-10-06T07:00:00Z" });
    const { data: before } = await alice.client.from("activities").select("updated_at").eq("id", id).single();
    await new Promise((r) => setTimeout(r, 20));
    const { data: edited } = await alice.client.from("activities").update({ distance_m: 6000 }).eq("id", id).select("updated_at").single();
    expect(Date.parse(edited!.updated_at as string)).toBeGreaterThan(Date.parse(before!.updated_at as string));
    const { data: soft } = await alice.client.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id");
    expect(soft).toHaveLength(1);
    const { data: hard } = await alice.client.from("activities").delete().eq("id", id).select("id");
    expect(hard).toHaveLength(1);
  });

  it("anonymous clients see nothing", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await anon.from("activities").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("activities are removed when the account is deleted", async () => {
    const carol = await createTestUser("act-carol");
    await carol.client.from("activities").insert(base(carol.id));
    await deleteTestUser(carol);
    const { data } = await serviceClient().from("activities").select("id").eq("user_id", carol.id);
    expect(data).toEqual([]);
  });
});
