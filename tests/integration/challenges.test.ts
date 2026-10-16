import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const SLUG = "narrow-gate-40";

describe.skipIf(!available)("faith challenge tables: RLS & constraints", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let aliceEnrollmentId: string;
  let aliceCheckinId: string;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("ch-alice"), createTestUser("ch-bob"), createTestUser("ch-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);

    const { data: e, error } = await alice.client
      .from("challenge_enrollments")
      .insert({ user_id: alice.id, challenge_slug: SLUG, started_on: "2026-10-16" })
      .select("id")
      .single();
    if (error) throw error;
    aliceEnrollmentId = e.id;
    const { data: c, error: cErr } = await alice.client
      .from("challenge_checkins")
      .insert({ enrollment_id: aliceEnrollmentId, user_id: alice.id, day_number: 1, devotional_done: true, workout_done: true, note: "Private note", checked_on: "2026-10-16" })
      .select("id")
      .single();
    if (cErr) throw cErr;
    aliceCheckinId = c.id;
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("owners can read their own enrollment and check-ins", async () => {
    const { data: e } = await alice.client.from("challenge_enrollments").select("id, status").eq("id", aliceEnrollmentId).single();
    expect(e).toMatchObject({ id: aliceEnrollmentId, status: "active" });
    const { data: c } = await alice.client.from("challenge_checkins").select("note").eq("id", aliceCheckinId).single();
    expect(c?.note).toBe("Private note");
  });

  it("other users and admins cannot read another user's challenge rows", async () => {
    for (const client of [bob.client, admin.client]) {
      const { data: e, error } = await client.from("challenge_enrollments").select("*").eq("user_id", alice.id);
      expect(error).toBeNull();
      expect(e).toEqual([]);
      const { data: c } = await client.from("challenge_checkins").select("*").eq("user_id", alice.id);
      expect(c).toEqual([]);
    }
  });

  it("other users cannot modify or delete another user's challenge rows", async () => {
    const { data: upd } = await bob.client.from("challenge_enrollments").update({ status: "abandoned" }).eq("id", aliceEnrollmentId).select("id");
    expect(upd).toEqual([]);
    const { data: updC } = await bob.client.from("challenge_checkins").update({ note: "hacked" }).eq("id", aliceCheckinId).select("id");
    expect(updC).toEqual([]);
    const { data: del } = await bob.client.from("challenge_checkins").delete().eq("id", aliceCheckinId).select("id");
    expect(del).toEqual([]);
    const { data: still } = await serviceClient().from("challenge_checkins").select("note").eq("id", aliceCheckinId).single();
    expect(still?.note).toBe("Private note");
  });

  it("users cannot create rows for someone else or attach check-ins to someone else's enrollment", async () => {
    const { error: spoof } = await bob.client.from("challenge_enrollments").insert({ user_id: alice.id, challenge_slug: SLUG, started_on: "2026-10-16" });
    expect(spoof).not.toBeNull();
    const { error: attach } = await bob.client
      .from("challenge_checkins")
      .insert({ enrollment_id: aliceEnrollmentId, user_id: bob.id, day_number: 2, checked_on: "2026-10-17" });
    expect(attach).not.toBeNull();
  });

  it("users cannot move their check-in onto another user's enrollment", async () => {
    const { data: be } = await bob.client.from("challenge_enrollments").insert({ user_id: bob.id, challenge_slug: SLUG, started_on: "2026-10-16" }).select("id").single();
    const { data: bc } = await bob.client
      .from("challenge_checkins")
      .insert({ enrollment_id: be!.id, user_id: bob.id, day_number: 1, checked_on: "2026-10-16" })
      .select("id")
      .single();
    const { error } = await bob.client.from("challenge_checkins").update({ enrollment_id: aliceEnrollmentId }).eq("id", bc!.id);
    expect(error).not.toBeNull();
  });

  it("allows only one active enrollment per user and challenge", async () => {
    const { error } = await alice.client.from("challenge_enrollments").insert({ user_id: alice.id, challenge_slug: SLUG, started_on: "2026-10-17" });
    expect(error).not.toBeNull();
    // After abandoning, a new active enrollment is allowed.
    const { data: other } = await alice.client
      .from("challenge_enrollments")
      .insert({ user_id: alice.id, challenge_slug: "it-other-challenge", started_on: "2026-10-17" })
      .select("id")
      .single();
    await alice.client.from("challenge_enrollments").update({ status: "abandoned" }).eq("id", other!.id);
    const { error: again } = await alice.client.from("challenge_enrollments").insert({ user_id: alice.id, challenge_slug: "it-other-challenge", started_on: "2026-10-18" });
    expect(again).toBeNull();
  });

  it("enforces day range, unique day per enrollment, note length and completed_at", async () => {
    const base = { enrollment_id: aliceEnrollmentId, user_id: alice.id, checked_on: "2026-10-16" };
    expect((await alice.client.from("challenge_checkins").insert({ ...base, day_number: 41 })).error).not.toBeNull();
    expect((await alice.client.from("challenge_checkins").insert({ ...base, day_number: 0 })).error).not.toBeNull();
    expect((await alice.client.from("challenge_checkins").insert({ ...base, day_number: 1 })).error).not.toBeNull();
    expect((await alice.client.from("challenge_checkins").insert({ ...base, day_number: 3, note: "x".repeat(1001) })).error).not.toBeNull();
    const { error: noCompletedAt } = await alice.client.from("challenge_enrollments").update({ status: "completed" }).eq("id", aliceEnrollmentId);
    expect(noCompletedAt).not.toBeNull();
  });

  it("upserting the same day updates the existing check-in", async () => {
    const { error } = await alice.client
      .from("challenge_checkins")
      .upsert(
        { enrollment_id: aliceEnrollmentId, user_id: alice.id, day_number: 1, devotional_done: true, workout_done: false, note: "Edited", checked_on: "2026-10-17" },
        { onConflict: "enrollment_id,day_number" },
      );
    expect(error).toBeNull();
    const { data } = await alice.client.from("challenge_checkins").select("workout_done, note").eq("enrollment_id", aliceEnrollmentId).eq("day_number", 1);
    expect(data).toEqual([{ workout_done: false, note: "Edited" }]);
  });

  it("deleting the user cascades to challenge rows", async () => {
    const temp = await createTestUser("ch-temp");
    const { data: e } = await temp.client.from("challenge_enrollments").insert({ user_id: temp.id, challenge_slug: SLUG, started_on: "2026-10-16" }).select("id").single();
    await temp.client.from("challenge_checkins").insert({ enrollment_id: e!.id, user_id: temp.id, day_number: 1, checked_on: "2026-10-16" });
    await deleteTestUser(temp);
    const svc = serviceClient();
    expect((await svc.from("challenge_enrollments").select("id").eq("user_id", temp.id)).data).toEqual([]);
    expect((await svc.from("challenge_checkins").select("id").eq("user_id", temp.id)).data).toEqual([]);
  });
});
