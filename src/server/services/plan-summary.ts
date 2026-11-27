import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeDays, type PlanSummary } from "@/lib/domain/plan-preview";

/**
 * The user's active program as a plan summary (days a week, average estimated session length of its first
 * non-deload week, program length), for "what changes" previews. Null when nothing is active.
 */
export async function getActivePlanSummary(supabase: SupabaseClient, userId: string): Promise<PlanSummary | null> {
  const { data: up } = await supabase
    .from("user_programs")
    .select("program:training_programs(id, name, duration_weeks)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const program = (up?.program as unknown as { id: string; name: string; duration_weeks: number } | null) ?? null;
  if (!program) return null;
  const { data: weeks } = await supabase.from("program_weeks").select("id, week_number, is_deload").eq("program_id", program.id).order("week_number");
  const week = (weeks ?? []).find((w) => !w.is_deload) ?? weeks?.[0];
  if (!week) return null;
  const { data: days } = await supabase.from("program_days").select("estimated_minutes").eq("week_id", week.id).order("day_number");
  return summarizeDays(
    program.name,
    (days ?? []).map((d) => Number(d.estimated_minutes ?? 0)),
    program.duration_weeks,
  );
}
