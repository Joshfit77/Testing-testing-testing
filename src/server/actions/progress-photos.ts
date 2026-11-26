"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { isoDateInTz } from "@/lib/domain/dates";
import { isOwnPhotoPath, PHOTO_NOTE_MAX, PHOTO_POSES, PROGRESS_PHOTO_BUCKET } from "@/lib/domain/progress-photos";
import { toKg } from "@/lib/domain/units";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

/** `uncertain`: the save may have gone through (the database didn't answer clearly), so the file is kept for a retry. */
type Result = { ok: true } | { ok: false; error: string; uncertain?: true };

/**
 * The database answered with an error, so the insert's transaction rolled back and the row was NOT written (a refused
 * value or rule, but also a timeout, deadlock or serialization failure: each carries a Postgres or PostgREST code).
 * Only a reply with no code (the request or its answer was lost on the way) leaves it uncertain whether the row exists,
 * and only then must the uploaded file stay: removing it could leave a saved photo without its image.
 */
function definitelyNotWritten(error: { code?: string }): boolean {
  return Boolean(error.code);
}

const savePhotoSchema = z.object({
  path: z.string().min(3).max(300),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  pose: z.enum(PHOTO_POSES),
  note: z.string().trim().max(PHOTO_NOTE_MAX).optional().default(""),
  /** In the user's display unit; blank = use that day's bodyweight entry if there is one. */
  weight: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().positive().max(1000).nullable()),
});

/**
 * Record a photo the browser has already uploaded to the private bucket under the user's folder.
 * The path must be inside "<uid>/" and the object must actually exist.
 */
export async function saveProgressPhotoAction(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = savePhotoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some photo details are invalid." };
  const v = parsed.data;
  if (!isOwnPhotoPath(user.id, v.path)) return { ok: false, error: "Invalid photo upload." };

  const profile = await getProfile(user.id);
  const units = profile?.unit_system ?? "imperial";
  const today = isoDateInTz(new Date(), profile?.timezone ?? "UTC");
  if (v.takenOn > today) return { ok: false, error: "The photo date can't be in the future." };

  const supabase = await getServerSupabase();
  const fileName = v.path.slice(v.path.indexOf("/") + 1);
  const { data: found, error: listErr } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).list(user.id, { search: fileName, limit: 5 });
  if (listErr) {
    logError("progress_photos.verify", listErr);
    return { ok: false, error: "Couldn't verify the upload. Please try again." };
  }
  if (!found?.some((f) => f.name === fileName)) return { ok: false, error: "The upload didn't finish. Please try again." };

  let weightKg: number | null = null;
  if (v.weight != null) {
    weightKg = toKg(v.weight, units);
    if (weightKg < 25 || weightKg > 400) return { ok: false, error: "That weight looks out of range." };
  } else {
    const { data } = await supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).eq("recorded_on", v.takenOn).maybeSingle();
    if (data) weightKg = Number(data.weight_kg);
  }

  const { error } = await supabase.from("progress_photos").insert({
    user_id: user.id,
    storage_path: v.path,
    taken_on: v.takenOn,
    pose: v.pose,
    weight_kg: weightKg,
    note: v.note || null,
  });
  // Already saved (a second tap or a retry of the same upload): the photo is there, so keep its file.
  if (error?.code === "23505") {
    revalidatePath("/progress", "layout");
    return { ok: true };
  }
  if (error) {
    logError("progress_photos.insert", error);
    // Uncertain (no answer from the database): the row may exist, so the file stays and a retry confirms it.
    if (!definitelyNotWritten(error)) return { ok: false, error: "We couldn't confirm the save. Check your connection and tap Save again.", uncertain: true };
    // Refused: don't leave an orphaned object behind, but never delete a file a saved photo already uses (an earlier
    // attempt whose reply was lost, retried with different details).
    const { data: inUse, error: useErr } = await supabase.from("progress_photos").select("id").eq("user_id", user.id).eq("storage_path", v.path).limit(1);
    if (!useErr && !inUse?.length) await supabase.storage.from(PROGRESS_PHOTO_BUCKET).remove([v.path]);
    return { ok: false, error: "Couldn't save your photo. Please try again." };
  }
  revalidatePath("/progress", "layout");
  return { ok: true };
}

export async function deleteProgressPhotoAction(id: string): Promise<Result> {
  const user = await requireUser();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Invalid photo." };
  const supabase = await getServerSupabase();
  // The image goes first: if removing it fails, the row stays so the member can simply try again, and no private
  // image is ever left behind without a row pointing at it.
  const { data: row, error: readErr } = await supabase.from("progress_photos").select("storage_path").eq("id", parsedId.data).eq("user_id", user.id).maybeSingle();
  if (readErr) {
    logError("progress_photos.delete", readErr);
    return { ok: false, error: "Couldn't delete the photo. Please try again." };
  }
  if (!row) return { ok: false, error: "Photo not found." };
  const { error: rmErr } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).remove([row.storage_path as string]);
  if (rmErr) {
    logError("progress_photos.delete_object", rmErr);
    return { ok: false, error: "Couldn't delete the photo. Please try again." };
  }
  const { error } = await supabase.from("progress_photos").delete().eq("id", parsedId.data).eq("user_id", user.id);
  if (error) {
    logError("progress_photos.delete", error);
    return { ok: false, error: "Couldn't delete the photo. Please try again." };
  }
  revalidatePath("/progress", "layout");
  return { ok: true };
}
