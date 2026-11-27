"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const schema = z.object({ sound: z.boolean(), vibrate: z.boolean() });

/** Rest-timer alerts in the workout logger: an optional beep and/or vibration when rest ends. */
export async function updateRestAlertsAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return actionError("Couldn't save that setting.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ rest_timer_sound: parsed.data.sound, rest_timer_vibrate: parsed.data.vibrate }).eq("id", user.id);
  if (error) {
    logError("profile.restAlerts", error);
    return actionError("Couldn't save that setting. Please try again.");
  }
  return actionOk("Saved.");
}
