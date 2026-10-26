"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BODY_SCAN_BUCKET, canUseBodyScan, isOwnScanPath, REQUIRED_POSES, SCAN_NOTE_MAX, SCAN_POSES } from "@/lib/domain/body-scan";
import { isoDateInTz } from "@/lib/domain/dates";
import { toCm, toKg } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, getUserPlan, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { removeOwnScanFiles } from "@/server/services/body-scan";

type Result = { ok: true; message: string; id?: string } | { ok: false; error: string };

/** Explicit consent to store body photos for Body Scan (Pro). Recorded with the time; withdrawn below. */
export async function giveBodyScanConsentAction(agreed: unknown): Promise<Result> {
  const user = await requireUser();
  if (agreed !== true) return { ok: false, error: "Tick the box to agree first." };
  if (!canUseBodyScan(await getUserPlan(user.id))) return { ok: false, error: "Body Scan is included with Pro." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ body_scan_consent_at: new Date().toISOString() }).eq("id", user.id);
  if (error) {
    logError("body_scan.consent", error);
    return { ok: false, error: "Couldn't save that. Try again." };
  }
  revalidatePath("/progress/body-scan", "layout");
  return { ok: true, message: "Thanks. You can take your first scan." };
}

const optional = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(min).max(max).nullable()).optional().default(null);

const saveSchema = z.object({
  id: z.string().uuid(),
  photos: z.array(z.object({ pose: z.enum(SCAN_POSES), path: z.string().min(3).max(300) })).min(2).max(3),
  /** In the member's display units. */
  weight: optional(20, 900),
  waist: optional(10, 250),
  chest: optional(10, 250),
  hips: optional(10, 250),
  arm: optional(4, 100),
  thigh: optional(8, 150),
  note: z.string().trim().max(SCAN_NOTE_MAX).optional().default(""),
});

/**
 * Record a scan whose photos the browser has already uploaded to the private bucket. Every path must be in the
 * member's folder for this scan and the object must exist. Saving the same scan id again is a no-op.
 */
export async function saveBodyScanAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some scan details are invalid." };
  const v = parsed.data;
  const poses = v.photos.map((p) => p.pose);
  if (new Set(poses).size !== poses.length) return { ok: false, error: "Each view can only be saved once." };
  if (!REQUIRED_POSES.every((p) => poses.includes(p))) return { ok: false, error: "A scan needs a front and a side photo." };
  if (!v.photos.every((p) => isOwnScanPath(user.id, v.id, p.pose, p.path))) return { ok: false, error: "Invalid photo upload." };

  const supabase = await getServerSupabase();
  const [plan, profile] = await Promise.all([getUserPlan(user.id), getProfile(user.id)]);
  const discard = async () => {
    await removeOwnScanFiles(supabase, user.id, v.id).catch((err: unknown) => logError("body_scan.discard", err));
  };

  const { data: existing } = await supabase.from("body_scans").select("id").eq("id", v.id).eq("user_id", user.id).maybeSingle();
  if (existing) return { ok: true, message: "Scan saved.", id: v.id };
  if (!canUseBodyScan(plan)) {
    await discard();
    return { ok: false, error: "Body Scan is included with Pro." };
  }
  const { data: consent } = await supabase.from("profiles").select("body_scan_consent_at").eq("id", user.id).maybeSingle();
  if (!consent?.body_scan_consent_at) {
    await discard();
    return { ok: false, error: "Agree to storing your scan photos first." };
  }

  const { data: files, error: listErr } = await supabase.storage.from(BODY_SCAN_BUCKET).list(`${user.id}/${v.id}`, { limit: 20 });
  if (listErr) {
    logError("body_scan.verify", listErr);
    return { ok: false, error: "Couldn't check the upload. Try again." };
  }
  const names = new Set((files ?? []).map((f) => `${user.id}/${v.id}/${f.name}`));
  if (!v.photos.every((p) => names.has(p.path))) return { ok: false, error: "A photo didn't finish uploading. Try again." };

  const units = profile?.unit_system ?? "imperial";
  const today = isoDateInTz(new Date(), profile?.timezone ?? "UTC");
  const cm = (n: number | null) => (n == null ? null : Math.round(toCm(n, units) * 10) / 10);
  let weightKg: number | null = null;
  if (v.weight != null) {
    weightKg = Math.round(toKg(v.weight, units) * 100) / 100;
    if (weightKg < 25 || weightKg > 400) return { ok: false, error: "That weight looks out of range." };
  }

  let measurementId: string | null = null;
  const m = { waist_cm: cm(v.waist), chest_cm: cm(v.chest), hips_cm: cm(v.hips), arm_cm: cm(v.arm), thigh_cm: cm(v.thigh) };
  if (Object.values(m).some((x) => x != null)) {
    const { data: row, error } = await supabase.from("measurement_entries").insert({ user_id: user.id, recorded_on: today, ...m, notes: "Saved with a body scan" }).select("id").single();
    if (error) return { ok: false, error: error.code === "23514" ? "One of the measurements is out of range." : "Couldn't save the measurements." };
    measurementId = row.id as string;
  }
  if (weightKg != null) {
    const { error } = await supabase.from("weight_entries").upsert({ user_id: user.id, recorded_on: today, weight_kg: weightKg }, { onConflict: "user_id,recorded_on" });
    if (error) logError("body_scan.weight", error);
  }

  const { error: scanErr } = await supabase.from("body_scans").insert({ id: v.id, user_id: user.id, taken_on: today, weight_kg: weightKg, measurement_id: measurementId, note: v.note || null });
  if (scanErr?.code === "23505") return { ok: true, message: "Scan saved.", id: v.id };
  if (scanErr) {
    logError("body_scan.insert", scanErr);
    if (measurementId) await supabase.from("measurement_entries").delete().eq("id", measurementId);
    await discard();
    return { ok: false, error: scanErr.message.includes("body_scan_limit") ? "You've reached 200 scans. Delete older scans to add more." : "Couldn't save the scan. Try again." };
  }
  const { error: photoErr } = await supabase.from("body_scan_photos").insert(v.photos.map((p) => ({ scan_id: v.id, user_id: user.id, pose: p.pose, storage_path: p.path })));
  if (photoErr) {
    logError("body_scan.photos", photoErr);
    await supabase.from("body_scans").delete().eq("id", v.id);
    if (measurementId) await supabase.from("measurement_entries").delete().eq("id", measurementId);
    await discard();
    return { ok: false, error: "Couldn't save the scan. Try again." };
  }
  revalidatePath("/progress", "layout");
  return { ok: true, message: "Scan saved.", id: v.id };
}

/** Delete one scan: its rows and its photo files. Measurements saved with it stay in the measurement history. */
export async function deleteBodyScanAction(id: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid scan." };
  const supabase = await getServerSupabase();
  const { data: scan, error: readErr } = await supabase.from("body_scans").select("id").eq("id", parsed.data).eq("user_id", user.id).maybeSingle();
  if (readErr) {
    logError("body_scan.delete", readErr);
    return { ok: false, error: "Couldn't delete the scan. Try again." };
  }
  if (!scan) return { ok: false, error: "Scan not found." };
  // Photo files first: if removing them fails, the scan stays listed so it can be deleted again, and no private
  // image is ever left behind without a row pointing at it.
  try {
    await removeOwnScanFiles(supabase, user.id, parsed.data);
  } catch (err) {
    logError("body_scan.delete_files", err);
    return { ok: false, error: "Couldn't delete the scan photos. Try again." };
  }
  const { error } = await supabase.from("body_scans").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) {
    logError("body_scan.delete", error);
    return { ok: false, error: "Couldn't delete the scan. Try again." };
  }
  revalidatePath("/progress", "layout");
  return { ok: true, message: "Scan deleted." };
}

/** Withdraw consent and delete every scan and scan photo. Works on any plan. */
export async function withdrawBodyScanConsentAction(): Promise<Result> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  // Files first, then rows (see deleteBodyScanAction).
  try {
    await removeOwnScanFiles(supabase, user.id);
  } catch (err) {
    logError("body_scan.delete_all_files", err);
    return { ok: false, error: "Some scan photos couldn't be removed yet, so nothing was deleted. Try again." };
  }
  const { error } = await supabase.from("body_scans").delete().eq("user_id", user.id);
  if (error) {
    logError("body_scan.delete_all", error);
    return { ok: false, error: "Your scan photos were removed, but the scan records couldn't be deleted yet. Try again." };
  }
  await supabase.from("profiles").update({ body_scan_consent_at: null }).eq("id", user.id);
  revalidatePath("/progress", "layout");
  return { ok: true, message: "All scans and scan photos were deleted, and your consent was withdrawn." };
}
