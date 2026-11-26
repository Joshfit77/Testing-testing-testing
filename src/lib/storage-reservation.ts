import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reserve one photo upload before sending it (migration 20261127000097). The photo buckets only accept a file the
 * member reserved first; the reservation is taken under the member's lock, so simultaneous uploads can't pass the
 * photo limits together, whether or not the hosted project allows storage triggers.
 *
 * - `ok`: upload now (the reservation lasts 15 minutes; reserving the same name again refreshes it).
 * - `limit`: a photo limit is reached; show the bucket's limit message.
 * - `error`: the request failed (offline, server error); the upload would fail too.
 * - `unchecked`: the database doesn't have reservations yet (the web app is deployed before the migration): upload
 *   as before; a refusal then is the older limit rule.
 */
export type ReserveResult = "ok" | "limit" | "error" | "unchecked";

export async function reserveUpload(supabase: SupabaseClient, bucket: "progress-photos" | "body-scans", path: string): Promise<ReserveResult> {
  try {
    const { data, error } = await supabase.rpc("reserve_storage_upload", { p_bucket: bucket, p_name: path });
    if (error) return isMissingFunction(error) ? "unchecked" : "error";
    return data === "limit" ? "limit" : data === "ok" ? "ok" : "error";
  } catch {
    return "error";
  }
}

function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

/**
 * The upload was refused because a file with this name already exists. Both photo screens upload to a random name in
 * the member's own folder and keep it across retries, so this means an earlier attempt's upload went through and only
 * its reply was lost: treat the file as uploaded and carry on to save it.
 */
export function alreadyUploaded(error: { statusCode?: string | number; code?: string; error?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return String(error.statusCode ?? "") === "409" || error.code === "KeyAlreadyExists" || error.error === "Duplicate" || /already exists/i.test(error.message ?? "");
}

/** Shown when an upload with a granted reservation is refused anyway (it took too long, or the request was cut short). */
export const UPLOAD_RETRY_MESSAGE = "That upload didn't finish. Please try again.";
