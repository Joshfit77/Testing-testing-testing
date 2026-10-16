import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogExercise } from "@/lib/domain/program-generator";
import type { Equipment, MovementPattern } from "@/lib/domain/types";
import type { ExerciseRow } from "@/lib/types/db";

export async function loadExercises(supabase: SupabaseClient): Promise<ExerciseRow[]> {
  const { data, error } = await supabase.from("exercises").select("*").eq("is_published", true).order("name");
  if (error) throw error;
  return (data ?? []) as ExerciseRow[];
}

export function toCatalog(rows: ExerciseRow[]): CatalogExercise[] {
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    equipment: r.equipment as Equipment[],
    pattern: r.movement_pattern as MovementPattern,
    category: r.category as CatalogExercise["category"],
    difficulty: r.difficulty,
    timed: r.is_timed,
    lowImpact: r.low_impact,
  }));
}
