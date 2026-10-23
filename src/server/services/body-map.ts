import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allRegionStats, type MapRecord, type MapSession, type RegionStats } from "@/lib/domain/body-map";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { rankAll, type OverallRank, type RegionRank, type StandardsTable } from "@/lib/domain/strength-ranks";
import type { UnitSystem } from "@/lib/domain/types";

export interface BodyMapData {
  today: string;
  units: UnitSystem;
  table: StandardsTable | null;
  /** The body weight used for ratio-based lifts: the latest entry from the last 12 months. */
  bodyweight: { kg: number; date: string } | null;
  /** A body weight older than 12 months, which isn't used. */
  staleBodyweightDate: string | null;
  regions: RegionRank[];
  overall: OverallRank;
  stats: RegionStats[];
  sessionsCounted: number;
}

type SetRow = { reps: number | null; weight_kg: number | string | null; duration_seconds: number | null; completed: boolean; is_warmup: boolean };
type SessionRow = {
  id: string;
  started_at: string;
  workout_exercises: { skipped: boolean | null; exercise: { slug: string; name: string; primary_muscles: string[] | null; secondary_muscles: string[] | null } | null; sets: SetRow[] }[];
};

/** Everything the muscle map shows, from the member's own completed workouts in the last 12 months. */
export async function loadBodyMap(supabase: SupabaseClient, userId: string): Promise<BodyMapData> {
  const { data: profile } = await supabase.from("profiles").select("timezone, unit_system, strength_standards").eq("id", userId).maybeSingle();
  const timeZone = (profile?.timezone as string) || "UTC";
  const today = isoDateInTz(new Date(), timeZone);
  const since = addDays(today, -365);

  const [sessionsRes, weightRes, recordsRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select(
        "id, started_at, workout_exercises(skipped, exercise:exercises!workout_exercises_exercise_id_fkey(slug, name, primary_muscles, secondary_muscles), sets:workout_sets(reps, weight_kg, duration_seconds, completed, is_warmup))",
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", `${since}T00:00:00Z`)
      .order("started_at")
      .limit(1000),
    supabase.from("weight_entries").select("weight_kg, recorded_on").eq("user_id", userId).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("personal_records")
      .select("record_type, value, weight_kg, reps, achieved_at, exercise:exercises(slug, name, primary_muscles)")
      .eq("user_id", userId)
      .order("achieved_at", { ascending: false })
      .limit(500),
  ]);
  if (sessionsRes.error) throw sessionsRes.error;

  const sessions: MapSession[] = ((sessionsRes.data ?? []) as unknown as SessionRow[]).map((s) => ({
    id: s.id,
    date: isoDateInTz(new Date(s.started_at), timeZone),
    exercises: (s.workout_exercises ?? [])
      .filter((e) => e.exercise && !e.skipped)
      .map((e) => ({
        slug: e.exercise!.slug,
        name: e.exercise!.name,
        primary: e.exercise!.primary_muscles ?? [],
        secondary: e.exercise!.secondary_muscles ?? [],
        sets: (e.sets ?? []).map((x) => ({
          reps: x.reps,
          weightKg: x.weight_kg == null ? null : Number(x.weight_kg),
          durationSeconds: x.duration_seconds,
          completed: Boolean(x.completed),
          isWarmup: Boolean(x.is_warmup),
        })),
      })),
  }));

  const w = weightRes.data as { weight_kg: number | string; recorded_on: string } | null;
  const recent = w && w.recorded_on >= since;
  const bodyweight = w && recent ? { kg: Number(w.weight_kg), date: w.recorded_on } : null;
  const table = (profile?.strength_standards as StandardsTable | null) ?? null;

  const records: MapRecord[] = (
    (recordsRes.data ?? []) as unknown as { record_type: MapRecord["recordType"]; value: number | string; weight_kg: number | string | null; reps: number | null; achieved_at: string; exercise: { slug: string; name: string; primary_muscles: string[] | null } | null }[]
  )
    .filter((r) => r.exercise)
    .map((r) => ({
      slug: r.exercise!.slug,
      name: r.exercise!.name,
      primary: r.exercise!.primary_muscles ?? [],
      recordType: r.record_type,
      value: Number(r.value),
      weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
      reps: r.reps,
      date: isoDateInTz(new Date(r.achieved_at), timeZone),
    }));

  const { regions, overall } = rankAll({ sessions, bodyweightKg: bodyweight?.kg ?? null, table, today });
  return {
    today,
    units: ((profile?.unit_system as UnitSystem) ?? "metric") as UnitSystem,
    table,
    bodyweight,
    staleBodyweightDate: w && !recent ? w.recorded_on : null,
    regions,
    overall,
    stats: allRegionStats({ sessions, records, today }),
    sessionsCounted: sessions.length,
  };
}
