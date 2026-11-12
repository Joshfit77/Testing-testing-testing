import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const BUCKET = "body-scans";
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });

/** Body Scan in the database and storage: Pro and consent to add, owner-only everything, no admin access. */
describe.skipIf(!available)("body scans: consent, plan and isolation", async () => {
  const { removeUserFolder } = await import("@/server/services/account");
  let pro: TestUser;
  let plus: TestUser;
  let other: TestUser;
  let admin: TestUser;
  const scanId = crypto.randomUUID();
  const path = (u: TestUser, scan: string, pose: string) => `${u.id}/${scan}/${pose}-${crypto.randomUUID()}.jpg`;
  const consent = (u: TestUser, on = true) => u.client.from("profiles").update({ body_scan_consent_at: on ? new Date().toISOString() : null }).eq("id", u.id);

  beforeAll(async () => {
    [pro, plus, other, admin] = await Promise.all([createTestUser("scan-pro"), createTestUser("scan-plus"), createTestUser("scan-other"), createTestUser("scan-admin")]);
    await Promise.all([grantPlan(pro, "pro"), grantPlan(plus, "plus"), grantPlan(other, "pro")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
  });
  afterAll(async () => {
    for (const u of [pro, plus, other, admin]) if (u) await removeUserFolder(serviceClient(), BUCKET, u.id);
    await Promise.all([deleteTestUser(pro), deleteTestUser(plus), deleteTestUser(other), deleteTestUser(admin)]);
  });

  it("refuses uploads and scans before consent, and on Plus even with consent", async () => {
    expect((await pro.client.storage.from(BUCKET).upload(path(pro, scanId, "front"), jpeg(), { contentType: "image/jpeg" })).error).not.toBeNull();
    expect((await pro.client.from("body_scans").insert({ id: scanId, user_id: pro.id, taken_on: "2026-10-20" })).error).not.toBeNull();
    await consent(plus);
    expect((await plus.client.storage.from(BUCKET).upload(path(plus, crypto.randomUUID(), "front"), jpeg(), { contentType: "image/jpeg" })).error).not.toBeNull();
    expect((await plus.client.from("body_scans").insert({ id: crypto.randomUUID(), user_id: plus.id, taken_on: "2026-10-20" })).error).not.toBeNull();
  });

  it("with Pro and consent, stores a scan the owner alone can see", async () => {
    await consent(pro);
    const front = path(pro, scanId, "front");
    const side = path(pro, scanId, "side");
    for (const p of [front, side]) expect((await pro.client.storage.from(BUCKET).upload(p, jpeg(), { contentType: "image/jpeg" })).error).toBeNull();
    // Not into someone else's folder.
    expect((await pro.client.storage.from(BUCKET).upload(path(other, scanId, "front"), jpeg(), { contentType: "image/jpeg" })).error).not.toBeNull();
    expect((await pro.client.from("body_scans").insert({ id: scanId, user_id: pro.id, taken_on: "2026-10-20", weight_kg: 82 })).error).toBeNull();
    const photos = [
      { scan_id: scanId, user_id: pro.id, pose: "front", storage_path: front },
      { scan_id: scanId, user_id: pro.id, pose: "side", storage_path: side },
    ];
    expect((await pro.client.from("body_scan_photos").insert(photos)).error).toBeNull();
    // A second front photo for the same scan, or a path outside the scan's folder, is refused.
    expect((await pro.client.from("body_scan_photos").insert({ scan_id: scanId, user_id: pro.id, pose: "front", storage_path: path(pro, scanId, "front") })).error).not.toBeNull();
    expect((await pro.client.from("body_scan_photos").insert({ scan_id: scanId, user_id: pro.id, pose: "back", storage_path: path(pro, crypto.randomUUID(), "back") })).error).not.toBeNull();

    const { data: signed } = await pro.client.storage.from(BUCKET).createSignedUrl(front, 60);
    expect(signed?.signedUrl).toBeTruthy();
    for (const u of [other, admin]) {
      expect((await u.client.from("body_scans").select("id").eq("id", scanId)).data).toEqual([]);
      expect((await u.client.from("body_scan_photos").select("id").eq("scan_id", scanId)).data).toEqual([]);
      expect((await u.client.storage.from(BUCKET).createSignedUrl(front, 60)).data?.signedUrl).toBeFalsy();
      expect((await u.client.storage.from(BUCKET).download(front)).error).not.toBeNull();
      await u.client.from("body_scans").delete().eq("id", scanId);
      await u.client.storage.from(BUCKET).remove([front]);
    }
    expect((await pro.client.from("body_scans").select("id").eq("id", scanId)).data).toHaveLength(1);
    expect((await pro.client.storage.from(BUCKET).download(front)).error).toBeNull();
    // Someone else can't attach photos to this scan, even with Pro and consent.
    await consent(other);
    expect((await other.client.from("body_scan_photos").insert({ scan_id: scanId, user_id: other.id, pose: "back", storage_path: `${other.id}/${scanId}/back-${crypto.randomUUID()}.jpg` })).error).not.toBeNull();
  });

  it("the owner can still see and delete scans after withdrawing consent or downgrading", async () => {
    await consent(pro, false);
    await serviceClient().from("user_entitlements").delete().eq("user_id", pro.id);
    expect((await pro.client.from("body_scans").select("id").eq("id", scanId)).data).toHaveLength(1);
    const files = (await pro.client.storage.from(BUCKET).list(`${pro.id}/${scanId}`)).data ?? [];
    expect(files).toHaveLength(2);
    expect((await pro.client.storage.from(BUCKET).remove(files.map((f) => `${pro.id}/${scanId}/${f.name}`))).error).toBeNull();
    expect((await pro.client.from("body_scans").delete().eq("id", scanId)).error).toBeNull();
    expect((await serviceClient().from("body_scan_photos").select("id", { count: "exact", head: true }).eq("scan_id", scanId)).count).toBe(0);
  });

  it("account deletion removes scan rows and files", async () => {
    const victim = await createTestUser("scan-delete");
    await grantPlan(victim, "pro");
    await consent(victim);
    const id = crypto.randomUUID();
    const p = path(victim, id, "front");
    await victim.client.storage.from(BUCKET).upload(p, jpeg(), { contentType: "image/jpeg" });
    await victim.client.from("body_scans").insert({ id, user_id: victim.id, taken_on: "2026-10-20" });
    expect(await removeUserFolder(serviceClient(), BUCKET, victim.id)).toBe(1);
    await deleteTestUser(victim);
    expect((await serviceClient().from("body_scans").select("id", { count: "exact", head: true }).eq("user_id", victim.id)).count).toBe(0);
  });
});
