import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reserve one photo upload before sending it (migration 20261127000097). The photo buckets only accept a file the
 * member reserved first; the reservation is taken under the member's lock, so simultaneous uploads can't pass the
 * photo limits together, whether or not the hosted project allows storage triggers.
 *
 * - `ok`: upload now (the reservation lasts 15 minutes; reserving the same name again refreshes it).
 * - `limit`: a photo limit is reached; show the bucket's limit message.
 * - `error`: the request failed (offline, server error); the upload would fail too.
 *
 * While the database doesn't have the function yet (the web app is deployed before the migration), the upload goes
 * ahead as before.
 */
export type ReserveResult = "ok" | "limit" | "error";

export async function reserveUpload(supabase: SupabaseClient, bucket: "progress-photos" | "body-scans", path: string): Promise<ReserveResult> {
  try {
    const { data, error } = await supabase.rpc("reserve_storage_upload", { p_bucket: bucket, p_name: path });
    if (error) return isMissingFunction(error) ? "ok" : "error";
    return data === "limit" ? "limit" : data === "ok" ? "ok" : "error";
  } catch {
    return "error";
  }
}

function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}
