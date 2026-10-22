"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { isoDateInTz } from "@/lib/domain/dates";
import { isOwnPhotoPath, PHOTO_NOTE_MAX, PHOTO_POSES, PROGRESS_PHOTO_BUCKET } from "@/lib/domain/progress-photos";
import { toKg } from "@/lib/domain/units";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

type Result = { ok: true } | { ok: false; error: string };

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
    // Don't leave an orphaned object behind.
    await supabase.storage.from(PROGRESS_PHOTO_BUCKET).remove([v.path]);
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
  const { data, error } = await supabase.from("progress_photos").delete().eq("id", parsedId.data).eq("user_id", user.id).select("storage_path");
  if (error) {
    logError("progress_photos.delete", error);
    return { ok: false, error: "Couldn't delete the photo. Please try again." };
  }
  const row = data?.[0];
  if (!row) return { ok: false, error: "Photo not found." };
  const { error: rmErr } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).remove([row.storage_path as string]);
  // The row is gone; a leftover object stays private and is purged with the account.
  if (rmErr) logError("progress_photos.delete_object", rmErr);
  revalidatePath("/progress", "layout");
  return { ok: true };
}
