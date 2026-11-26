"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { draftSnapshotSchema, editWorkoutSchema, finishWorkoutSchema } from "@/lib/validation/schemas";
import { getCurrentUser, getProfile, requireUser } from "@/server/auth";
import { SIGNED_OUT_WORKOUT_MESSAGE } from "@/lib/domain/workout-draft";
import { logError } from "@/server/log";
import { withTimeout } from "@/lib/with-timeout";
import { badgesUnlockedBySession, type BadgeIconName, type BadgeTier } from "@/lib/domain/achievements";
import { isoDateInTz } from "@/lib/domain/dates";
import { getAchievementStats } from "@/server/services/achievements";
import {
  deleteWorkout,
  discardDraft,
  editWorkout,
  finishWorkout,
  getExerciseTargets,
  getPreviousPerformance,
  previousComparableSession,
  saveDraftSnapshot,
  DraftConflictError,
  WorkoutError,
  type DraftSaveResult,
  type ExerciseTarget,
  type NewRecord,
  type PreviousSession,
} from "@/server/services/workouts";
import { scriptureForDate } from "@/data/content";
import type { TextPart } from "@/lib/bible/red-letter";
import { scriptureParts } from "@/server/bible/text";
import { nextSessionSummary, type NextSession } from "@/server/services/schedule";
import type { PreviousPerformance } from "@/lib/domain/previous-performance";
import { reachedMilestones, type ReachedMilestone } from "@/lib/domain/exercise-milestones";
import type { UnitSystem } from "@/lib/domain/types";
import { loadExerciseHistories } from "@/server/services/exercise-history";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function syncWorkoutDraftAction(input: unknown): Promise<Result<DraftSaveResult>> {
  // No redirect when signed out: that pulled the member out of the workout mid-set. The logger keeps the device copy.
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_WORKOUT_MESSAGE };
  const parsed = draftSnapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid workout snapshot" };
  try {
    const supabase = await getServerSupabase();
    const res = await saveDraftSnapshot(supabase, user.id, parsed.data);
    // A copy from a version of the app without revisions (an old tab) only understands ok: anything but a save is
    // reported as not saved, so it keeps its copy and the member's next visit (with the current app) combines them.
    if (parsed.data.baseRev === undefined && res.status !== "saved") return { ok: false, error: "conflict" };
    return { ok: true, data: res };
  } catch (err) {
    logError("workouts.sync_draft", err);
    return { ok: false, error: "Couldn't sync to the server — your workout is still saved on this device." };
  }
}

export async function discardWorkoutAction(clientId: string): Promise<Result<null>> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(clientId);
  if (!id.success) return { ok: false, error: "Invalid workout" };
  try {
    const supabase = await getServerSupabase();
    await discardDraft(supabase, user.id, id.data);
    return { ok: true, data: null };
  } catch (err) {
    logError("workouts.discard", err);
    return { ok: false, error: "Couldn't discard the workout on the server." };
  }
}

export interface UnlockedBadge {
  id: string;
  name: string;
  description: string;
  icon: BadgeIconName;
  tier: BadgeTier;
}

/** Badges this session unlocked. Best-effort: a failure here never fails the finish. */
async function unlockedBadges(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string, sessionId: string): Promise<UnlockedBadge[]> {
  try {
    const tz = (await getProfile(userId))?.timezone ?? "UTC";
    const stats = await getAchievementStats(supabase, userId, tz);
    return badgesUnlockedBySession(stats, sessionId, isoDateInTz(new Date(), tz)).map(({ id, name, description, icon, tier }) => ({ id, name, description, icon, tier }));
  } catch (err) {
    logError("workouts.finish.badges", err);
    return [];
  }
}

export type { NextSession } from "@/server/services/schedule";
export type { PreviousSession } from "@/server/services/workouts";

/** An optional verse to close the session with (only for members who let workouts draw on Scripture). */
export interface Reflection {
  reference: string;
  parts: TextPart[];
  prompt: string;
}

/** For each exercise in a just-saved session, the milestones its sets reached (all-time history, paged). */
async function milestonesReached(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string, sessionId: string, exerciseIds: string[], units: UnitSystem): Promise<ReachedMilestone[]> {
  const ids = [...new Set(exerciseIds)];
  if (!ids.length) return [];
  const [{ data: exs }, histories] = await Promise.all([supabase.from("exercises").select("id, slug, name").in("id", ids), loadExerciseHistories(supabase, userId, ids)]);
  return reachedMilestones(
    ((exs ?? []) as { id: string; slug: string; name: string }[]).map((e) => ({ ...e, sessions: histories.get(e.id)?.sessions ?? [] })),
    sessionId,
    units,
  );
}

export async function finishWorkoutAction(input: unknown): Promise<
  | Result<{
      sessionId: string;
      volumeKg: number;
      records: NewRecord[];
      badges: UnlockedBadge[];
      milestones: ReachedMilestone[];
      next: NextSession | null;
      previous: PreviousSession | null;
      reflection: Reflection | null;
      /** This workout had already been finished (another device, or a lost reply); this many sets were added to it. */
      addedSets?: number;
      /** Sets both devices completed with different numbers; the numbers saved first were kept. */
      differingSets?: number;
      alreadyCompleted?: boolean;
    }>
  // The account's copy changed since this device last saw it (F-30): nothing was saved; combine and finish again.
  | { ok: false; error: "conflict"; conflict: { rev: number; draft: unknown } }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_WORKOUT_MESSAGE };
  const parsed = finishWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some workout values are invalid. Check weights, reps and RPE." };
  if (!parsed.data.exercises.some((e) => !e.skipped && e.sets.some((s) => s.completed))) {
    return { ok: false, error: "Complete at least one set before finishing." };
  }
  let supabase: Awaited<ReturnType<typeof getServerSupabase>>;
  let res: Awaited<ReturnType<typeof finishWorkout>>;
  try {
    supabase = await getServerSupabase();
    res = await finishWorkout(supabase, user.id, parsed.data);
  } catch (err) {
    if (err instanceof DraftConflictError) return { ok: false, error: "conflict", conflict: { rev: err.rev, draft: err.draft } };
    logError("workouts.finish", err);
    return { ok: false, error: err instanceof WorkoutError && err.code === "invalid" ? "One of the exercises is no longer available." : "We couldn't save your workout. It's still on this device — please try again." };
  }

  // The workout is saved. Everything below only fills in the summary screen: each part runs at the same time, has its
  // own time limit, and on failure is simply left out. None of it can turn a saved workout into "couldn't save" (O-12).
  const sessionId = res.sessionId;
  const extra = <T,>(scope: string, p: Promise<T>, fallback: T): Promise<T> =>
    withTimeout(p, FINISH_EXTRAS_TIMEOUT_MS).catch((err: unknown) => {
      logError(`workouts.finish.${scope}`, err);
      return fallback;
    });
  const profilePromise = extra("profile", getProfile(user.id), null);
  const programIdPromise: Promise<string | null> = parsed.data.userProgramId
    ? Promise.resolve(parsed.data.userProgramId)
    : extra(
        "program",
        Promise.resolve(supabase.from("user_programs").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle()).then((r) => (r.data?.id as string | undefined) ?? null),
        null,
      );
  const [badges, profile, programId, previous] = await Promise.all([
    // Badges are worked out from the saved sessions, so a retried finish (first response lost) shows them too.
    extra("badges", unlockedBadges(supabase, user.id, sessionId), [] as UnlockedBadge[]),
    profilePromise,
    programIdPromise,
    extra(
      "previous",
      previousComparableSession(supabase, user.id, { sessionId, startedAt: parsed.data.startedAt, programDayId: parsed.data.programDayId, name: parsed.data.name }),
      null,
    ),
  ]);
  const tz = profile?.timezone ?? "UTC";
  const [milestones, next] = await Promise.all([
    // Milestones this session reached, from the saved history (so a retried finish shows them too).
    extra(
      "milestones",
      milestonesReached(supabase, user.id, sessionId, parsed.data.exercises.filter((e) => !e.skipped).map((e) => e.exerciseId), profile?.unit_system ?? "imperial"),
      [] as ReachedMilestone[],
    ),
    // What the program has next, also after a workout outside it.
    programId ? extra("next", nextSessionSummary(supabase, user.id, programId, tz), null) : Promise.resolve(null),
  ]);
  const verse = profile?.faith_enabled ? scriptureForDate(isoDateInTz(new Date(), tz)) : null;
  const reflection = verse ? { reference: verse.reference, parts: scriptureParts(verse.reference, verse.text), prompt: verse.reflection } : null;
  revalidatePath("/", "layout");
  return {
    ok: true,
    data: { sessionId, volumeKg: res.volumeKg, records: res.records, badges, milestones, next, previous, reflection, addedSets: res.addedSets, differingSets: res.differingSets ?? 0, alreadyCompleted: res.alreadyCompleted },
  };
}

/** How long each part of the summary screen may take after the workout is saved before it is left out. */
const FINISH_EXTRAS_TIMEOUT_MS = 8_000;

export async function editWorkoutAction(input: unknown): Promise<Result<{ volumeKg: number }>> {
  const user = await requireUser();
  const parsed = editWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some workout values are invalid." };
  try {
    const supabase = await getServerSupabase();
    const res = await editWorkout(supabase, user.id, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: res };
  } catch (err) {
    if (err instanceof WorkoutError && err.code === "not_found") return { ok: false, error: "Workout not found." };
    logError("workouts.edit", err);
    return { ok: false, error: "We couldn't save your changes. Please try again." };
  }
}

export async function deleteWorkoutAction(sessionId: string): Promise<Result<null>> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(sessionId);
  if (!id.success) return { ok: false, error: "Invalid workout" };
  try {
    const supabase = await getServerSupabase();
    await deleteWorkout(supabase, user.id, id.data);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (err) {
    logError("workouts.delete", err);
    return { ok: false, error: "We couldn't delete this workout." };
  }
}

/** Previous performance for exercises added during a workout (the page preloads the ones it starts with). */
export async function previousPerformanceAction(exerciseIds: unknown): Promise<Result<Record<string, PreviousPerformance>> & { targets?: Record<string, ExerciseTarget> }> {
  const user = await requireUser();
  const ids = z.array(z.string().uuid()).max(40).safeParse(exerciseIds);
  if (!ids.success) return { ok: false, error: "Invalid exercises" };
  try {
    const supabase = await getServerSupabase();
    const [data, targets] = await Promise.all([getPreviousPerformance(supabase, user.id, ids.data), getExerciseTargets(supabase, user.id, ids.data).catch(() => ({}))]);
    return { ok: true, data, targets };
  } catch (err) {
    logError("workouts.previous", err);
    return { ok: false, error: "Couldn't load your previous sets." };
  }
}
