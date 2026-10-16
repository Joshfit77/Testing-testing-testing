import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, eachDay, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { estimateOneRepMax } from "@/lib/domain/strength";

export const BIG_THREE = [
  { slug: "back-squat", label: "Squat" },
  { slug: "bench-press", label: "Bench" },
  { slug: "conventional-deadlift", label: "Deadlift" },
] as const;

export interface WeeklyPoint {
  week: string;
  workouts: number;
  volumeKg: number;
}

/** Sessions in range bucketed by Monday-week (or by month for long ranges). */
export async function getTrainingBuckets(supabase: SupabaseClient, userId: string, start: string, end: string, tz: string, byMonth: boolean) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("started_at, total_volume_kg")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("started_at", `${addDays(start, -1)}T00:00:00Z`)
    .order("started_at");
  if (error) throw error;
  const rows = (data ?? [])
    .map((s) => ({ date: isoDateInTz(new Date(s.started_at as string), tz), volume: Number(s.total_volume_kg) }))
    .filter((r) => r.date >= start && r.date <= end);
  const keyOf = (d: string) => (byMonth ? `${d.slice(0, 7)}-01` : startOfWeek(d));
  const keys: string[] = [];
  if (byMonth) {
    for (let d = `${start.slice(0, 7)}-01`; d <= end; ) {
      keys.push(d);
      const [y, m] = d.split("-").map(Number) as [number, number];
      d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
  } else {
    for (let w = startOfWeek(start); w <= end; w = addDays(w, 7)) keys.push(w);
  }
  const map = new Map(keys.map((k) => [k, { week: k, workouts: 0, volumeKg: 0 }]));
  for (const r of rows) {
    const b = map.get(keyOf(r.date));
    if (b) {
      b.workouts += 1;
      b.volumeKg += r.volume;
    }
  }
  return { buckets: [...map.values()].map((b) => ({ ...b, volumeKg: Math.round(b.volumeKg) })), sessionDays: new Set(rows.map((r) => r.date)).size, total: rows.length };
}

/** Best estimated 1RM per session date for the given exercises. */
export async function getStrengthSeries(supabase: SupabaseClient, userId: string, exerciseIds: string[], start: string, tz: string) {
  if (!exerciseIds.length) return new Map<string, Map<string, number>>();
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise_id, skipped, session:workout_sessions!inner(started_at, status), sets:workout_sets(reps, weight_kg, completed, is_warmup)")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .eq("session.status", "completed")
    .gte("session.started_at", `${addDays(start, -1)}T00:00:00Z`);
  if (error) throw error;
  const out = new Map<string, Map<string, number>>();
  for (const row of (data ?? []) as unknown as {
    exercise_id: string;
    skipped: boolean;
    session: { started_at: string };
    sets: { reps: number | null; weight_kg: number | null; completed: boolean; is_warmup: boolean }[];
  }[]) {
    if (row.skipped) continue;
    const date = isoDateInTz(new Date(row.session.started_at), tz);
    if (date < start) continue;
    let best = 0;
    for (const s of row.sets) {
      if (!s.completed || s.is_warmup || !s.reps || !s.weight_kg) continue;
      best = Math.max(best, estimateOneRepMax(Number(s.weight_kg), s.reps) ?? 0);
    }
    if (best <= 0) continue;
    const m = out.get(row.exercise_id) ?? new Map<string, number>();
    m.set(date, Math.max(m.get(date) ?? 0, best));
    out.set(row.exercise_id, m);
  }
  return out;
}

export async function getNutritionDaily(supabase: SupabaseClient, userId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("meal_items")
    .select("calories, protein_g, carbs_g, fat_g, meal:meals!inner(eaten_on, status, is_template)")
    .eq("user_id", userId)
    .eq("meal.is_template", false)
    .eq("meal.status", "logged")
    .gte("meal.eaten_on", start)
    .lte("meal.eaten_on", end);
  if (error) throw error;
  const days = new Map(eachDay(start, end).map((d) => [d, { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 }]));
  for (const i of (data ?? []) as unknown as { calories: number; protein_g: number; carbs_g: number; fat_g: number; meal: { eaten_on: string } }[]) {
    const d = days.get(i.meal.eaten_on);
    if (!d) continue;
    d.calories += Number(i.calories);
    d.protein += Number(i.protein_g);
    d.carbs += Number(i.carbs_g);
    d.fat += Number(i.fat_g);
  }
  return [...days.values()].map((d) => ({
    date: d.date,
    calories: Math.round(d.calories),
    protein: Math.round(d.protein),
    carbs: Math.round(d.carbs),
    fat: Math.round(d.fat),
  }));
}

export interface BestRow {
  exerciseId: string;
  exercise: string;
  slug: string;
  e1rm: number | null;
  maxWeight: number | null;
  maxReps: number | null;
  maxDuration: number | null;
  lastAchieved: string;
}

export async function getPersonalBests(supabase: SupabaseClient, userId: string): Promise<BestRow[]> {
  const { data, error } = await supabase
    .from("personal_records")
    .select("exercise_id, record_type, value, achieved_at, exercise:exercises(name, slug)")
    .eq("user_id", userId)
    .order("achieved_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const map = new Map<string, BestRow>();
  for (const r of data ?? []) {
    const ex = r.exercise as unknown as { name: string; slug: string } | null;
    const row =
      map.get(r.exercise_id as string) ??
      ({ exerciseId: r.exercise_id as string, exercise: ex?.name ?? "", slug: ex?.slug ?? "", e1rm: null, maxWeight: null, maxReps: null, maxDuration: null, lastAchieved: r.achieved_at as string } as BestRow);
    const v = Number(r.value);
    if (r.record_type === "estimated_1rm") row.e1rm = Math.max(row.e1rm ?? 0, v);
    if (r.record_type === "max_weight") row.maxWeight = Math.max(row.maxWeight ?? 0, v);
    if (r.record_type === "max_reps") row.maxReps = Math.max(row.maxReps ?? 0, v);
    if (r.record_type === "max_duration") row.maxDuration = Math.max(row.maxDuration ?? 0, v);
    if ((r.achieved_at as string) > row.lastAchieved) row.lastAchieved = r.achieved_at as string;
    map.set(r.exercise_id as string, row);
  }
  return [...map.values()].sort((a, b) => b.lastAchieved.localeCompare(a.lastAchieved));
}
