import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BODY_SCAN_BUCKET, SCAN_POSES, type ScanMeasurement, type ScanPose, type ScanSummary } from "@/lib/domain/body-scan";

/** Signed links are short-lived; pages re-sign on every render. */
export const SCAN_URL_TTL_SECONDS = 600;

type ScanRow = {
  id: string;
  taken_on: string;
  weight_kg: number | string | null;
  note: string | null;
  measurement: { waist_cm: number | null; chest_cm: number | null; hips_cm: number | null; arm_cm: number | null; thigh_cm: number | null } | null;
  photos: { pose: ScanPose; storage_path: string }[];
};

/** The member's scans, newest first, with short-lived signed links (row and storage policies both apply). */
export async function listBodyScans(supabase: SupabaseClient, userId: string, limit = 200): Promise<ScanSummary[]> {
  const { data, error } = await supabase
    .from("body_scans")
    .select("id, taken_on, weight_kg, note, measurement:measurement_entries(waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm), photos:body_scan_photos(pose, storage_path)")
    .eq("user_id", userId)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ScanRow[];
  const paths = rows.flatMap((r) => r.photos.map((p) => p.storage_path));
  const urls = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data: signed, error: sErr } = await supabase.storage.from(BODY_SCAN_BUCKET).createSignedUrls(paths.slice(i, i + 100), SCAN_URL_TTL_SECONDS);
    if (sErr) throw sErr;
    for (const s of signed ?? []) if (s.signedUrl && !s.error && s.path) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => {
    const m = r.measurement;
    const measurements: Partial<Record<ScanMeasurement, number>> = {};
    if (m) {
      for (const [k, col] of [
        ["waist", m.waist_cm],
        ["chest", m.chest_cm],
        ["hips", m.hips_cm],
        ["arm", m.arm_cm],
        ["thigh", m.thigh_cm],
      ] as const) {
        if (col != null) measurements[k] = Number(col);
      }
    }
    const photos: Partial<Record<ScanPose, string | null>> = {};
    for (const p of r.photos) if ((SCAN_POSES as readonly string[]).includes(p.pose)) photos[p.pose] = urls.get(p.storage_path) ?? null;
    return { id: r.id, takenOn: r.taken_on, weightKg: r.weight_kg == null ? null : Number(r.weight_kg), measurements, photos, note: r.note };
  });
}

export interface BodyTrends {
  weights: { date: string; kg: number }[];
  measurements: { date: string; waist: number | null; chest: number | null; hips: number | null; arm: number | null; thigh: number | null }[];
}

/** Body weight and measurement history (all entries, not only those saved with a scan), oldest first. */
export async function loadBodyTrends(supabase: SupabaseClient, userId: string, since: string): Promise<BodyTrends> {
  const [w, m] = await Promise.all([
    supabase.from("weight_entries").select("recorded_on, weight_kg").eq("user_id", userId).gte("recorded_on", since).order("recorded_on").limit(1000),
    supabase.from("measurement_entries").select("recorded_on, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm").eq("user_id", userId).gte("recorded_on", since).order("recorded_on").limit(1000),
  ]);
  if (w.error) throw w.error;
  if (m.error) throw m.error;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    weights: (w.data ?? []).map((r) => ({ date: r.recorded_on as string, kg: Number(r.weight_kg) })),
    measurements: (m.data ?? []).map((r) => ({ date: r.recorded_on as string, waist: n(r.waist_cm), chest: n(r.chest_cm), hips: n(r.hips_cm), arm: n(r.arm_cm), thigh: n(r.thigh_cm) })),
  };
}

/** Delete every scan object under "<userId>/" in the scans bucket with the member's own session. */
export async function removeOwnScanFiles(supabase: SupabaseClient, userId: string, scanId?: string): Promise<void> {
  const folders = scanId ? [`${userId}/${scanId}`] : await scanFolders(supabase, userId);
  for (const folder of folders) {
    const { data, error } = await supabase.storage.from(BODY_SCAN_BUCKET).list(folder, { limit: 100 });
    if (error) throw error;
    const files = (data ?? []).filter((f) => f.id != null).map((f) => `${folder}/${f.name}`);
    if (files.length) {
      const { error: rmErr } = await supabase.storage.from(BODY_SCAN_BUCKET).remove(files);
      if (rmErr) throw rmErr;
    }
  }
}

async function scanFolders(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BODY_SCAN_BUCKET).list(userId, { limit: 100, offset });
    if (error) throw error;
    for (const item of data ?? []) if (item.id == null) out.push(`${userId}/${item.name}`);
    if (!data || data.length < 100) break;
  }
  return out;
}
