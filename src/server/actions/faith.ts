"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { disciplineGoalSchema, journalEntrySchema } from "@/lib/validation/schemas";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const uuid = z.string().uuid();

export async function setFaithEnabledAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  await supabase.from("profiles").update({ faith_enabled: formData.get("enabled") === "true" }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function saveJournalEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = journalEntrySchema.safeParse({ ...raw, theme: raw.theme ? raw.theme : null });
  if (!parsed.success) return actionInvalid(parsed.error);
  const id = uuid.safeParse(formData.get("id"));
  const supabase = await getServerSupabase();
  const row = {
    entry_date: parsed.data.entryDate,
    theme: parsed.data.theme,
    scripture_ref: parsed.data.scriptureRef || null,
    title: parsed.data.title || null,
    body: parsed.data.body,
  };
  const { error } = id.success
    ? await supabase.from("faith_journal_entries").update(row).eq("id", id.data).eq("user_id", user.id)
    : await supabase.from("faith_journal_entries").insert({ ...row, user_id: user.id });
  if (error) {
    logError("faith.journal", error);
    return actionError("Couldn't save your entry.");
  }
  revalidatePath("/faith");
  return actionOk(id.success ? "Entry updated." : "Entry saved. Only you can see it.");
}

export async function deleteJournalEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("faith_journal_entries").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/faith");
}

export async function createDisciplineGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = disciplineGoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const supabase = await getServerSupabase();
  const { count } = await supabase.from("discipline_goals").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true);
  if ((count ?? 0) >= 12) return actionError("You can have up to 12 active discipline goals.");
  const { error } = await supabase.from("discipline_goals").insert({ user_id: user.id, ...parsed.data });
  if (error) return actionError("Couldn't add the goal.");
  revalidatePath("/faith");
  return actionOk("Goal added.");
}

export async function toggleDisciplineCheckinAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("goalId"));
  if (!id.success) return;
  const profile = await getProfile(user.id);
  const supabase = await getServerSupabase();
  const { data: goal } = await supabase.from("discipline_goals").select("cadence").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!goal) return;
  const today = isoDateInTz(new Date(), profile?.timezone ?? "UTC");
  const day = goal.cadence === "weekly" ? startOfWeek(today) : today;
  const { data: existing } = await supabase.from("discipline_checkins").select("goal_id").eq("goal_id", id.data).eq("checked_on", day).maybeSingle();
  if (existing) await supabase.from("discipline_checkins").delete().eq("goal_id", id.data).eq("checked_on", day).eq("user_id", user.id);
  else await supabase.from("discipline_checkins").insert({ goal_id: id.data, user_id: user.id, checked_on: day });
  revalidatePath("/faith");
}

export async function archiveDisciplineGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("goalId"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("discipline_goals").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/faith");
}
