import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalKind } from "@/lib/domain/journal";
import type { Practice, PracticeCheckin, PracticeKind } from "@/lib/domain/practices";
import { FAITH_REMINDER_KINDS, faithReminderFromRow, type FaithReminder } from "@/lib/faith-reminders";

/** The user's chosen practices and their check-offs since `from` (inclusive). */
export async function loadPractices(supabase: SupabaseClient, userId: string, from: string, to?: string): Promise<{ practices: Practice[]; checkins: PracticeCheckin[] }> {
  let q = supabase.from("discipline_checkins").select("goal_id, checked_on").eq("user_id", userId).gte("checked_on", from);
  if (to) q = q.lte("checked_on", to);
  const [goals, checks] = await Promise.all([
    supabase.from("discipline_goals").select("id, title, practice").eq("user_id", userId).eq("is_active", true).order("created_at"),
    q,
  ]);
  return {
    practices: (goals.data ?? []).map((g) => ({ id: g.id as string, title: g.title as string, practice: ((g.practice as string) ?? "custom") as PracticeKind })),
    checkins: (checks.data ?? []).map((c) => ({ goalId: c.goal_id as string, date: c.checked_on as string })),
  };
}

export async function loadFaithReminders(supabase: SupabaseClient, userId: string): Promise<FaithReminder[]> {
  const { data } = await supabase.from("faith_reminders").select("kind, enabled, remind_at, weekdays").eq("user_id", userId);
  return FAITH_REMINDER_KINDS.map((k) => faithReminderFromRow(k, (data ?? []).find((r) => r.kind === k)));
}

export interface JournalRow {
  id: string;
  entry_date: string;
  kind: JournalKind;
  theme: string | null;
  scripture_ref: string | null;
  title: string | null;
  body: string;
  answered_on: string | null;
  answered_note: string | null;
  share_with_coach: boolean;
  updated_at: string;
}

export const JOURNAL_SELECT = "id, entry_date, kind, theme, scripture_ref, title, body, answered_on, answered_note, share_with_coach, updated_at";
