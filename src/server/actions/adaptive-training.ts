"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { analyzeTraining, applyModification, trainingModifySchema } from "@/lib/domain/adaptive-training";
import { getUserPlan, requireUser } from "@/server/auth";
import { getAiAllowance } from "@/server/services/ai-coach";
import { applyTrainingChange, loadReviewInput, TrainingChangeError, undoTrainingAdjustment } from "@/server/services/adaptive-training";
import { logError } from "@/server/log";

type Result = { ok: true; message: string } | { ok: false; error: string };

const keySchema = z.string().min(3).max(200);

async function requireAdaptive(userId: string): Promise<boolean> {
  return (await getAiAllowance(userId, await getUserPlan(userId))).chatLimit > 0;
}

function revalidate() {
  revalidatePath("/train/review");
  revalidatePath("/train", "layout");
  revalidatePath("/home");
}

/**
 * Accept a recommendation from the training review, optionally adjusted. The recommendation is recomputed here from
 * the member's current data (never trusted from the browser), so a stale or forged one can't be applied.
 */
export async function acceptRecommendationAction(key: string, modify?: unknown): Promise<Result> {
  const user = await requireUser();
  const k = keySchema.safeParse(key);
  const m = trainingModifySchema.safeParse(modify ?? {});
  if (!k.success) return { ok: false, error: "Recommendation not found." };
  if (!m.success) return { ok: false, error: m.error.issues[0]?.message ?? "Invalid change." };
  if (!(await requireAdaptive(user.id))) return { ok: false, error: "Adaptive training is included with Pro." };
  const supabase = await getServerSupabase();
  try {
    const { input } = await loadReviewInput(supabase, user.id);
    const rec = analyzeTraining(input).recommendations.find((r) => r.key === k.data);
    if (!rec) return { ok: false, error: "That recommendation no longer applies to your latest training." };
    if (!rec.change) return { ok: false, error: rec.blocked ?? "This one is advice only; nothing in the app needs to change." };
    const change = applyModification(rec.change, m.data, input.units);
    const r = await applyTrainingChange(supabase, user.id, change, { source: "review", reason: [rec.title, ...rec.why].join(" "), recommendationKey: rec.key, units: input.units });
    await supabase.from("training_recommendation_decisions").upsert({ user_id: user.id, recommendation_key: rec.key, decision: "accepted", decided_at: new Date().toISOString() });
    revalidate();
    return { ok: true, message: r.summary };
  } catch (err) {
    if (err instanceof TrainingChangeError) return { ok: false, error: err.message };
    logError("adaptive.accept", err);
    return { ok: false, error: "Couldn't apply that change. Nothing was changed." };
  }
}

export async function rejectRecommendationAction(key: string): Promise<Result> {
  const user = await requireUser();
  const k = keySchema.safeParse(key);
  if (!k.success) return { ok: false, error: "Recommendation not found." };
  if (!(await requireAdaptive(user.id))) return { ok: false, error: "Adaptive training is included with Pro." };
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("training_recommendation_decisions")
    .upsert({ user_id: user.id, recommendation_key: k.data, decision: "rejected", decided_at: new Date().toISOString() });
  if (error) {
    logError("adaptive.reject", error);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
  revalidatePath("/train/review");
  return { ok: true, message: "Okay, it won't be suggested again." };
}

/** Bring back a suggestion that was turned down: the decision row goes, so it shows again while it still applies. */
export async function restoreRecommendationAction(key: string): Promise<Result> {
  const user = await requireUser();
  const k = keySchema.safeParse(key);
  if (!k.success) return { ok: false, error: "Recommendation not found." };
  if (!(await requireAdaptive(user.id))) return { ok: false, error: "Adaptive training is included with Pro." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("training_recommendation_decisions").delete().eq("user_id", user.id).eq("recommendation_key", k.data).eq("decision", "rejected");
  if (error) {
    logError("adaptive.restore", error);
    return { ok: false, error: "Couldn't bring that back. Please try again." };
  }
  revalidatePath("/train/review");
  return { ok: true, message: "Shown again." };
}

export async function undoAdjustmentAction(adjustmentId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(adjustmentId);
  if (!id.success) return { ok: false, error: "That change wasn't found." };
  const supabase = await getServerSupabase();
  try {
    const message = await undoTrainingAdjustment(supabase, user.id, id.data);
    revalidate();
    return { ok: true, message };
  } catch (err) {
    if (err instanceof TrainingChangeError) return { ok: false, error: err.message };
    logError("adaptive.undo", err);
    return { ok: false, error: "Couldn't undo that change. Please try again." };
  }
}

/** Remove an approved target load (from the logger or the review). */
export async function clearExerciseTargetAction(exerciseSlug: string): Promise<Result> {
  const user = await requireUser();
  const slug = z.string().regex(/^[a-z0-9-]{2,80}$/).safeParse(exerciseSlug);
  if (!slug.success) return { ok: false, error: "Exercise not found." };
  const supabase = await getServerSupabase();
  const { data: ex } = await supabase.from("exercises").select("id").eq("slug", slug.data).maybeSingle();
  if (!ex) return { ok: false, error: "Exercise not found." };
  const { error } = await supabase.from("exercise_targets").delete().eq("user_id", user.id).eq("exercise_id", ex.id);
  if (error) {
    logError("adaptive.clear_target", error);
    return { ok: false, error: "Couldn't remove the target." };
  }
  revalidate();
  return { ok: true, message: "Target removed." };
}
