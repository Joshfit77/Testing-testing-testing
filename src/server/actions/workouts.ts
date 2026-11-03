"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { draftSnapshotSchema, editWorkoutSchema, finishWorkoutSchema } from "@/lib/validation/schemas";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
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
  WorkoutError,
  type ExerciseTarget,
  type NewRecord,
  type PreviousSession,
} from "@/server/services/workouts";
import { scriptureForDate } from "@/data/content";
import type { TextPart } from "@/lib/bible/red-letter";
import { scriptureParts } from "@/server/bible/text";
import { nextSessionSummary, type NextSession } from "@/server/services/schedule";
import type { PreviousPerformance } from "@/lib/domain/previous-performance";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function syncWorkoutDraftAction(input: unknown): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = draftSnapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid workout snapshot" };
  try {
    const supabase = await getServerSupabase();
    await saveDraftSnapshot(supabase, user.id, parsed.data);
    return { ok: true, data: null };
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

export async function finishWorkoutAction(input: unknown): Promise<
  Result<{
    sessionId: string;
    volumeKg: number;
    records: NewRecord[];
    badges: UnlockedBadge[];
    next: NextSession | null;
    previous: PreviousSession | null;
    reflection: Reflection | null;
  }>
> {
  const user = await requireUser();
  const parsed = finishWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some workout values are invalid. Check weights, reps and RPE." };
  if (!parsed.data.exercises.some((e) => !e.skipped && e.sets.some((s) => s.completed))) {
    return { ok: false, error: "Complete at least one set before finishing." };
  }
  try {
    const supabase = await getServerSupabase();
    const res = await finishWorkout(supabase, user.id, parsed.data);
    // Badges are worked out from the saved sessions, so a retried finish (first response lost) shows them too.
    const badges = await unlockedBadges(supabase, user.id, res.sessionId);
    const profile = await getProfile(user.id);
    const tz = profile?.timezone ?? "UTC";
    // What the program has next, also after a workout outside it (never blocks the save: the summary goes without).
    const programId =
      parsed.data.userProgramId ??
      ((await supabase.from("user_programs").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle()).data?.id as string | undefined) ??
      null;
    const next = programId
      ? await nextSessionSummary(supabase, user.id, programId, tz).catch((err: unknown) => {
          logError("workouts.finish.next", err);
          return null;
        })
      : null;
    const previous = await previousComparableSession(supabase, user.id, {
      sessionId: res.sessionId,
      startedAt: parsed.data.startedAt,
      programDayId: parsed.data.programDayId,
      name: parsed.data.name,
    }).catch((err: unknown) => {
      logError("workouts.finish.previous", err);
      return null;
    });
    const verse = profile?.faith_enabled ? scriptureForDate(isoDateInTz(new Date(), tz)) : null;
    const reflection = verse ? { reference: verse.reference, parts: scriptureParts(verse.reference, verse.text), prompt: verse.reflection } : null;
    revalidatePath("/", "layout");
    return { ok: true, data: { sessionId: res.sessionId, volumeKg: res.volumeKg, records: res.records, badges, next, previous, reflection } };
  } catch (err) {
    logError("workouts.finish", err);
    return { ok: false, error: err instanceof WorkoutError && err.code === "invalid" ? "One of the exercises is no longer available." : "We couldn't save your workout. It's still on this device — please try again." };
  }
}

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
