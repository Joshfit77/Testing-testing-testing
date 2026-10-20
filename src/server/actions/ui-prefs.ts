"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const prefsSchema = z
  .object({
    textSize: z.enum(["default", "large", "xlarge"]).optional(),
    reduceMotion: z.boolean().optional(),
    homeScripture: z.boolean().optional(),
  })
  .refine((v) => v.textSize !== undefined || v.reduceMotion !== undefined || v.homeScripture !== undefined, "Nothing to save");

export type UiPrefsInput = z.infer<typeof prefsSchema>;

/** Save one or more display/Faith preferences for the signed-in user. */
export async function updateUiPrefsAction(input: UiPrefsInput): Promise<ActionState> {
  const user = await requireUser();
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return actionError("Couldn't save that setting.");
  const row: Record<string, unknown> = {};
  if (parsed.data.textSize !== undefined) row.text_size = parsed.data.textSize;
  if (parsed.data.reduceMotion !== undefined) row.reduce_motion = parsed.data.reduceMotion;
  if (parsed.data.homeScripture !== undefined) row.home_scripture = parsed.data.homeScripture;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) {
    logError("profile.uiPrefs", error);
    return actionError("Couldn't save that setting. Please try again.");
  }
  revalidatePath("/", "layout");
  return actionOk("Saved.");
}
