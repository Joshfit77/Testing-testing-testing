import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, reserveUpload, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { PHOTO_LIMIT_MESSAGE, PHOTO_LIMITS, photoUploadErrorMessage } from "@/lib/domain/progress-photos";

/**
 * Progress-photo upload limits (migration 20261124000086), against the real storage server: a member who already has
 * 500 photos, 30 uploads in the last 24 hours, or 1 GiB stored can't upload another, even calling the storage API
 * directly. Nothing stored is removed, other members aren't affected, and deleting a photo frees room.
 * Existing photos are set up with SQL (psql, like database-security-catalog.test.ts) instead of hundreds of uploads.
 */
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const BUCKET = "progress-photos";
const available = await stackAvailable();

function sql(query: string): string[][] {
  const r = spawnSync("psql", [DB_URL, "-X", "-q", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`psql failed: ${r.error?.message ?? r.stderr}`);
  return r.stdout.trim() ? r.stdout.trim().split("\n").map((l) => l.split("\t")) : [];
}
/** Adds `count` stored-photo records to a member's folder (no file content needed for the rule). */
function seed(userId: string, count: number, opts: { bytes?: number; ageHours?: number } = {}) {
  const bytes = opts.bytes ?? 300_000;
  const age = opts.ageHours ?? 48;
  sql(`insert into storage.objects (bucket_id, name, owner, metadata, created_at)
       select '${BUCKET}', '${userId}/seed-' || i || '.jpg', '${userId}', jsonb_build_object('size', ${bytes}, 'mimetype', 'image/jpeg'),
              now() - interval '${age} hours'
       from generate_series(1, ${count}) i`);
}
const stored = (userId: string) => Number(sql(`select count(*) from storage.objects where bucket_id = '${BUCKET}' and name like '${userId}/%'`)[0]![0]);
// A tiny JPEG: the rule looks at the member's folder, not the picture.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
// Like the app: reserve the file, then upload it. When the reservation is refused (a limit) the upload is still sent,
// to show the storage rule refuses it too.
const upload = async (user: TestUser, name = `${crypto.randomUUID()}.jpg`) => {
  await reserveUpload(user.client, BUCKET, `${user.id}/${name}`);
  return user.client.storage.from(BUCKET).upload(`${user.id}/${name}`, JPEG, { contentType: "image/jpeg", upsert: false });
};

describe.skipIf(!available)("progress photo upload limits", () => {
  const users: TestUser[] = [];
  const make = async (label: string) => {
    const u = await createTestUser(label);
    users.push(u);
    return u;
  };
  beforeAll(() => {
    expect(sql("select 1")[0]![0]).toBe("1");
  });
  afterAll(async () => {
    const admin = serviceClient();
    for (const u of users) {
      // Real uploads through the Storage API (removes their files); the seeded records have no file, so SQL removes
      // them (storage only allows a direct delete when asked explicitly).
      const real = sql(`select name from storage.objects where bucket_id = '${BUCKET}' and name like '${u.id}/%' and name not like '${u.id}/seed-%'`).map((r) => r[0]!);
      if (real.length) await admin.storage.from(BUCKET).remove(real);
      sql(`set storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = '${BUCKET}' and name like '${u.id}/seed-%'`);
      await deleteTestUser(u);
    }
  });

  it("the rule and the app use the same numbers", () => {
    const migration = readFileSync("supabase/migrations/20261124000086_progress_photo_quota.sql", "utf8");
    expect(migration).toContain(`return v_count < ${PHOTO_LIMITS.total} and v_today < ${PHOTO_LIMITS.perDay} and v_bytes < ${PHOTO_LIMITS.totalBytes};`);
    expect(migration).toContain("count(*) filter (where o.created_at > now() - interval '24 hours')");
    // Both layers are installed: the storage policy and the trigger on the row actually written.
    expect(sql(`select count(*) from pg_policies where schemaname = 'storage' and policyname = 'progress_photos_owner_insert' and with_check like '%can_add_progress_photo()%'`)[0]![0]).toBe("1");
    expect(sql(`select count(*) from pg_trigger where tgname = 'progress_photos_quota' and tgrelid = 'storage.objects'::regclass and tgenabled = 'O'`)[0]![0]).toBe("1");
  });

  it("an ordinary member uploads as before, and still can't write into someone else's folder", async () => {
    const a = await make("photos-a");
    const b = await make("photos-b");
    expect((await upload(a)).error).toBeNull();
    const intoB = await a.client.storage.from(BUCKET).upload(`${b.id}/${crypto.randomUUID()}.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(intoB.error).not.toBeNull();
  });

  it("at 500 stored photos a new upload is refused, nothing is removed, and deleting one frees room", async () => {
    const m = await make("photos-500");
    seed(m.id, PHOTO_LIMITS.total - 1);
    const last = await upload(m, "last.jpg");
    expect(last.error).toBeNull();
    expect(stored(m.id)).toBe(PHOTO_LIMITS.total);

    const refused = await upload(m);
    expect(refused.error).not.toBeNull();
    expect(photoUploadErrorMessage(refused.error as never)).toBe(PHOTO_LIMIT_MESSAGE);
    expect(stored(m.id)).toBe(PHOTO_LIMITS.total);
    // The member can still see their photos.
    expect((await m.client.storage.from(BUCKET).list(m.id, { search: "last.jpg" })).data?.map((f) => f.name)).toEqual(["last.jpg"]);

    expect((await m.client.storage.from(BUCKET).remove([`${m.id}/last.jpg`])).error).toBeNull();
    expect((await upload(m)).error).toBeNull();
  });

  it("30 uploads in the last 24 hours: refused until they are older than a day", async () => {
    const m = await make("photos-day");
    seed(m.id, PHOTO_LIMITS.perDay, { ageHours: 1 });
    expect((await upload(m)).error).not.toBeNull();
    sql(`update storage.objects set created_at = now() - interval '25 hours' where bucket_id = '${BUCKET}' and name like '${m.id}/seed-%'`);
    expect((await upload(m)).error).toBeNull();
    expect(stored(m.id)).toBe(PHOTO_LIMITS.perDay + 1);
  });

  it("1 GiB stored in total: refused, whatever the number of photos", async () => {
    const m = await make("photos-bytes");
    seed(m.id, 1, { bytes: PHOTO_LIMITS.totalBytes });
    expect((await upload(m)).error).not.toBeNull();
    sql(`update storage.objects set metadata = jsonb_set(metadata, '{size}', '300000') where bucket_id = '${BUCKET}' and name like '${m.id}/seed-%'`);
    expect((await upload(m)).error).toBeNull();
  });

  it("simultaneous uploads can't slip past the limits (each member's uploads take turns)", async () => {
    const burst = async (u: TestUser, n: number) => (await Promise.all(Array.from({ length: n }, () => upload(u)))).filter((r) => !r.error).length;
    // 60 at once from a member with none today: exactly 30 land.
    const day = await make("photos-burst-day");
    expect(await burst(day, 60)).toBe(PHOTO_LIMITS.perDay);
    expect(stored(day.id)).toBe(PHOTO_LIMITS.perDay);
    // 20 at once with room for 5: exactly 5 land, never more than 500 in total.
    const total = await make("photos-burst-total");
    seed(total.id, PHOTO_LIMITS.total - 5);
    expect(await burst(total, 20)).toBe(5);
    expect(stored(total.id)).toBe(PHOTO_LIMITS.total);
  });

  describe("exact byte limit at the boundary (migration 099; triggers installed)", () => {
    const jpegOf = (bytes: number) => {
      const b = Buffer.alloc(bytes);
      b[0] = 0xff;
      b[1] = 0xd8;
      return b;
    };
    const send = async (u: TestUser, bytes: number, declare = bytes) => {
      const name = `${u.id}/${crypto.randomUUID()}.jpg`;
      await reserveUpload(u.client, BUCKET, name, declare);
      return !(await u.client.storage.from(BUCKET).upload(name, jpegOf(bytes), { contentType: "image/jpeg", upsert: false })).error;
    };
    const used = (u: TestUser) => Number(sql(`select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = '${BUCKET}' and name like '${u.id}/%'`)[0]![0]);

    it("a file that lands exactly on the limit is accepted; one byte more is refused", async () => {
      const m = await make("photos-exact");
      seed(m.id, 1, { bytes: PHOTO_LIMITS.totalBytes - 1000 });
      expect(await send(m, 1001)).toBe(false); // would pass the limit by one byte
      expect(used(m)).toBe(PHOTO_LIMITS.totalBytes - 1000);
      expect(await send(m, 1000)).toBe(true); // exactly at the limit
      expect(used(m)).toBe(PHOTO_LIMITS.totalBytes);
      expect(await send(m, 1)).toBe(false); // full
    });

    it("a client that declares a smaller size than it sends is still refused by the real size (no overshoot)", async () => {
      const m = await make("photos-liar");
      seed(m.id, 1, { bytes: PHOTO_LIMITS.totalBytes - 1000 });
      expect(await send(m, 5000, 10)).toBe(false);
      expect(used(m)).toBe(PHOTO_LIMITS.totalBytes - 1000);
    });

    it("simultaneous uploads near the limit: exactly as many land as fit, and the total never passes it", async () => {
      const m = await make("photos-exact-burst");
      seed(m.id, 1, { bytes: PHOTO_LIMITS.totalBytes - 3000 });
      // 10 at once, all holding a reservation (granted here directly: reservations alone would allow only one this
      // close to the limit, counting each pending upload as a full 8 MB), so the real-size check on the row written
      // decides under contention.
      const names = Array.from({ length: 10 }, () => `${m.id}/${crypto.randomUUID()}.jpg`);
      sql(`insert into public.storage_upload_reservations (bucket_id, name, user_id, expires_at)
           select '${BUCKET}', n, '${m.id}', now() + interval '15 minutes' from unnest(array[${names.map((n) => `'${n}'`).join(",")}]) n`);
      const results = await Promise.all(names.map(async (n) => !(await m.client.storage.from(BUCKET).upload(n, jpegOf(1000), { contentType: "image/jpeg", upsert: false })).error));
      expect(results.filter(Boolean)).toHaveLength(3);
      expect(used(m)).toBe(PHOTO_LIMITS.totalBytes);
    });
  });

  it("one member at the limit doesn't affect another member", async () => {
    const full = await make("photos-full");
    const other = await make("photos-other");
    seed(full.id, PHOTO_LIMITS.total);
    expect((await upload(full)).error).not.toBeNull();
    expect((await upload(other)).error).toBeNull();
  });
});
