import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eachDay } from "@/lib/domain/dates";
import { fillStepDays, type DaySteps, type StepSource } from "@/lib/domain/steps";

export interface StepsSummary {
  days: DaySteps[];
  /** Where the newest day's count came from, if recorded. */
  lastSource: StepSource | null;
}

/** Daily step totals from `start` to `end` (inclusive), one entry per day, 0 where nothing is recorded. */
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
  return { days: fillStepDays(eachDay(start, end), rows), lastSource: last?.source ?? null };
}
