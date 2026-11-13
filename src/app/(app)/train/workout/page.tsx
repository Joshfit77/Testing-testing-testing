import { requiresWeight } from "@/lib/domain/load";
import { usesDistance } from "@/lib/domain/exercise-tracking";
import { z } from "zod";
import { WorkoutLogger, type WorkoutTemplate } from "@/components/workout/workout-logger";
import type { CatalogItem } from "@/components/workout/exercise-picker";
import { canAccessTier } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getProgramDay } from "@/server/services/training";
import { getExerciseTargets, getPreviousPerformance, getServerDraft } from "@/server/services/workouts";
import { getTemplate } from "@/server/services/templates";
import { migrateDraft } from "@/lib/domain/workout-draft";
import { repeatFromSession, type RepeatSource } from "@/lib/domain/workout-templates";
import type { SessionSlot } from "@/lib/domain/previous-performance";

export const metadata = { title: "Workout" };

const uuid = z.string().uuid();

export default async function WorkoutPage({ searchParams }: { searchParams: Promise<{ day?: string; up?: string; template?: string; repeat?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();

  const [exRes, altRes, serverDraft] = await Promise.all([
    supabase.from("exercises").select("id, slug, name, is_timed, category, equipment, primary_muscles, secondary_muscles, instructions, form_cues, common_mistakes").eq("is_published", true).order("name"),
    supabase.from("exercise_alternatives").select("exercise_id, alternative_id"),
    getServerDraft(supabase, user.id),
  ]);
  const catalog: CatalogItem[] = (exRes.data ?? []).map((e) => ({
    id: e.id as string,
    slug: e.slug as string,
    name: e.name as string,
    isTimed: e.is_timed as boolean,
    category: e.category as string,
    loaded: requiresWeight(e.equipment as string[] | null, { isTimed: e.is_timed as boolean, usesDistance: usesDistance(e.slug as string) }),
    primary: e.primary_muscles as string[],
    secondary: (e.secondary_muscles as string[] | null) ?? [],
    steps: (e.instructions as string[] | null) ?? [],
    cues: (e.form_cues as string[] | null) ?? [],
    mistakes: (e.common_mistakes as string[] | null) ?? [],
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
        .select("week:program_weeks(program:training_programs(id, tier, owner_id))")
        .eq("id", day.id)
        .maybeSingle();
      const program = (owner?.week as unknown as { program: { id: string; tier: Plan; owner_id: string | null } } | null)?.program;
      const plan = await getUserPlan(user.id);
      // Enrolled before library programs became Pro-only: the member keeps the program.
      const enrolled = program ? Boolean((await supabase.from("user_programs").select("id").eq("user_id", user.id).eq("program_id", program.id).limit(1).maybeSingle()).data) : false;
      if (program && (program.owner_id === user.id || canAccessTier(plan, program.tier) || enrolled)) {
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

  // "Do this workout again": a completed workout of the member's own (RLS and the user filter make another member's
  // id look like a missing one), started as a fresh workout with the same exercises and set counts.
  const repeatId = uuid.safeParse(sp.repeat);
  if (!template && repeatId.success) {
    const { data: past } = await supabase
      .from("workout_sessions")
      .select("name, workout_exercises(position, skipped, exercise:exercises!workout_exercises_exercise_id_fkey(id, slug, name, is_timed), sets:workout_sets(set_number, reps, duration_seconds, distance_m, is_warmup, is_drop, completed))")
      .eq("id", repeatId.data)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .maybeSingle();
    const again = past ? repeatFromSession({ name: past.name as string, exercises: (past.workout_exercises ?? []) as unknown as RepeatSource["exercises"] }) : null;
    if (again && again.exercises.length) {
      template = { name: again.name, userProgramId: null, programDayId: null, warmup: [], cooldown: [], exercises: again.exercises };
    } else {
      notice = "That workout wasn't found. Starting an empty workout instead.";
    }
  }

  // "Last time" for the exercises this workout starts with (more are fetched as exercises are added).
  const restored = migrateDraft(serverDraft);
  const startIds = [...(template?.exercises.map((e) => e.exercise.id) ?? []), ...(restored?.exercises.map((e) => e.exerciseId) ?? [])];
  // Which program day this is (from the link, or the workout being resumed): "last time" prefers the same day of the
  // program, and a deload week doesn't pre-fill last week's weights.
  const slot = await sessionSlot(supabase, template?.programDayId ?? restored?.programDayId ?? null);
  const [previous, targets] = await Promise.all([
    getPreviousPerformance(supabase, user.id, startIds, slot).catch(() => ({})),
    getExerciseTargets(supabase, user.id, startIds).catch(() => ({})),
  ]);

  return (
    <>
      <WorkoutLogger userId={user.id} units={profile.unit_system} catalog={catalog} alternatives={alternatives} serverDraft={serverDraft}
        notice={notice}
        template={template}
        previous={previous}
        targets={targets}
        deload={slot?.deload ?? false}
        restAlerts={{ sound: profile.rest_timer_sound ?? true, vibrate: profile.rest_timer_vibrate ?? true }}
      />
    </>
  );
}

async function sessionSlot(supabase: Awaited<ReturnType<typeof getServerSupabase>>, programDayId: string | null): Promise<SessionSlot | null> {
  if (!programDayId) return null;
  const { data } = await supabase.from("program_days").select("day_number, week:program_weeks(program_id, is_deload)").eq("id", programDayId).maybeSingle();
  const week = data?.week as unknown as { program_id: string; is_deload: boolean } | null;
  if (!data || !week) return null;
  return { programId: week.program_id, dayNumber: data.day_number as number, deload: !!week.is_deload };
}
