import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkoutEditor, type EditableSession } from "@/components/workout/workout-editor";
import type { CatalogItem } from "@/components/workout/exercise-picker";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Workout" };

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select(
      "id, name, notes, started_at, ended_at, paused_seconds, total_volume_kg, status, workout_exercises(id, position, notes, skipped, skip_reason, substituted_from_id, exercise:exercises!workout_exercises_exercise_id_fkey(id, slug, name, is_timed), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, rpe, is_warmup, completed))",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();
  if (!session) notFound();

  const { data: exRows } = await supabase.from("exercises").select("id, slug, name, is_timed, category, primary_muscles").eq("is_published", true).order("name");
  const catalog: CatalogItem[] = (exRows ?? []).map((e) => ({
    id: e.id as string,
    slug: e.slug as string,
    name: e.name as string,
    isTimed: e.is_timed as boolean,
    category: e.category as string,
    primary: e.primary_muscles as string[],
  }));

  type WE = {
    id: string;
    position: number;
    notes: string | null;
    skipped: boolean;
    skip_reason: "pain" | "equipment" | "time" | "other" | null;
    substituted_from_id: string | null;
    exercise: { id: string; slug: string; name: string; is_timed: boolean };
    sets: { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null; rpe: number | null; is_warmup: boolean; completed: boolean }[];
  };
  const exercises = ((session.workout_exercises ?? []) as unknown as WE[]).sort((a, b) => a.position - b.position);
  const editable: EditableSession = {
    id: session.id as string,
    name: session.name as string,
    notes: (session.notes as string) ?? "",
    startedAt: session.started_at as string,
    endedAt: session.ended_at as string,
    pausedSeconds: session.paused_seconds as number,
    volumeKg: Number(session.total_volume_kg),
    exercises: exercises.map((e) => ({
      exerciseId: e.exercise.id,
      slug: e.exercise.slug,
      name: e.exercise.name,
      isTimed: e.exercise.is_timed,
      substitutedFromId: e.substituted_from_id,
      notes: e.notes ?? "",
      skipped: e.skipped,
      skipReason: e.skip_reason,
      sets: [...e.sets]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          reps: s.reps,
          weightKg: s.weight_kg == null ? null : Number(s.weight_kg),
          durationSeconds: s.duration_seconds,
          rpe: s.rpe == null ? null : Number(s.rpe),
          isWarmup: s.is_warmup,
          completed: s.completed,
        })),
    })),
  };

  return (
    <div className="space-y-6">
      <Link href="/train/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> History
      </Link>
      <WorkoutEditor session={editable} catalog={catalog} units={profile.unit_system} timezone={profile.timezone} />
    </div>
  );
}
