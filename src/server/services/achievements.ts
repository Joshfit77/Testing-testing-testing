import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localHour, type AchievementStats } from "@/lib/domain/achievements";
import { isoDateInTz } from "@/lib/domain/dates";

const PAGE = 1000;

/** Page through a query (PostgREST caps responses at 1000 rows). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Gather the narrow, per-event facts the achievements engine needs. Each query selects
 * only one or two small columns (dates, totals) — never sets, items or text bodies.
 */
export async function getAchievementStats(supabase: SupabaseClient, userId: string, tz: string): Promise<AchievementStats> {
  const [workouts, prs, meals, journal, discipline, weights, programs, photos] = await Promise.all([
    fetchAll<{ id: string; started_at: string; total_volume_kg: number | string }>((a, b) =>
      supabase.from("workout_sessions").select("id, started_at, total_volume_kg").eq("user_id", userId).eq("status", "completed").order("started_at").order("id").range(a, b),
    ),
    fetchAll<{ id: string; exercise_id: string; record_type: string; session_id: string | null; achieved_at: string }>((a, b) =>
      supabase.from("personal_records").select("id, exercise_id, record_type, session_id, achieved_at").eq("user_id", userId).order("achieved_at").order("id").range(a, b),
    ),
    // Only days that actually have a logged food item count.
    fetchAll<{ id: string; eaten_on: string }>((a, b) =>
      supabase
        .from("meals")
        .select("id, eaten_on, meal_items!inner(id)")
        .eq("user_id", userId)
        .eq("is_template", false)
        .eq("status", "logged")
        .not("eaten_on", "is", null)
        .order("eaten_on")
        .order("id")
        .limit(1, { referencedTable: "meal_items" })
        .range(a, b),
    ),
    fetchAll<{ id: string; entry_date: string }>((a, b) => supabase.from("faith_journal_entries").select("id, entry_date").eq("user_id", userId).order("entry_date").order("id").range(a, b)),
    fetchAll<{ goal_id: string; checked_on: string }>((a, b) =>
      supabase.from("discipline_checkins").select("goal_id, checked_on").eq("user_id", userId).order("checked_on").order("goal_id").range(a, b),
    ),
    fetchAll<{ id: string; recorded_on: string }>((a, b) => supabase.from("weight_entries").select("id, recorded_on").eq("user_id", userId).order("recorded_on").order("id").range(a, b)),
    fetchAll<{ id: string; completed_at: string | null; updated_at: string }>((a, b) =>
      supabase.from("user_programs").select("id, completed_at, updated_at").eq("user_id", userId).eq("status", "completed").order("id").range(a, b),
    ),
    fetchAll<{ id: string; created_at: string }>((a, b) => supabase.from("progress_photos").select("id, created_at").eq("user_id", userId).order("created_at").order("id").range(a, b)),
  ]);

  const day = (iso: string) => isoDateInTz(new Date(iso), tz);
  return {
    workouts: workouts.map((w) => ({
      sessionId: w.id,
      startedAt: w.started_at,
      date: day(w.started_at),
      startHour: localHour(w.started_at, tz),
      volumeKg: Number(w.total_volume_kg) || 0,
    })),
    prs: prs.map((p) => ({ sessionId: p.session_id, exerciseId: p.exercise_id, recordType: p.record_type, achievedAt: p.achieved_at, date: day(p.achieved_at) })),
    foodDays: meals.map((m) => m.eaten_on),
    journalDates: journal.map((j) => j.entry_date),
    disciplineDates: discipline.map((c) => c.checked_on),
    weightDates: weights.map((w) => w.recorded_on),
    programsCompleted: programs.map((p) => day(p.completed_at ?? p.updated_at)),
    photoDates: photos.map((p) => day(p.created_at)),
  };
}
