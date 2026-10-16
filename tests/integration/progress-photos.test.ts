import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const BUCKET = "progress-photos";
// Smallest valid-looking JPEG header bytes; storage only checks the declared content type.
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });

describe.skipIf(!available)("progress photos: row and storage isolation", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let alicePath: string;
  let alicePhotoId: string;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("photo-alice"), createTestUser("photo-bob"), createTestUser("photo-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    alicePath = `${alice.id}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await alice.client.storage.from(BUCKET).upload(alicePath, jpeg(), { contentType: "image/jpeg" });
    if (upErr) throw upErr;
    const { data, error } = await alice.client
      .from("progress_photos")
      .insert({ user_id: alice.id, storage_path: alicePath, taken_on: "2026-10-01", pose: "front", note: "Week 1" })
      .select("id")
      .single();
    if (error) throw error;
    alicePhotoId = data.id;
  });

  afterAll(async () => {
    const svc = serviceClient();
    for (const u of [alice, bob, admin]) {
      if (!u) continue;
      const { data } = await svc.storage.from(BUCKET).list(u.id);
      if (data?.length) await svc.storage.from(BUCKET).remove(data.map((f) => `${u.id}/${f.name}`));
    }
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("the owner can read their own row and object", async () => {
    const { data } = await alice.client.from("progress_photos").select("id, note").eq("id", alicePhotoId);
    expect(data).toEqual([{ id: alicePhotoId, note: "Week 1" }]);
    const { data: signed, error } = await alice.client.storage.from(BUCKET).createSignedUrl(alicePath, 60);
    expect(error).toBeNull();
    expect(signed?.signedUrl).toBeTruthy();
  });

  it("another user cannot select, update or delete the owner's rows", async () => {
    const { data: rows, error } = await bob.client.from("progress_photos").select("*").eq("user_id", alice.id);
    expect(error).toBeNull();
    expect(rows).toEqual([]);
    const { data: upd } = await bob.client.from("progress_photos").update({ note: "hacked" }).eq("id", alicePhotoId).select("id");
    expect(upd).toEqual([]);
    const { data: del } = await bob.client.from("progress_photos").delete().eq("id", alicePhotoId).select("id");
    expect(del).toEqual([]);
    const { data: still } = await serviceClient().from("progress_photos").select("note").eq("id", alicePhotoId).single();
    expect(still?.note).toBe("Week 1");
  });

  it("another user cannot insert rows for the owner or point at the owner's folder", async () => {
    const { error: spoof } = await bob.client.from("progress_photos").insert({ user_id: alice.id, storage_path: `${alice.id}/${crypto.randomUUID()}.jpg`, taken_on: "2026-10-02" });
    expect(spoof).not.toBeNull();
    // Own row, but storage path in someone else's folder → check constraint.
    const { error: crossPath } = await bob.client.from("progress_photos").insert({ user_id: bob.id, storage_path: `${alice.id}/${crypto.randomUUID()}.jpg`, taken_on: "2026-10-02" });
    expect(crossPath).not.toBeNull();
  });

  it("storage objects outside the user's own folder are denied", async () => {
    const { data: list } = await bob.client.storage.from(BUCKET).list(alice.id);
    expect(list ?? []).toEqual([]);
    const { error: dlErr } = await bob.client.storage.from(BUCKET).download(alicePath);
    expect(dlErr).not.toBeNull();
    const { error: signErr } = await bob.client.storage.from(BUCKET).createSignedUrl(alicePath, 60);
    expect(signErr).not.toBeNull();
    const { error: upErr } = await bob.client.storage.from(BUCKET).upload(`${alice.id}/${crypto.randomUUID()}.jpg`, jpeg(), { contentType: "image/jpeg" });
    expect(upErr).not.toBeNull();
    const { error: overwriteErr } = await bob.client.storage.from(BUCKET).upload(alicePath, jpeg(), { contentType: "image/jpeg", upsert: true });
    expect(overwriteErr).not.toBeNull();
    await bob.client.storage.from(BUCKET).remove([alicePath]);
    const { data: stillThere } = await serviceClient().storage.from(BUCKET).list(alice.id);
    expect(stillThere?.some((f) => alicePath.endsWith(f.name))).toBe(true);
  });

  it("admins cannot read other users' photos either", async () => {
    const { data: rows } = await admin.client.from("progress_photos").select("id").eq("user_id", alice.id);
    expect(rows).toEqual([]);
    const { error } = await admin.client.storage.from(BUCKET).download(alicePath);
    expect(error).not.toBeNull();
  });

  it("the bucket is private and rejects non-image uploads", async () => {
    const { data: bucket } = await serviceClient().storage.getBucket(BUCKET);
    expect(bucket?.public).toBe(false);
    const { error } = await bob.client.storage.from(BUCKET).upload(`${bob.id}/${crypto.randomUUID()}.txt`, new Blob(["hi"], { type: "text/plain" }), { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });
});
