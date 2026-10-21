import { z } from "zod";
import { WorkoutLogger, type WorkoutTemplate } from "@/components/workout/workout-logger";
import type { CatalogItem } from "@/components/workout/exercise-picker";
import { canAccessTier } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getProgramDay } from "@/server/services/training";
import { getPreviousPerformance, getServerDraft } from "@/server/services/workouts";
import { getTemplate } from "@/server/services/templates";
import { migrateDraft } from "@/lib/domain/workout-draft";

export const metadata = { title: "Workout" };

const uuid = z.string().uuid();

export default async function WorkoutPage({ searchParams }: { searchParams: Promise<{ day?: string; up?: string; template?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();

  const [exRes, altRes, serverDraft] = await Promise.all([
    supabase.from("exercises").select("id, slug, name, is_timed, category, primary_muscles").eq("is_published", true).order("name"),
    supabase.from("exercise_alternatives").select("exercise_id, alternative_id"),
    getServerDraft(supabase, user.id),
  ]);
  const catalog: CatalogItem[] = (exRes.data ?? []).map((e) => ({
    id: e.id as string,
    slug: e.slug as string,
    name: e.name as string,
    isTimed: e.is_timed as boolean,
    category: e.category as string,
    primary: e.primary_muscles as string[],
  }));
  const alternatives: Record<string, string[]> = {};
  for (const a of altRes.data ?? []) (alternatives[a.exercise_id as string] ??= []).push(a.alternative_id as string);

  let template: WorkoutTemplate | null = null;
  let notice: string | null = null;
  const dayId = uuid.safeParse(sp.day);
  if (dayId.success) {
    const day = await getProgramDay(supabase, dayId.data);
    if (day) {
      // Make sure the user is entitled to the program this day belongs to (server-side check).
      const { data: owner } = await supabase
        .from("program_days")
        .select("week:program_weeks(program:training_programs(tier, owner_id))")
        .eq("id", day.id)
        .maybeSingle();
      const program = (owner?.week as unknown as { program: { tier: Plan; owner_id: string | null } } | null)?.program;
      const plan = await getUserPlan(user.id);
      if (program && (program.owner_id === user.id || canAccessTier(plan, program.tier))) {
        const up = uuid.safeParse(sp.up);
        template = {
          name: day.name,
          userProgramId: up.success ? up.data : null,
          programDayId: day.id,
          warmup: day.warmup,
          cooldown: day.cooldown,
          exercises: day.exercises.map((e) => ({
            exercise: { id: e.exercise.id, slug: e.exercise.slug, name: e.exercise.name, isTimed: e.exercise.is_timed },
            restSeconds: e.rest_seconds,
            target: { sets: e.sets, reps: e.reps, seconds: e.duration_seconds, rpe: e.rpe, intensity: e.intensity },
          })),
        };
      } else {
        notice = "That session is part of a program your plan doesn't include. Starting an empty workout instead.";
      }
    }
  }

  const templateId = uuid.safeParse(sp.template);
  if (!template && templateId.success) {
    // Owner-only: getTemplate filters by user id (and RLS).
    const saved = await getTemplate(supabase, user.id, templateId.data);
    if (saved) {
      template = {
        name: saved.name,
        userProgramId: null,
        programDayId: null,
        templateId: saved.id,
        warmup: [],
        cooldown: [],
        exercises: saved.exercises.map((e) => ({
          exercise: { id: e.exerciseId, slug: e.slug, name: e.name, isTimed: e.isTimed },
          restSeconds: e.restSeconds,
          supersetGroup: e.supersetGroup,
          target: {
            sets: e.sets,
            reps: e.target === "reps" ? e.reps : null,
            seconds: e.target === "time" ? e.durationSeconds : null,
            distanceM: e.target === "distance" ? e.distanceM : null,
          },
        })),
      };
    } else {
      notice = "That workout template wasn't found. Starting an empty workout instead.";
    }
  }

  // "Last time" for the exercises this workout starts with (more are fetched as exercises are added).
  const restored = migrateDraft(serverDraft);
  const startIds = [...(template?.exercises.map((e) => e.exercise.id) ?? []), ...(restored?.exercises.map((e) => e.exerciseId) ?? [])];
  const previous = await getPreviousPerformance(supabase, user.id, startIds).catch(() => ({}));

  return (
    <>
      {notice && <p className="mb-4 rounded-xl border border-gold-muted/50 bg-gold/5 px-4 py-3 text-sm">{notice}</p>}
      <WorkoutLogger userId={user.id} units={profile.unit_system} catalog={catalog} alternatives={alternatives} serverDraft={serverDraft}
        template={template}
        previous={previous}
        restAlerts={{ sound: profile.rest_timer_sound ?? true, vibrate: profile.rest_timer_vibrate ?? true }}
      />
    </>
  );
}
