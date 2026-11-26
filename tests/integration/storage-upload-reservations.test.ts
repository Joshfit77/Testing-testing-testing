import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, grantPlan, reserveUpload, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { PHOTO_LIMITS } from "@/lib/domain/progress-photos";
import { SCAN_PHOTO_LIMITS } from "@/lib/domain/body-scan";

/**
 * Photo upload limits WITHOUT the storage triggers (migration 20261127000097), against the real storage server.
 *
 * Hosted projects may not allow triggers on storage.objects; migrations 086 and 088 then install only the storage
 * policy, which can't stop simultaneous uploads (the storage service checks policies in a transaction it rolls back).
 * Here both triggers are removed for the duration of the file, like such a project, and the limits must still hold
 * exactly under bursts, because every upload needs a reservation taken under the member's lock. The triggers are put
 * back afterwards, whatever happens.
 *
 * Also: a file can't be replaced (the overwrite path that let a member pass the byte limit is gone), a reservation is
 * only for the member's own folder and the two photo buckets, a retry reuses its reservation, and an expired one
 * doesn't count.
 */
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const available = await stackAvailable();
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

function sql(query: string): string[][] {
  const r = spawnSync("psql", [DB_URL, "-X", "-q", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`psql failed: ${r.error?.message ?? r.stderr}`);
  return r.stdout.trim() ? r.stdout.trim().split("\n").map((l) => l.split("\t")) : [];
}
const triggersInstalled = () => Number(sql(`select count(*) from pg_trigger where tgrelid = 'storage.objects'::regclass and tgname in ('progress_photos_quota', 'body_scan_photos_quota')`)[0]![0]);
const RESTORE_TRIGGERS = `
  drop trigger if exists progress_photos_quota on storage.objects;
  create trigger progress_photos_quota before insert on storage.objects for each row
    when (new.bucket_id = 'progress-photos') execute function public.enforce_progress_photo_quota();
  drop trigger if exists body_scan_photos_quota on storage.objects;
  create trigger body_scan_photos_quota before insert on storage.objects for each row
    when (new.bucket_id = 'body-scans') execute function public.enforce_body_scan_photo_quota();`;

/** Stored-photo records in a member's folder (no file content needed for the rule). */
function seed(bucket: string, userId: string, count: number, opts: { bytes?: number; ageHours?: number } = {}) {
  sql(`insert into storage.objects (bucket_id, name, owner, metadata, created_at)
       select '${bucket}', '${userId}/seed/' || i || '.jpg', '${userId}', jsonb_build_object('size', ${opts.bytes ?? 300_000}, 'mimetype', 'image/jpeg'),
              now() - interval '${opts.ageHours ?? 48} hours'
       from generate_series(1, ${count}) i`);
}
const stored = (bucket: string, userId: string) => Number(sql(`select count(*) from storage.objects where bucket_id = '${bucket}' and name like '${userId}/%'`)[0]![0]);

/** What the app does: reserve, and upload only when the reservation was granted. Returns whether the file landed. */
async function appUpload(user: TestUser, bucket: string, name: string): Promise<boolean> {
  if ((await reserveUpload(user.client, bucket, name)) !== "ok") return false;
  return !(await user.client.storage.from(bucket).upload(name, JPEG, { contentType: "image/jpeg", upsert: false })).error;
}
/** An attacker's burst: every request also uploads even when its reservation was refused. */
async function burst(user: TestUser, bucket: string, n: number, name: () => string): Promise<number> {
  const results = await Promise.all(
    Array.from({ length: n }, async () => {
      const path = name();
      await reserveUpload(user.client, bucket, path);
      return !(await user.client.storage.from(bucket).upload(path, JPEG, { contentType: "image/jpeg", upsert: false })).error;
    }),
  );
  return results.filter(Boolean).length;
}
const photoName = (u: TestUser) => () => `${u.id}/${crypto.randomUUID()}.jpg`;
const scanName = (u: TestUser) => () => `${u.id}/${crypto.randomUUID()}/front-${crypto.randomUUID()}.jpg`;

describe.skipIf(!available)("photo upload limits without storage triggers (upload reservations)", () => {
  const users: TestUser[] = [];
  const make = async (label: string, opts: { scans?: boolean } = {}) => {
    const u = await createTestUser(label);
    users.push(u);
    if (opts.scans) {
      await grantPlan(u, "pro");
      expect((await u.client.from("profiles").update({ body_scan_consent_at: new Date().toISOString() }).eq("id", u.id)).error).toBeNull();
    }
    return u;
  };

  beforeAll(() => {
    expect(triggersInstalled()).toBe(2);
    sql(`drop trigger if exists progress_photos_quota on storage.objects; drop trigger if exists body_scan_photos_quota on storage.objects;`);
    expect(triggersInstalled()).toBe(0);
  });
  afterAll(async () => {
    try {
      const admin = serviceClient();
      for (const u of users) {
        for (const bucket of ["progress-photos", "body-scans"]) {
          const real = sql(`select name from storage.objects where bucket_id = '${bucket}' and name like '${u.id}/%' and name not like '${u.id}/seed/%'`).map((r) => r[0]!);
          if (real.length) await admin.storage.from(bucket).remove(real);
          sql(`set storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = '${bucket}' and name like '${u.id}/seed/%'`);
        }
        await deleteTestUser(u);
      }
    } finally {
      sql(RESTORE_TRIGGERS);
      expect(triggersInstalled()).toBe(2);
    }
  });

  it("the storage policies require a reservation, and nothing can replace a stored photo", () => {
    for (const policy of ["progress_photos_owner_insert", "body_scans_owner_insert"]) {
      expect(sql(`select count(*) from pg_policies where schemaname = 'storage' and policyname = '${policy}' and with_check like '%has_upload_reservation(bucket_id, name)%'`)[0]![0]).toBe("1");
    }
    expect(sql(`select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL')
                and (qual like '%progress-photos%' or qual like '%body-scans%' or with_check like '%progress-photos%' or with_check like '%body-scans%')`)[0]![0]).toBe("0");
  });

  it("an upload without a reservation is refused even with plenty of room; with one it lands", async () => {
    const m = await make("resv-basic");
    const path = `${m.id}/${crypto.randomUUID()}.jpg`;
    expect((await m.client.storage.from("progress-photos").upload(path, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
    expect(await appUpload(m, "progress-photos", `${m.id}/${crypto.randomUUID()}.jpg`)).toBe(true);
    // A reservation is for one name only.
    expect(await reserveUpload(m.client, "progress-photos", `${m.id}/reserved.jpg`)).toBe("ok");
    expect((await m.client.storage.from("progress-photos").upload(`${m.id}/other.jpg`, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
  });

  it("reservations only for the member's own folder in the two photo buckets, and only when signed in", async () => {
    const a = await make("resv-a");
    const b = await make("resv-b");
    expect(await reserveUpload(a.client, "progress-photos", `${b.id}/${crypto.randomUUID()}.jpg`)).toBeNull();
    expect(await reserveUpload(a.client, "progress-photos", `${a.id}/../${b.id}/x.jpg`)).toBeNull();
    expect(await reserveUpload(a.client, "avatars", `${a.id}/x.jpg`)).toBeNull();
    expect(await reserveUpload(anonClient(), "progress-photos", `${a.id}/x.jpg`)).toBeNull();
    // b can't upload into a's folder even if a holds a reservation for that exact name.
    const name = `${a.id}/${crypto.randomUUID()}.jpg`;
    expect(await reserveUpload(a.client, "progress-photos", name)).toBe("ok");
    expect((await b.client.storage.from("progress-photos").upload(name, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
    // The table itself is closed to members.
    expect((await a.client.from("storage_upload_reservations").select("name")).data ?? []).toEqual([]);
    expect((await a.client.from("storage_upload_reservations").insert({ bucket_id: "progress-photos", name: `${a.id}/z.jpg`, user_id: a.id, expires_at: "2099-01-01" })).error).not.toBeNull();
  });

  it("a burst of 60 progress photos with none today: exactly 30 land", async () => {
    const m = await make("resv-burst-day");
    expect(await burst(m, "progress-photos", 60, photoName(m))).toBe(PHOTO_LIMITS.perDay);
    expect(stored("progress-photos", m.id)).toBe(PHOTO_LIMITS.perDay);
  });

  it("a burst of 20 with room for 5 under the 500-photo limit: exactly 5 land", async () => {
    const m = await make("resv-burst-total");
    seed("progress-photos", m.id, PHOTO_LIMITS.total - 5);
    expect(await burst(m, "progress-photos", 20, photoName(m))).toBe(5);
    expect(stored("progress-photos", m.id)).toBe(PHOTO_LIMITS.total);
  });

  it("near the byte limit, a pending upload counts as a full-size file, so a burst can't jointly pass it", async () => {
    const m = await make("resv-bytes");
    const MB8 = 8 * 1024 * 1024;
    // 20 MB below 1 GiB: room for two more 8 MB files pending at once (0 + 8 + 16 MB < 20 MB), not a fourth.
    seed("progress-photos", m.id, 1, { bytes: PHOTO_LIMITS.totalBytes - 20 * 1024 * 1024 });
    expect(await burst(m, "progress-photos", 10, photoName(m))).toBe(3);
    // Once those files exist at their real (small) size, room comes back.
    expect(await appUpload(m, "progress-photos", `${m.id}/${crypto.randomUUID()}.jpg`)).toBe(true);
    expect(MB8).toBe(Number(sql(`select file_size_limit from storage.buckets where id = 'progress-photos'`)[0]![0]));
  });

  it("Body Scan: a burst of 60 with none today: exactly 30 land", async () => {
    const m = await make("resv-scan-day", { scans: true });
    expect(await burst(m, "body-scans", 60, scanName(m))).toBe(SCAN_PHOTO_LIMITS.perDay);
    expect(stored("body-scans", m.id)).toBe(SCAN_PHOTO_LIMITS.perDay);
  });

  it("Body Scan: a burst of 20 with room for 4 under the 750-photo limit: exactly 4 land", async () => {
    const m = await make("resv-scan-total", { scans: true });
    seed("body-scans", m.id, SCAN_PHOTO_LIMITS.total - 4);
    expect(await burst(m, "body-scans", 20, scanName(m))).toBe(4);
    expect(stored("body-scans", m.id)).toBe(SCAN_PHOTO_LIMITS.total);
  });

  it("a retry of the same file reuses its reservation instead of taking another slot", async () => {
    const m = await make("resv-retry");
    seed("progress-photos", m.id, PHOTO_LIMITS.perDay - 1, { ageHours: 1 });
    const name = `${m.id}/${crypto.randomUUID()}.jpg`;
    expect(await reserveUpload(m.client, "progress-photos", name)).toBe("ok");
    expect(await reserveUpload(m.client, "progress-photos", name)).toBe("ok");
    expect(await reserveUpload(m.client, "progress-photos", `${m.id}/${crypto.randomUUID()}.jpg`)).toBe("limit");
    expect((await m.client.storage.from("progress-photos").upload(name, JPEG, { contentType: "image/jpeg" })).error).toBeNull();
  });

  it("an expired reservation neither counts nor lets a file in", async () => {
    const m = await make("resv-expired");
    seed("progress-photos", m.id, PHOTO_LIMITS.perDay - 1, { ageHours: 1 });
    const stale = `${m.id}/${crypto.randomUUID()}.jpg`;
    expect(await reserveUpload(m.client, "progress-photos", stale)).toBe("ok");
    sql(`update public.storage_upload_reservations set expires_at = now() - interval '1 minute' where name = '${stale}'`);
    expect((await m.client.storage.from("progress-photos").upload(stale, JPEG, { contentType: "image/jpeg" })).error).not.toBeNull();
    expect(await appUpload(m, "progress-photos", `${m.id}/${crypto.randomUUID()}.jpg`)).toBe(true);
  });

  it("a stored photo can't be replaced with another file (the overwrite path past the byte limit is closed)", async () => {
    const m = await make("resv-overwrite");
    const name = `${m.id}/${crypto.randomUUID()}.jpg`;
    expect(await appUpload(m, "progress-photos", name)).toBe(true);
    const sizeOf = () => Number(sql(`select metadata->>'size' from storage.objects where bucket_id = 'progress-photos' and name = '${name}'`)[0]![0]);
    const before = sizeOf();
    const big = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "image/jpeg" });
    // Even holding a fresh reservation for the name.
    expect(await reserveUpload(m.client, "progress-photos", name)).toBe("ok");
    expect((await m.client.storage.from("progress-photos").upload(name, big, { contentType: "image/jpeg", upsert: true })).error).not.toBeNull();
    expect((await m.client.storage.from("progress-photos").update(name, big, { contentType: "image/jpeg" })).error).not.toBeNull();
    expect(sizeOf()).toBe(before);
    // Deleting a photo still works.
    expect((await m.client.storage.from("progress-photos").remove([name])).error).toBeNull();
    expect(stored("progress-photos", m.id)).toBe(0);
  });

  it("deleting the account removes its reservations", async () => {
    const m = await createTestUser("resv-delete");
    expect(await reserveUpload(m.client, "progress-photos", `${m.id}/${crypto.randomUUID()}.jpg`)).toBe("ok");
    expect(Number(sql(`select count(*) from public.storage_upload_reservations where user_id = '${m.id}'`)[0]![0])).toBe(1);
    await deleteTestUser(m);
    expect(Number(sql(`select count(*) from public.storage_upload_reservations where user_id = '${m.id}'`)[0]![0])).toBe(0);
  });
});
