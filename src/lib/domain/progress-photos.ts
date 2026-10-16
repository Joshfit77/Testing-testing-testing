/** Progress photos: shared constants, types and pure helpers (safe for client and server). */

export const PROGRESS_PHOTO_BUCKET = "progress-photos";
export const PHOTO_POSES = ["front", "side", "back", "other"] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];
export const PHOTO_NOTE_MAX = 280;
/** Longest edge after client-side downscaling. */
export const PHOTO_MAX_DIMENSION = 1600;
/** Matches the bucket's file_size_limit. */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export interface ProgressPhotoView {
  id: string;
  takenOn: string;
  pose: PhotoPose;
  weightKg: number | null;
  note: string | null;
  /** Short-lived signed URL; null if one couldn't be created. */
  url: string | null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Storage path for a new photo: always inside the owner's own folder. */
export function photoPathFor(userId: string, fileId: string): string {
  return `${userId}/${fileId}.jpg`;
}

/** True only for "<userId>/<uuid>.<jpg|jpeg|png|webp>" — no traversal, no other folders. */
export function isOwnPhotoPath(userId: string, path: string): boolean {
  if (!new RegExp(`^${UUID}$`, "i").test(userId)) return false;
  return new RegExp(`^${userId.toLowerCase()}/${UUID}\\.(jpg|jpeg|png|webp)$`).test(path);
}

/** Scale (w, h) to fit within `max` on the longest edge, never upscaling. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_DIMENSION): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Before/after ordering and the differences shown in compare mode. */
export function comparePhotos<T extends Pick<ProgressPhotoView, "takenOn" | "weightKg">>(a: T, b: T): { before: T; after: T; days: number; weightDeltaKg: number | null } {
  const [before, after] = a.takenOn <= b.takenOn ? [a, b] : [b, a];
  const days = Math.round((Date.parse(`${after.takenOn}T00:00:00Z`) - Date.parse(`${before.takenOn}T00:00:00Z`)) / 86_400_000);
  const weightDeltaKg = before.weightKg != null && after.weightKg != null ? Math.round((after.weightKg - before.weightKg) * 100) / 100 : null;
  return { before, after, days, weightDeltaKg };
}
