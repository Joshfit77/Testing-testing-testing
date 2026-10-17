"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupplement, SUPPLEMENT_IDS } from "@/data/supplements";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const supplementId = z.string().refine((v) => SUPPLEMENT_IDS.includes(v), "Unknown supplement");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
/** How far back a dose can be checked off. */
const MAX_BACKFILL_DAYS = 30;

function revalidate() {
  revalidatePath("/nutrition/supplements");
}

export async function addToStackAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ supplementId }).safeParse(input);
  if (!parsed.success) return actionInvalid(parsed.error);
  const s = getSupplement(parsed.data.supplementId)!;
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("supplement_stack")
    .upsert({ user_id: user.id, supplement_id: s.id }, { onConflict: "user_id,supplement_id", ignoreDuplicates: true });
  if (error) {
    logError("supplements.add", error);
    return actionError("Couldn't add it to your stack. Please try again.");
  }
  revalidate();
  return actionOk(`${s.name} added to your stack.`);
}

export async function removeFromStackAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ supplementId }).safeParse(input);
  if (!parsed.success) return actionInvalid(parsed.error);
  const s = getSupplement(parsed.data.supplementId)!;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("supplement_stack").delete().eq("user_id", user.id).eq("supplement_id", s.id);
  if (error) {
    logError("supplements.remove", error);
    return actionError("Couldn't remove it from your stack. Please try again.");
  }
  revalidate();
  return actionOk(`${s.name} removed from your stack.`);
}

/** Check a supplement off for a day, or un-check it if it was already logged. */
export async function toggleTakenAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ supplementId, date: isoDate.optional() }).safeParse(input);
  if (!parsed.success) return actionInvalid(parsed.error);
  const s = getSupplement(parsed.data.supplementId)!;
  const profile = await getProfile(user.id);
  const today = isoDateInTz(new Date(), profile?.timezone || "UTC");
  const date = parsed.data.date ?? today;
  if (date > today) return actionError("You can't check off a future day.");
  if (date < addDays(today, -MAX_BACKFILL_DAYS)) return actionError(`You can only check off the last ${MAX_BACKFILL_DAYS} days.`);

  const supabase = await getServerSupabase();
  const { data: existing, error: readErr } = await supabase
    .from("supplement_logs")
    .select("supplement_id")
    .eq("user_id", user.id)
    .eq("supplement_id", s.id)
    .eq("taken_on", date)
    .maybeSingle();
  if (readErr) {
    logError("supplements.toggle.read", readErr);
    return actionError("Couldn't update your check-off. Please try again.");
  }
  if (existing) {
    const { error } = await supabase.from("supplement_logs").delete().eq("user_id", user.id).eq("supplement_id", s.id).eq("taken_on", date);
    if (error) {
      logError("supplements.toggle.delete", error);
      return actionError("Couldn't update your check-off. Please try again.");
    }
    revalidate();
    return actionOk(`${s.name} marked as not taken.`);
  }
  const { error } = await supabase
    .from("supplement_logs")
    .upsert({ user_id: user.id, supplement_id: s.id, taken_on: date }, { onConflict: "user_id,supplement_id,taken_on", ignoreDuplicates: true });
  if (error) {
    logError("supplements.toggle.insert", error);
    return actionError("Couldn't update your check-off. Please try again.");
  }
  revalidate();
  return actionOk(`${s.name} checked off${date === today ? " for today" : ""}.`);
}
