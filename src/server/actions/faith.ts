"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { isoDateInTz } from "@/lib/domain/dates";
import { canCheckIn, isPresetPractice, PRACTICE_INFO } from "@/lib/domain/practices";
import { FAITH_REMINDER_KINDS, faithReminderFromRow, normalizeWeekdays, type FaithReminder } from "@/lib/faith-reminders";
import { customPracticeSchema, faithRemindersSchema, journalEntrySchema, prayerAnsweredSchema } from "@/lib/validation/schemas";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

/*
 * Faith actions. Every query is scoped to the signed-in user (RLS plus an explicit user_id filter).
 * Clients call router.refresh() after a successful action (no revalidatePath; see IMPLEMENTATION_STATUS
 * "Loading boundaries").
 */

const uuid = z.string().uuid();
const MAX_PRACTICES = 12;

async function userToday(userId: string): Promise<string> {
  const profile = await getProfile(userId);
  return isoDateInTz(new Date(), profile?.timezone ?? "UTC");
}

// ---------------------------------------------------------------------------- Prayer journal

export async function saveJournalEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = journalEntrySchema.safeParse({
    ...raw,
    theme: raw.theme ? raw.theme : null,
    kind: raw.kind ? raw.kind : "reflection",
    shareWithCoach: raw.shareWithCoach === "on" || raw.shareWithCoach === "true",
  });
  if (!parsed.success) return actionInvalid(parsed.error);
  const id = uuid.safeParse(formData.get("id"));
  const supabase = await getServerSupabase();
  const row = {
    entry_date: parsed.data.entryDate,
    kind: parsed.data.kind,
    theme: parsed.data.theme,
    scripture_ref: parsed.data.scriptureRef || null,
    title: parsed.data.title || null,
    body: parsed.data.body,
    share_with_coach: parsed.data.shareWithCoach,
  };
  if (id.success) {
    // An answered prayer stays answered only while it is a prayer request.
    const patch = row.kind === "request" ? row : { ...row, answered_on: null, answered_note: null };
    const { data, error } = await supabase.from("faith_journal_entries").update(patch).eq("id", id.data).eq("user_id", user.id).select("id");
    if (error || !data?.length) {
      if (error) logError("faith.journal", error);
      return actionError("Couldn't save your entry.");
    }
    return actionOk("Entry updated.");
  }
  const { error } = await supabase.from("faith_journal_entries").insert({ ...row, user_id: user.id });
  if (error) {
    logError("faith.journal", error);
    return actionError("Couldn't save your entry.");
  }
  return actionOk(row.share_with_coach ? "Entry saved. Only you and the AI coach (as you chose) can see it." : "Entry saved. Only you can see it.");
}

export async function deleteJournalEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("faith_journal_entries").delete().eq("id", id.data).eq("user_id", user.id);
}

export async function markPrayerAnsweredAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = prayerAnsweredSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const today = await userToday(user.id);
  if (parsed.data.answeredOn > today) return actionError("The answered date can't be in the future.", { answeredOn: "Choose today or an earlier date" });
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("faith_journal_entries")
    .update({ answered_on: parsed.data.answeredOn, answered_note: parsed.data.note || null })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("kind", "request")
    .select("id");
  if (error || !data?.length) {
    if (error) logError("faith.answered", error);
    return actionError("Couldn't mark this prayer answered.");
  }
  return actionOk("Marked as answered. Praise God!");
}

export async function clearPrayerAnsweredAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("faith_journal_entries").update({ answered_on: null, answered_note: null }).eq("id", id.data).eq("user_id", user.id);
}

export async function setJournalShareAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("faith_journal_entries").update({ share_with_coach: formData.get("share") === "true" }).eq("id", id.data).eq("user_id", user.id);
}

// ---------------------------------------------------------------------------- Daily practices

async function activePracticeCount(userId: string): Promise<number> {
  const supabase = await getServerSupabase();
  const { count } = await supabase.from("discipline_goals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true);
  return count ?? 0;
}

/** Add a preset practice (Scripture, prayer, …) if it isn't chosen yet. */
export async function addPresetPracticeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const practice = formData.get("practice");
  if (!isPresetPractice(practice)) return;
  const supabase = await getServerSupabase();
  const { data: existing } = await supabase.from("discipline_goals").select("id").eq("user_id", user.id).eq("practice", practice).eq("is_active", true).maybeSingle();
  if (existing) return;
  if ((await activePracticeCount(user.id)) >= MAX_PRACTICES) return;
  const { error } = await supabase.from("discipline_goals").insert({ user_id: user.id, title: PRACTICE_INFO[practice].label, cadence: "daily", practice });
  if (error) logError("faith.practice.add", error);
}

export async function createCustomPracticeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = customPracticeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  if ((await activePracticeCount(user.id)) >= MAX_PRACTICES) return actionError(`You can choose up to ${MAX_PRACTICES} practices.`);
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("discipline_goals").insert({ user_id: user.id, title: parsed.data.title, cadence: "daily", practice: "custom" });
  if (error) {
    logError("faith.practice.custom", error);
    return actionError("Couldn't add the practice.");
  }
  return actionOk("Practice added.");
}

/** Check off (or un-check) a practice for one day: today or one of the previous six days. */
export async function togglePracticeCheckinAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("goalId"));
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(formData.get("date"));
  if (!id.success || !day.success) return;
  const today = await userToday(user.id);
  if (!canCheckIn(day.data, today)) return;
  const supabase = await getServerSupabase();
  const { data: goal } = await supabase.from("discipline_goals").select("id").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!goal) return;
  const { data: existing } = await supabase.from("discipline_checkins").select("goal_id").eq("goal_id", id.data).eq("user_id", user.id).eq("checked_on", day.data).maybeSingle();
  if (existing) await supabase.from("discipline_checkins").delete().eq("goal_id", id.data).eq("checked_on", day.data).eq("user_id", user.id);
  else await supabase.from("discipline_checkins").insert({ goal_id: id.data, user_id: user.id, checked_on: day.data });
}

/** Remove a practice and its check-off history (confirmed in the UI). */
export async function removePracticeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("goalId"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("discipline_goals").delete().eq("id", id.data).eq("user_id", user.id);
}

// ---------------------------------------------------------------------------- Faith reminders

export async function getFaithRemindersAction(): Promise<FaithReminder[]> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("faith_reminders").select("kind, enabled, remind_at, weekdays").eq("user_id", user.id);
  return FAITH_REMINDER_KINDS.map((k) => faithReminderFromRow(k, (data ?? []).find((r) => r.kind === k)));
}

export async function saveFaithRemindersAction(input: FaithReminder[]): Promise<ActionState & { reminders?: FaithReminder[] }> {
  const user = await requireUser();
  const parsed = faithRemindersSchema.safeParse(input);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Please check your reminders.");
  const supabase = await getServerSupabase();
  const rows = parsed.data.map((r) => ({ user_id: user.id, kind: r.kind, enabled: r.enabled, remind_at: r.time, weekdays: normalizeWeekdays(r.weekdays) }));
  const { error } = await supabase.from("faith_reminders").upsert(rows, { onConflict: "user_id,kind" });
  if (error) {
    logError("faith.reminders", error);
    return actionError("Couldn't save your reminders. Please try again.");
  }
  return { ...actionOk("Saved."), reminders: await getFaithRemindersAction() };
}
