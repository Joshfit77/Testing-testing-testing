/**
 * Shared rules for exercise demonstration media stored in the public `exercise-media` bucket.
 * Files live at `<exercise-slug>/<name>.<ext>` (see supabase/migrations/20261016000003_storage.sql).
 */

export const EXERCISE_MEDIA_BUCKET = "exercise-media";
/** Must match the bucket's file_size_limit. */
export const EXERCISE_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const AI_MEDIA_LICENSE = "AI-generated, owned by Narrow Gate Fitness";

export const EXERCISE_MEDIA_TYPES = {
  mp4: { mime: "video/mp4", mediaType: "video" },
  webm: { mime: "video/webm", mediaType: "video" },
  jpg: { mime: "image/jpeg", mediaType: "image" },
  jpeg: { mime: "image/jpeg", mediaType: "image" },
  png: { mime: "image/png", mediaType: "image" },
  webp: { mime: "image/webp", mediaType: "image" },
} as const satisfies Record<string, { mime: string; mediaType: "image" | "video" }>;

export type ExerciseMediaExt = keyof typeof EXERCISE_MEDIA_TYPES;

export const EXERCISE_MEDIA_ACCEPT = [...new Set(Object.values(EXERCISE_MEDIA_TYPES).map((t) => t.mime))].join(",");

export function mediaExtension(filename: string): ExerciseMediaExt | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return ext in EXERCISE_MEDIA_TYPES ? (ext as ExerciseMediaExt) : null;
}

/** Extension for a browser File, from its MIME type first and then its name. */
export function extensionForMime(mime: string, filename: string): ExerciseMediaExt | null {
  const byName = mediaExtension(filename);
  if (byName && EXERCISE_MEDIA_TYPES[byName].mime === mime) return byName;
  const byMime = (Object.keys(EXERCISE_MEDIA_TYPES) as ExerciseMediaExt[]).find((k) => EXERCISE_MEDIA_TYPES[k].mime === mime);
  return byMime ?? null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * True when `path` is a file directly inside `slug`'s folder with an allowed extension
 * (no traversal, no nested folders). Returns the media type implied by the extension.
 */
export function parseExerciseMediaPath(slug: string, path: string): { ext: ExerciseMediaExt; mediaType: "image" | "video" } | null {
  if (!SLUG_RE.test(slug)) return null;
  const m = path.match(/^([a-z0-9-]+)\/([A-Za-z0-9_-]{1,80})\.([a-z0-9]{2,4})$/);
  if (!m || m[1] !== slug) return null;
  const ext = m[3] as string;
  if (!(ext in EXERCISE_MEDIA_TYPES)) return null;
  return { ext: ext as ExerciseMediaExt, mediaType: EXERCISE_MEDIA_TYPES[ext as ExerciseMediaExt].mediaType };
}

/** Public URL for a stored media object. */
export function exerciseMediaPublicUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}
