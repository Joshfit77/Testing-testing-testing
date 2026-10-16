import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_POSES, PROGRESS_PHOTO_BUCKET, type PhotoPose, type ProgressPhotoView } from "@/lib/domain/progress-photos";

/** Signed URLs are short-lived; the page re-signs on every render. */
export const PHOTO_URL_TTL_SECONDS = 600;

/** The user's photos, newest first, with short-lived signed URLs (RLS + storage policies apply). */
export async function listProgressPhotos(supabase: SupabaseClient, userId: string, limit = 120): Promise<ProgressPhotoView[]> {
  const { data, error } = await supabase
    .from("progress_photos")
    .select("id, storage_path, taken_on, pose, weight_kg, note")
    .eq("user_id", userId)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const paths = rows.map((r) => r.storage_path as string);
  const { data: signed, error: signErr } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
  if (signErr) throw signErr;
  const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl && !s.error).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id as string,
    takenOn: r.taken_on as string,
    pose: (PHOTO_POSES as readonly string[]).includes(r.pose as string) ? (r.pose as PhotoPose) : "other",
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
    note: (r.note as string | null) ?? null,
    url: urlByPath.get(r.storage_path as string) ?? null,
  }));
}
