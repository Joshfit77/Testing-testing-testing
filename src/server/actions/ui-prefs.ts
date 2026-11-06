"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { FAITH_SECTIONS, HOME_MODULES } from "@/lib/layout-prefs";

const prefsSchema = z
  .object({
    textSize: z.enum(["default", "large", "xlarge"]).optional(),
    reduceMotion: z.boolean().optional(),
    homeScripture: z.boolean().optional(),
    /** Bible reader: words of Jesus in red. */
    redLetters: z.boolean().optional(),
    /** Bible reader: dark or light reading page. */
    biblePageTheme: z.enum(["dark", "light"]).optional(),
    /** Home modules order/hidden and Faith sections hidden (src/lib/layout-prefs.ts); replaces the stored layout. */
    layout: z
      .object({
        home: z.object({ order: z.array(z.enum(HOME_MODULES)).max(20).optional(), hidden: z.array(z.enum(HOME_MODULES)).max(20).optional() }).optional(),
        faith: z.object({ hidden: z.array(z.enum(FAITH_SECTIONS)).max(20).optional() }).optional(),
      })
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to save");

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
  if (parsed.data.redLetters !== undefined) row.bible_red_letters = parsed.data.redLetters;
  if (parsed.data.biblePageTheme !== undefined) row.bible_page_theme = parsed.data.biblePageTheme;
  if (parsed.data.layout !== undefined) row.layout_prefs = parsed.data.layout;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) {
    logError("profile.uiPrefs", error);
    return actionError("Couldn't save that setting. Please try again.");
  }
  revalidatePath("/", "layout");
  return actionOk("Saved.");
}
