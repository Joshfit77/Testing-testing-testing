import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, daysBetween, isoDateInTz } from "@/lib/domain/dates";
import { planTitle, type JourneyPlan, type PlanDay, type PlanSpec } from "@/lib/bible/plans";
import { journeyPlan, validPlanSpec } from "@/server/bible/plans";
import { logError } from "@/server/log";

/*
 * Reading journeys as the member sees them. The rule itself (both Bible reading and prayer each local day, or the
 * journey restarts at Day 1) lives in the database (migration 053: faith_journey_settle_at, run every 15 minutes and on
 * every load here); this module only reads the result and lays out the schedule. Nothing here marks anything complete.
 */

export type InterruptionReason = "reading" | "prayer" | "both";

export interface AttemptView {
  id: string;
  number: number;
  startedOn: string;
  status: "active" | "interrupted" | "completed" | "ended";
  interruptedOn: string | null;
  reason: InterruptionReason | null;
  daysCompleted: number;
  endedAt: string | null;
}

export interface JourneyView {
  id: string;
  spec: PlanSpec;
  title: string;
  durationDays: number;
  startOn: string;
  status: "active" | "completed" | "ended";
  createdAt: string;
  endedAt: string | null;
  plan: JourneyPlan;
  attempts: AttemptView[];
  /** The attempt in progress (the latest one for a finished journey). */
  attempt: AttemptView;
  today: string;
  timezone: string;
  /** Today's schedule day in the current attempt (1…duration), or null before Day 1. */
  day: number | null;
  todayPlan: PlanDay | null;
  reading: boolean;
  prayer: boolean;
  /** Schedule days of the current attempt with both activities done. */
  completedDays: number[];
  /** Set while a restarted attempt hasn't completed a day yet: the day that was missed and why. */
  restart: { missedOn: string; reason: InterruptionReason; previousDays: number } | null;
}

interface JourneyRow {
  id: string;
  plan_kind: string;
  plan_param: string | null;
  duration_days: number;
  start_on: string;
  status: JourneyView["status"];
  created_at: string;
  ended_at: string | null;
}

const toAttempt = (r: Record<string, unknown>): AttemptView => ({
  id: r.id as string,
  number: r.attempt_number as number,
  startedOn: r.started_on as string,
  status: r.status as AttemptView["status"],
  interruptedOn: (r.interrupted_on as string | null) ?? null,
  reason: (r.interruption_reason as InterruptionReason | null) ?? null,
  daysCompleted: r.days_completed as number,
  endedAt: (r.ended_at as string | null) ?? null,
});

const JOURNEY_COLS = "id, plan_kind, plan_param, duration_days, start_on, status, created_at, ended_at";

/** Apply the daily rule for the member now (the scheduled job does the same every 15 minutes). */
export async function settleMyJourney(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("faith_journey_settle_mine");
  if (error) logError("faith.journey.settle", error);
}

async function buildView(supabase: SupabaseClient, row: JourneyRow, timezone: string): Promise<JourneyView | null> {
  const spec = validPlanSpec(row.plan_kind, row.plan_param);
  const plan = spec ? journeyPlan(spec, row.duration_days) : null;
  if (!spec || !plan) return null;
  const today = isoDateInTz(new Date(), timezone);
  const [attemptsRes, checkinsRes] = await Promise.all([
    supabase.from("faith_journey_attempts").select("id, attempt_number, started_on, status, interrupted_on, interruption_reason, days_completed, ended_at").eq("journey_id", row.id).order("attempt_number", { ascending: false }),
    supabase.from("faith_journey_checkins").select("check_date, reading_day, reading_completed_at, prayer_completed_at").eq("journey_id", row.id).order("check_date", { ascending: false }).limit(400),
  ]);
  const attempts = (attemptsRes.data ?? []).map(toAttempt);
  const attempt = attempts.find((a) => a.status === "active") ?? attempts[0];
  if (!attempt) return null;
  const checkins = checkinsRes.data ?? [];
  const startedAt = attempt.startedOn;
  const dayNum = daysBetween(startedAt, today) + 1;
  const day = row.status === "active" && dayNum >= 1 && dayNum <= row.duration_days ? dayNum : null;

  const completedDays: number[] = [];
  for (const c of checkins) {
    const d = daysBetween(startedAt, c.check_date as string) + 1;
    if (d < 1 || d > row.duration_days) continue;
    if (c.prayer_completed_at && c.reading_completed_at && c.reading_day === d) completedDays.push(d);
  }
  completedDays.sort((a, b) => a - b);
  const todayRow = checkins.find((c) => c.check_date === today);
  const reading = Boolean(day && todayRow?.reading_completed_at && todayRow.reading_day === day);
  const prayer = Boolean(day && todayRow?.prayer_completed_at);

  const previous = attempts.find((a) => a.number === attempt.number - 1);
  const restart =
    row.status === "active" && attempt.number > 1 && completedDays.length === 0 && previous?.status === "interrupted" && previous.interruptedOn && previous.reason
      ? { missedOn: previous.interruptedOn, reason: previous.reason, previousDays: previous.daysCompleted }
      : null;

  return {
    id: row.id,
    spec,
    title: planTitle(spec),
    durationDays: row.duration_days,
    startOn: row.start_on,
    status: row.status,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    plan,
    attempts,
    attempt,
    today,
    timezone,
    day,
    todayPlan: day ? (plan.schedule[day - 1] ?? null) : null,
    reading,
    prayer,
    completedDays,
    restart,
  };
}

/** The member's active journey (settled first), or null. */
export async function loadActiveJourney(supabase: SupabaseClient, userId: string, timezone: string): Promise<JourneyView | null> {
  await settleMyJourney(supabase);
  const { data } = await supabase.from("faith_journeys").select(JOURNEY_COLS).eq("user_id", userId).eq("status", "active").maybeSingle();
  return data ? buildView(supabase, data as JourneyRow, timezone) : null;
}

/** A journey finished in the last week, for the "journey complete" card. */
export async function loadRecentlyCompleted(supabase: SupabaseClient, userId: string, timezone: string): Promise<JourneyView | null> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase.from("faith_journeys").select(JOURNEY_COLS).eq("user_id", userId).eq("status", "completed").gte("ended_at", since).order("ended_at", { ascending: false }).limit(1).maybeSingle();
  return data ? buildView(supabase, data as JourneyRow, timezone) : null;
}

export interface PastJourney {
  id: string;
  title: string;
  durationDays: number;
  status: "completed" | "ended";
  startOn: string;
  endedAt: string | null;
  attempts: number;
}

export async function loadPastJourneys(supabase: SupabaseClient, userId: string): Promise<PastJourney[]> {
  const { data } = await supabase.from("faith_journeys").select(`${JOURNEY_COLS}, faith_journey_attempts(count)`).eq("user_id", userId).neq("status", "active").order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => {
    const spec = validPlanSpec(r.plan_kind as string, r.plan_param as string | null);
    return {
      id: r.id as string,
      title: spec ? planTitle(spec) : "Reading journey",
      durationDays: r.duration_days as number,
      status: r.status as PastJourney["status"],
      startOn: r.start_on as string,
      endedAt: (r.ended_at as string | null) ?? null,
      attempts: ((r.faith_journey_attempts as { count: number }[] | null)?.[0]?.count as number) ?? 1,
    };
  });
}

/** The date a schedule day falls on in the current attempt. */
export function dateOfDay(view: Pick<JourneyView, "attempt">, day: number): string {
  return addDays(view.attempt.startedOn, day - 1);
}
