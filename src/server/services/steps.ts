import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eachDay } from "@/lib/domain/dates";
import { fillStepDays, type DaySteps, type StepSource } from "@/lib/domain/steps";

export interface StepsSummary {
  days: DaySteps[];
  /** Where the newest day's count came from, if recorded. */
  lastSource: StepSource | null;
  /** How many of `days` have a stored count (the rest are unknown, shown as empty bars). */
  recordedDays: number;
}

/**
 * Daily step totals from `start` to `end` (inclusive), one entry per day for the chart (an empty bar where nothing is
 * recorded). Averages must use `recordedDays`, never the number of calendar days (stepAverage in domain/steps.ts).
 */
export async function getStepsDaily(supabase: SupabaseClient, userId: string, start: string, end: string): Promise<StepsSummary> {
  const { data, error } = await supabase
    .from("daily_steps")
    .select("day, steps, source")
    .eq("user_id", userId)
    .gte("day", start)
    .lte("day", end)
    .order("day");
  if (error) throw error;
  const rows = (data ?? []) as { day: string; steps: number; source: StepSource }[];
  const last = rows.find((r) => r.day === end);
  return { days: fillStepDays(eachDay(start, end), rows), lastSource: last?.source ?? null, recordedDays: rows.length };
}
