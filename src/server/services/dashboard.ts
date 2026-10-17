import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { sumMacros } from "@/lib/domain/nutrition";
import { readinessBand, readinessNote } from "@/lib/domain/readiness";
import { dailyStreak, lastSevenDays, weeklyStreak } from "@/lib/domain/streak";
import { startOfWeek } from "@/lib/domain/dates";

export interface DashboardData {
  today: string;
  sessionDates: string[];
  last7: { date: string; count: number }[];
  workoutsThisWeek: number;
  workoutsTotal: number;
  dayStreak: number;
  weekStreak: number;
  weights: { date: string; weightKg: number }[];
  nutrition: { calories: number; protein_g: number; goalCalories: number | null; goalProtein: number | null; goalIsEstimate: boolean };
  records: { exercise: string; recordType: string; value: number; weightKg: number | null; reps: number | null; achievedAt: string }[];
  readiness: { score: number; band: "high" | "moderate" | "low"; note: string; checkedOn: string } | null;
}

export async function getDashboardData(supabase: SupabaseClient, userId: string, timezone: string): Promise<DashboardData> {
  const today = isoDateInTz(new Date(), timezone);
  const since = addDays(today, -120);

  const [sessionsRes, totalRes, weightsRes, itemsRes, goalsRes, prsRes, checkinRes] = await Promise.all([
    supabase.from("workout_sessions").select("started_at").eq("user_id", userId).eq("status", "completed").gte("started_at", `${since}T00:00:00Z`).order("started_at"),
    supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
    supabase.from("weight_entries").select("recorded_on, weight_kg").eq("user_id", userId).gte("recorded_on", addDays(today, -90)).order("recorded_on"),
    supabase.from("meal_items").select("calories, protein_g, meal:meals!inner(eaten_on, status, is_template)").eq("user_id", userId).eq("meal.eaten_on", today).eq("meal.status", "logged").eq("meal.is_template", false),
    supabase.from("nutrition_goals").select("calories, protein_g, is_estimate").eq("user_id", userId).maybeSingle(),
    supabase.from("personal_records").select("record_type, value, weight_kg, reps, achieved_at, exercise:exercises(name)").eq("user_id", userId).in("record_type", ["estimated_1rm", "max_weight", "max_duration", "max_reps"]).order("achieved_at", { ascending: false }).limit(6),
    supabase.from("recovery_checkins").select("checked_on, readiness_score").eq("user_id", userId).order("checked_on", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const sessionDates = (sessionsRes.data ?? []).map((s) => isoDateInTz(new Date(s.started_at as string), timezone));
  const weekStart = startOfWeek(today);
  const totals = sumMacros((itemsRes.data ?? []) as { calories: number; protein_g: number }[]);
  const checkin = checkinRes.data;
  const band = checkin ? readinessBand(checkin.readiness_score as number) : null;

  return {
    today,
    sessionDates,
    last7: lastSevenDays(sessionDates, today),
    workoutsThisWeek: sessionDates.filter((d) => d >= weekStart).length,
    workoutsTotal: totalRes.count ?? 0,
    dayStreak: dailyStreak(sessionDates, today),
    weekStreak: weeklyStreak(sessionDates, today, 1),
    weights: (weightsRes.data ?? []).map((w) => ({ date: w.recorded_on as string, weightKg: Number(w.weight_kg) })),
    nutrition: {
      calories: totals.calories,
      protein_g: totals.protein_g,
      goalCalories: (goalsRes.data?.calories as number) ?? null,
      goalProtein: (goalsRes.data?.protein_g as number) ?? null,
      goalIsEstimate: Boolean(goalsRes.data?.is_estimate),
    },
    records: (prsRes.data ?? []).map((r) => ({
      exercise: (r.exercise as unknown as { name: string } | null)?.name ?? "Exercise",
      recordType: r.record_type as string,
      value: Number(r.value),
      weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
      reps: (r.reps as number | null) ?? null,
      achievedAt: r.achieved_at as string,
    })),
    readiness:
      checkin && band
        ? { score: checkin.readiness_score as number, band, note: readinessNote(band), checkedOn: checkin.checked_on as string }
        : null,
  };
}
