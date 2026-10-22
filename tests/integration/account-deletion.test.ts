import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteUserAccount } from "@/server/services/account-deletion";
import { USER_TABLES } from "@/server/services/account";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const BUCKET = "progress-photos";
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });
const noLog = () => undefined;

describe.skipIf(!available)("account deletion removes the account, its rows and its files", () => {
  let carol: TestUser;
  let dave: TestUser;
  const photoPath = () => `${carol.id}/${crypto.randomUUID()}.jpg`;
  let carolPhoto: string;

  beforeAll(async () => {
    [carol, dave] = await Promise.all([createTestUser("carol"), createTestUser("dave")]);
    carolPhoto = photoPath();
    const { error: up } = await carol.client.storage.from(BUCKET).upload(carolPhoto, jpeg(), { contentType: "image/jpeg" });
    if (up) throw up;
    const inserts = await Promise.all([
      carol.client.from("progress_photos").insert({ user_id: carol.id, storage_path: carolPhoto, taken_on: "2026-10-01", pose: "front" }),
      carol.client.from("faith_journal_entries").insert({ user_id: carol.id, body: "Private prayer" }),
      carol.client.from("weight_entries").insert({ user_id: carol.id, recorded_on: "2026-10-01", weight_kg: 70 }),
      carol.client
        .from("workout_sessions")
        .insert({ user_id: carol.id, client_id: crypto.randomUUID(), name: "Carol session", status: "completed", started_at: "2026-10-01T10:00:00Z", ended_at: "2026-10-01T11:00:00Z" }),
      dave.client.from("faith_journal_entries").insert({ user_id: dave.id, body: "Dave's own entry" }),
    ]);
    for (const r of inserts) if (r.error) throw r.error;
  });

  afterAll(async () => {
    await deleteTestUser(dave);
    await serviceClient().auth.admin.deleteUser(carol.id).catch(() => null);
  });

  it("stops before deleting anything when subscriptions can't be cancelled", async () => {
    const r = await deleteUserAccount(carol.id, {
      admin: serviceClient(),
      cancelSubscriptions: async () => {
        throw new Error("stripe down");
      },
      deleteStripeCustomer: null,
      log: noLog,
    });
    expect(r).toMatchObject({ ok: false, stage: "billing" });
    const { data: user } = await serviceClient().auth.admin.getUserById(carol.id);
    expect(user.user?.id).toBe(carol.id);
    const { data: files } = await serviceClient().storage.from(BUCKET).list(carol.id);
    expect(files?.length).toBe(1);
  });

  it("deletes the auth user, every personal row and stored files, and leaves other users alone", async () => {
    const accessToken = (await carol.client.auth.getSession()).data.session!.access_token;
    const r = await deleteUserAccount(carol.id, { admin: serviceClient(), cancelSubscriptions: async () => undefined, deleteStripeCustomer: null, log: noLog });
    expect(r).toEqual({ ok: true, stripeCustomerDeleted: null });

    const svc = serviceClient();
    const { data: user } = await svc.auth.admin.getUserById(carol.id);
    expect(user.user).toBeNull();
    for (const { table, column } of USER_TABLES) {
      const { count, error } = await svc.from(table).select("*", { count: "exact", head: true }).eq(column, carol.id);
      expect(error, table).toBeNull();
      expect(count, table).toBe(0);
    }
    const { data: files } = await svc.storage.from(BUCKET).list(carol.id);
    expect(files ?? []).toHaveLength(0);

    // The old access token no longer identifies a user.
    const { data: who } = await anonClient().auth.getUser(accessToken);
    expect(who.user).toBeNull();

    const { count: daveRows } = await svc.from("faith_journal_entries").select("*", { count: "exact", head: true }).eq("user_id", dave.id);
    expect(daveRows).toBe(1);
  });
});
