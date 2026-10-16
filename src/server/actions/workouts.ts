"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { draftSnapshotSchema, editWorkoutSchema, finishWorkoutSchema } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { deleteWorkout, discardDraft, editWorkout, finishWorkout, saveDraftSnapshot, WorkoutError, type NewRecord } from "@/server/services/workouts";

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

export async function finishWorkoutAction(input: unknown): Promise<Result<{ sessionId: string; volumeKg: number; records: NewRecord[] }>> {
  const user = await requireUser();
  const parsed = finishWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some workout values are invalid. Check weights, reps and RPE." };
  if (!parsed.data.exercises.some((e) => !e.skipped && e.sets.some((s) => s.completed))) {
    return { ok: false, error: "Complete at least one set before finishing." };
  }
  try {
    const supabase = await getServerSupabase();
    const res = await finishWorkout(supabase, user.id, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: { sessionId: res.sessionId, volumeKg: res.volumeKg, records: res.records } };
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
