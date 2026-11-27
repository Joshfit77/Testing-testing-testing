import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, reserveUpload, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { SCAN_PHOTO_LIMIT_MESSAGE, SCAN_PHOTO_LIMITS, scanUploadErrorMessage } from "@/lib/domain/body-scan";

/**
 * Body Scan photo upload limits (migration 20261125000088), against the real storage server: a Pro member with consent
 * who already has 750 photos in the body-scans bucket, 30 uploads in the last 24 hours, or 2 GiB stored can't upload
 * another, even calling the storage API directly. The existing rules (own folder, Pro, consent) still apply, nothing
 * stored is removed, other members aren't affected, and deleting frees room. Existing photos are set up with SQL.
 */
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const BUCKET = "body-scans";
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
       select '${BUCKET}', '${userId}/seed/' || i || '.jpg', '${userId}', jsonb_build_object('size', ${bytes}, 'mimetype', 'image/jpeg'),
              now() - interval '${age} hours'
       from generate_series(1, ${count}) i`);
}
const stored = (userId: string) => Number(sql(`select count(*) from storage.objects where bucket_id = '${BUCKET}' and name like '${userId}/%'`)[0]![0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
// Like the app: reserve the file, then upload it. When the reservation is refused (a limit) the upload is still sent,
// to show the storage rule refuses it too.
const upload = async (user: TestUser, name = `${crypto.randomUUID()}/front-${crypto.randomUUID()}.jpg`) => {
  await reserveUpload(user.client, BUCKET, `${user.id}/${name}`);
  return user.client.storage.from(BUCKET).upload(`${user.id}/${name}`, JPEG, { contentType: "image/jpeg", upsert: false });
};

describe.skipIf(!available)("body scan photo upload limits", () => {
  const users: TestUser[] = [];
  /** A Pro member who has consented to Body Scan. */
  const make = async (label: string) => {
    const u = await createTestUser(label);
    users.push(u);
    await grantPlan(u, "pro");
    expect((await u.client.from("profiles").update({ body_scan_consent_at: new Date().toISOString() }).eq("id", u.id)).error).toBeNull();
    return u;
  };
  beforeAll(() => {
    expect(sql("select 1")[0]![0]).toBe("1");
  });
  afterAll(async () => {
    const admin = serviceClient();
    for (const u of users) {
      const real = sql(`select name from storage.objects where bucket_id = '${BUCKET}' and name like '${u.id}/%' and name not like '${u.id}/seed/%'`).map((r) => r[0]!);
      if (real.length) await admin.storage.from(BUCKET).remove(real);
      sql(`set storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = '${BUCKET}' and name like '${u.id}/seed/%'`);
      await deleteTestUser(u);
    }
  });

  it("the rule and the app use the same numbers, and both layers are installed", () => {
    const migration = readFileSync("supabase/migrations/20261125000088_body_scan_photo_quota.sql", "utf8");
    expect(migration).toContain(`return v_count < ${SCAN_PHOTO_LIMITS.total} and v_today < ${SCAN_PHOTO_LIMITS.perDay} and v_bytes < ${SCAN_PHOTO_LIMITS.totalBytes};`);
    expect(sql(`select count(*) from pg_policies where schemaname = 'storage' and policyname = 'body_scans_owner_insert'
                and with_check like '%can_add_body_scan()%' and with_check like '%can_add_body_scan_photo()%'`)[0]![0]).toBe("1");
    expect(sql(`select count(*) from pg_trigger where tgname = 'body_scan_photos_quota' and tgrelid = 'storage.objects'::regclass and tgenabled = 'O'`)[0]![0]).toBe("1");
  });

  it("Pro with consent uploads as before; without consent, or into someone else's folder, still refused", async () => {
    const a = await make("scanq-a");
    const b = await make("scanq-b");
    expect((await upload(a)).error).toBeNull();
    const intoB = await a.client.storage.from(BUCKET).upload(`${b.id}/${crypto.randomUUID()}/front.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(intoB.error).not.toBeNull();
    await b.client.from("profiles").update({ body_scan_consent_at: null }).eq("id", b.id);
    expect((await upload(b)).error).not.toBeNull();
  });

  it("at 750 stored photos a new upload is refused, nothing is removed, and deleting one frees room", async () => {
    const m = await make("scanq-750");
    seed(m.id, SCAN_PHOTO_LIMITS.total - 1);
    const lastName = `${crypto.randomUUID()}/front-last.jpg`;
    expect((await upload(m, lastName)).error).toBeNull();
    expect(stored(m.id)).toBe(SCAN_PHOTO_LIMITS.total);

    const refused = await upload(m);
    expect(refused.error).not.toBeNull();
    expect(scanUploadErrorMessage(refused.error as never, true)).toBe(SCAN_PHOTO_LIMIT_MESSAGE);
    expect(stored(m.id)).toBe(SCAN_PHOTO_LIMITS.total);

    expect((await m.client.storage.from(BUCKET).remove([`${m.id}/${lastName}`])).error).toBeNull();
    expect((await upload(m)).error).toBeNull();
  });

  it("30 uploads in the last 24 hours: refused until they are older than a day", async () => {
    const m = await make("scanq-day");
    seed(m.id, SCAN_PHOTO_LIMITS.perDay, { ageHours: 1 });
    expect((await upload(m)).error).not.toBeNull();
    sql(`update storage.objects set created_at = now() - interval '25 hours' where bucket_id = '${BUCKET}' and name like '${m.id}/seed/%'`);
    expect((await upload(m)).error).toBeNull();
  });

  it("2 GiB stored in total: refused, whatever the number of photos", async () => {
    const m = await make("scanq-bytes");
    seed(m.id, 1, { bytes: SCAN_PHOTO_LIMITS.totalBytes });
    expect((await upload(m)).error).not.toBeNull();
    sql(`update storage.objects set metadata = jsonb_set(metadata, '{size}', '300000') where bucket_id = '${BUCKET}' and name like '${m.id}/seed/%'`);
    expect((await upload(m)).error).toBeNull();
  });

  it("simultaneous uploads can't slip past the limits", async () => {
    const burst = async (u: TestUser, n: number) => (await Promise.all(Array.from({ length: n }, () => upload(u)))).filter((r) => !r.error).length;
    const day = await make("scanq-burst-day");
    expect(await burst(day, 60)).toBe(SCAN_PHOTO_LIMITS.perDay);
    expect(stored(day.id)).toBe(SCAN_PHOTO_LIMITS.perDay);
    const total = await make("scanq-burst-total");
    seed(total.id, SCAN_PHOTO_LIMITS.total - 5);
    expect(await burst(total, 20)).toBe(5);
    expect(stored(total.id)).toBe(SCAN_PHOTO_LIMITS.total);
  });

  it("the progress-photo limit and the Body Scan limit are counted separately", async () => {
    const m = await make("scanq-separate");
    sql(`insert into storage.objects (bucket_id, name, owner, metadata, created_at)
         select 'progress-photos', '${m.id}/seed-' || i || '.jpg', '${m.id}', jsonb_build_object('size', 300000), now() - interval '48 hours'
         from generate_series(1, 500) i`);
    try {
      expect((await upload(m)).error).toBeNull();
    } finally {
      sql(`set storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = 'progress-photos' and name like '${m.id}/seed-%'`);
    }
  });
});
