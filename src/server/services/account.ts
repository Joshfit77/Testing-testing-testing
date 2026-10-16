import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROGRESS_PHOTO_BUCKET } from "@/lib/domain/progress-photos";

/** How long the photo download links in an export stay valid. */
const EXPORT_PHOTO_URL_TTL_SECONDS = 60 * 60;

/** Tables containing the user's own rows (all readable by the user under RLS). */
const USER_TABLES: { table: string; column: string }[] = [
  { table: "profiles", column: "id" },
  { table: "onboarding_answers", column: "user_id" },
  { table: "fitness_goals", column: "user_id" },
  { table: "user_programs", column: "user_id" },
  { table: "training_programs", column: "owner_id" },
  { table: "workout_sessions", column: "user_id" },
  { table: "workout_exercises", column: "user_id" },
  { table: "workout_sets", column: "user_id" },
  { table: "personal_records", column: "user_id" },
  { table: "weight_entries", column: "user_id" },
  { table: "measurement_entries", column: "user_id" },
  { table: "recovery_checkins", column: "user_id" },
  { table: "foods", column: "owner_id" },
  { table: "meals", column: "user_id" },
  { table: "meal_items", column: "user_id" },
  { table: "nutrition_goals", column: "user_id" },
  { table: "water_entries", column: "user_id" },
  { table: "ai_conversations", column: "user_id" },
  { table: "ai_messages", column: "user_id" },
  { table: "ai_usage_events", column: "user_id" },
  { table: "faith_journal_entries", column: "user_id" },
  { table: "discipline_goals", column: "user_id" },
  { table: "discipline_checkins", column: "user_id" },
  { table: "progress_photos", column: "user_id" },
  { table: "subscriptions", column: "user_id" },
  { table: "user_entitlements", column: "user_id" },
];

export async function exportUserData(supabase: SupabaseClient, userId: string, email: string | undefined) {
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    format: "narrow-gate-fitness/export@1",
    account: { id: userId, email },
  };
  for (const { table, column } of USER_TABLES) {
    const rows: unknown[] = [];
    // Page through large tables.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").eq(column, userId).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    out[table] = rows;
  }
  try {
    out.progress_photo_files = await progressPhotoLinks(supabase, (out.progress_photos as { storage_path: string }[]) ?? []);
  } catch {
    out.progress_photo_files = { note: "Download links for your progress photo images couldn't be created. Try the export again.", files: [] };
  }
  return out;
}

/**
 * Image files aren't embedded in the JSON export; instead each photo gets a private,
 * time-limited download link (created with the user's own session, so storage policies apply).
 */
async function progressPhotoLinks(supabase: SupabaseClient, rows: { storage_path: string }[]) {
  const expiresAt = new Date(Date.now() + EXPORT_PHOTO_URL_TTL_SECONDS * 1000).toISOString();
  const note = `Image files are not included in this file. Each link below downloads one of your photos and expires at ${expiresAt}. Export again for fresh links.`;
  if (!rows.length) return { note, files: [] };
  const files: { storage_path: string; download_url: string | null }[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const paths = rows.slice(i, i + 100).map((r) => r.storage_path);
    const { data, error } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).createSignedUrls(paths, EXPORT_PHOTO_URL_TTL_SECONDS, { download: true });
    if (error) throw error;
    const byPath = new Map((data ?? []).map((d) => [d.path, d.error ? null : d.signedUrl]));
    for (const p of paths) files.push({ storage_path: p, download_url: byPath.get(p) ?? null });
  }
  return { note, expires_at: expiresAt, files };
}

/** Buckets holding per-user objects under "<uid>/...". Storage objects don't cascade with the user. */
export const USER_STORAGE_BUCKETS = ["avatars", PROGRESS_PHOTO_BUCKET] as const;

/**
 * Remove every object under "<userId>/" in a bucket (recursing into sub-folders).
 * Requires a client allowed to list/delete there — the service-role client during account deletion.
 */
export async function removeUserFolder(admin: SupabaseClient, bucket: string, userId: string): Promise<number> {
  let removed = 0;
  const walk = async (prefix: string): Promise<void> => {
    // Removing while paging shifts offsets, so collect first, then delete.
    const files: string[] = [];
    const folders: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      // A bucket that was never created holds nothing to delete.
      if (error && /bucket not found/i.test(error.message)) return;
      if (error) throw error;
      for (const item of data ?? []) {
        // Folders come back without an id.
        if (item.id == null) folders.push(`${prefix}/${item.name}`);
        else files.push(`${prefix}/${item.name}`);
      }
      if (!data || data.length < 100) break;
    }
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw error;
      removed += batch.length;
    }
    for (const f of folders) await walk(f);
  };
  await walk(userId);
  return removed;
}

/** Delete all of a user's storage objects (avatars, progress photos). Service-role client only. */
export async function removeUserStorage(admin: SupabaseClient, userId: string): Promise<void> {
  for (const bucket of USER_STORAGE_BUCKETS) await removeUserFolder(admin, bucket, userId);
}
