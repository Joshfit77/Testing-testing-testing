import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalKind } from "@/lib/domain/journal";
import type { Practice, PracticeCheckin, PracticeKind } from "@/lib/domain/practices";
import { addDays, isoDateInTz, isValidTimeZone } from "@/lib/domain/dates";
import { FAITH_REMINDER_KINDS, faithReminderFromRow, type FaithReminder, type FaithReminderContext } from "@/lib/faith-reminders";

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
  archived_at: string | null;
  updated_at: string;
}

export const JOURNAL_SELECT = "id, entry_date, kind, theme, scripture_ref, title, body, answered_on, answered_note, share_with_coach, archived_at, updated_at";

/**
 * What a device needs to schedule the dated Faith reminders: the member's date and saved time zone, what's already done
 * today, whether a journey is active, and quiet hours. Read with the member's own client (RLS).
 */
export async function loadReminderContext(supabase: SupabaseClient, userId: string, timezone: string): Promise<Omit<FaithReminderContext, "now">> {
  const tz = isValidTimeZone(timezone) ? timezone : "UTC";
  const today = isoDateInTz(new Date(), tz);
  const since = `${addDays(today, -1)}T00:00:00Z`;
  const [journeyRes, goalsRes, prefsRes, workoutsRes] = await Promise.all([
    supabase.from("faith_journeys").select("id").eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabase.from("faith_daily_goals").select("kind").eq("user_id", userId).eq("goal_date", today),
    supabase.from("faith_reminder_prefs").select("quiet_start, quiet_end").eq("user_id", userId).maybeSingle(),
    supabase.from("workout_sessions").select("started_at").eq("user_id", userId).eq("status", "completed").gte("started_at", since).limit(20),
  ]);
  const journeyId = journeyRes.data?.id as string | undefined;
  const { data: checkin } = journeyId
    ? await supabase.from("faith_journey_checkins").select("reading_completed_at, prayer_completed_at").eq("journey_id", journeyId).eq("check_date", today).maybeSingle()
    : { data: null };
  const goals = new Set((goalsRes.data ?? []).map((g) => g.kind as string));
  const q = prefsRes.data;
  return {
    today,
    timezone: tz,
    journeyActive: Boolean(journeyId),
    done: {
      reading: Boolean(checkin?.reading_completed_at),
      prayer: Boolean(checkin?.prayer_completed_at),
      challenge: goals.has("faith_challenge"),
      fitness: goals.has("fitness") || (workoutsRes.data ?? []).some((w) => isoDateInTz(new Date(w.started_at as string), tz) === today),
    },
    quiet: q?.quiet_start && q?.quiet_end ? { start: String(q.quiet_start).slice(0, 5), end: String(q.quiet_end).slice(0, 5) } : null,
  };
}
