import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz, isValidTimeZone } from "@/lib/domain/dates";
import { FAITH_REMINDER_KINDS, faithReminderFromRow, type FaithReminder } from "@/lib/faith-reminders";
import { APP_REMINDER_KINDS, appReminderFromRow, type AppReminder } from "@/lib/notifications/catalog";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs, type PlannerContext } from "@/lib/notifications/planner";
import { loadProgramSchedule } from "@/server/services/schedule";

export interface NotificationSettings {
  faith: FaithReminder[];
  app: AppReminder[];
  prefs: NotificationPrefs;
}

const hhmm = (t: unknown) => (typeof t === "string" ? t.slice(0, 5) : null);

/** The member's reminder settings, with defaults (everything off) for anything never saved. Member's own client (RLS). */
export async function loadNotificationSettings(supabase: SupabaseClient, userId: string): Promise<NotificationSettings> {
  const [faithRes, appRes, prefsRes] = await Promise.all([
    supabase.from("faith_reminders").select("kind, enabled, remind_at, weekdays").eq("user_id", userId),
    supabase.from("notification_reminders").select("kind, enabled, remind_at, weekdays, interval_minutes, end_at, style").eq("user_id", userId),
    supabase.from("notification_prefs").select("paused, quiet_start, quiet_end, daily_limit").eq("user_id", userId).maybeSingle(),
  ]);
  const p = prefsRes.data;
  const start = hhmm(p?.quiet_start);
  const end = hhmm(p?.quiet_end);
  return {
    faith: FAITH_REMINDER_KINDS.map((k) => faithReminderFromRow(k, (faithRes.data ?? []).find((r) => r.kind === k))),
    app: APP_REMINDER_KINDS.map((k) => appReminderFromRow(k, (appRes.data ?? []).find((r) => r.kind === k))),
    prefs: {
      paused: p?.paused === true,
      quiet: start && end ? { start, end } : null,
      dailyLimit: typeof p?.daily_limit === "number" ? p.daily_limit : DEFAULT_NOTIFICATION_PREFS.dailyLimit,
    },
  };
}

/**
 * What the planner needs to know about today, read with the member's own client (RLS): the date and time zone, the
 * reading journey, what's already done (journey reading and prayer, or without a journey any chapter read and any
 * prayer written today; the challenge; a finished workout; meals logged by kind; the water goal), the program's
 * training days for the next week, and how many prayer requests are still open (a count only, never their text).
 */
export async function loadPlannerContext(
  supabase: SupabaseClient,
  userId: string,
  profile: { timezone?: string | null; faith_enabled?: boolean | null },
): Promise<Omit<PlannerContext, "now" | "deviceTimezone">> {
  const tz = isValidTimeZone(profile.timezone) ? profile.timezone : "UTC";
  const today = isoDateInTz(new Date(), tz);
  const since = `${addDays(today, -1)}T00:00:00Z`;
  const [journeyRes, goalsRes, workoutsRes, readRes, prayedRes, openRes, mealsRes, waterRes, goalRes, schedule] = await Promise.all([
    supabase.from("faith_journeys").select("id").eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabase.from("faith_daily_goals").select("kind").eq("user_id", userId).eq("goal_date", today),
    supabase.from("workout_sessions").select("started_at").eq("user_id", userId).eq("status", "completed").gte("started_at", since).limit(20),
    supabase.from("bible_reading_history").select("id").eq("user_id", userId).eq("read_on", today).limit(1),
    supabase.from("faith_journal_entries").select("id").eq("user_id", userId).eq("entry_date", today).limit(1),
    supabase
      .from("faith_journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("kind", ["request", "intercession"])
      .is("answered_on", null)
      .is("archived_at", null),
    supabase.from("meals").select("meal_type").eq("user_id", userId).eq("eaten_on", today).eq("status", "logged").eq("is_template", false),
    supabase.from("water_entries").select("amount_ml").eq("user_id", userId).eq("recorded_on", today),
    supabase.from("nutrition_goals").select("water_ml").eq("user_id", userId).maybeSingle(),
    loadProgramSchedule(supabase, userId, tz).catch(() => null),
  ]);
  const journeyId = journeyRes.data?.id as string | undefined;
  const { data: checkin } = journeyId
    ? await supabase.from("faith_journey_checkins").select("reading_completed_at, prayer_completed_at").eq("journey_id", journeyId).eq("check_date", today).maybeSingle()
    : { data: null };
  const goals = new Set((goalsRes.data ?? []).map((g) => g.kind as string));
  const workout = (workoutsRes.data ?? []).some((w) => isoDateInTz(new Date(w.started_at as string), tz) === today);
  const meals = new Set((mealsRes.data ?? []).map((m) => m.meal_type as string));
  const waterGoal = Number(goalRes.data?.water_ml ?? 0);
  const waterToday = (waterRes.data ?? []).reduce((n, w) => n + Number(w.amount_ml), 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return {
    today,
    timezone: tz,
    faithEnabled: profile.faith_enabled !== false,
    journeyActive: Boolean(journeyId),
    done: {
      // A journey counts only what's marked on it (its rule); otherwise any reading or prayer today.
      reading: journeyId ? Boolean(checkin?.reading_completed_at) : (readRes.data ?? []).length > 0,
      prayer: journeyId ? Boolean(checkin?.prayer_completed_at) : (prayedRes.data ?? []).length > 0,
      challenge: goals.has("faith_challenge"),
      fitness: goals.has("fitness") || workout,
      workout,
      breakfast: meals.has("breakfast"),
      lunch: meals.has("lunch"),
      dinner: meals.has("dinner"),
      snack: meals.has("snack"),
      water: waterGoal > 0 && waterToday >= waterGoal,
    },
    training: { hasProgram: Boolean(schedule), workoutDates: (schedule?.planned ?? []).map((p) => p.date).filter((d) => week.includes(d)) },
    openPrayerRequests: openRes.count ?? 0,
  };
}
