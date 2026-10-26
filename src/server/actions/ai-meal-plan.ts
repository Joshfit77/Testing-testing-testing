"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { AI_PLAN_DAYS, MEAL_PLAN_FOCUSES, type MealPlanFocus } from "@/lib/domain/ai-meal-plan";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertFeature, EntitlementError, getUserPlan, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { AiError, getAiAllowance } from "@/server/services/ai-coach";
import { approveMealPlanDraft, draftAiMealPlan, MealPlanError } from "@/server/services/ai-meal-plan";

const draftSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().refine((d) => (AI_PLAN_DAYS as readonly number[]).includes(d), "Choose 1, 3 or 7 days."),
  focus: z.enum(MEAL_PLAN_FOCUSES),
  notes: z.string().trim().max(300, "Keep notes under 300 characters.").optional(),
});

/** AI meal plans need the meal planner (Pro) and the AI allowance (Pro, or kept legacy AI terms). */
async function ctx() {
  const user = await requireUser();
  await assertFeature(user.id, "meal_planning");
  const plan = await getUserPlan(user.id);
  if ((await getAiAllowance(user.id, plan)).chatLimit <= 0) throw new EntitlementError("ai_coach", plan);
  return { user, plan, supabase: await getServerSupabase() };
}

function guard(err: unknown, scope: string): ActionState {
  if (err instanceof EntitlementError) return actionError("AI meal plans are included with Pro.");
  if (err instanceof MealPlanError) return actionError(err.message);
  if (err instanceof AiError) return actionError(err.message);
  logError(scope, err);
  return actionError("Something went wrong. Please try again.");
}

/** Draft a plan with the AI (one of the month's AI messages). It is only a draft until approved. */
export async function draftAiMealPlanAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Check the plan options.");
    const { user, plan, supabase } = await ctx();
    const r = await draftAiMealPlan(supabase, user.id, plan, { ...parsed.data, focus: parsed.data.focus as MealPlanFocus, notes: parsed.data.notes || null });
    return actionOk(r.corrections ? `Draft ready. ${r.corrections} meal${r.corrections === 1 ? " was" : "s were"} filled or adjusted by the regular planner. Review it below.` : "Draft ready. Review it below.");
  } catch (err) {
    return guard(err, "ai_meal_plan.draft");
  }
}

/**
 * Approve the draft: it becomes the plan for its dates (replacing any plan that starts that day). Every dish is
 * checked again against the member's current recipes and exclusions, and all nutrition is taken from the database.
 */
export async function approveAiMealPlanAction(): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const r = await approveMealPlanDraft(supabase, user.id);
    if (!r) return actionError("There's no draft to approve. Draft a new plan first.");
    const { dropped } = r;
    return actionOk(dropped ? `Plan saved. ${dropped} meal${dropped === 1 ? " no longer fits" : "s no longer fit"} your settings and ${dropped === 1 ? "was" : "were"} left empty.` : "Plan saved. Swap meals, adjust portions, log them or build a grocery list below.");
  } catch (err) {
    return guard(err, "ai_meal_plan.approve");
  }
}

export async function discardAiMealPlanAction(): Promise<ActionState> {
  try {
    const user = await requireUser();
    const supabase = await getServerSupabase();
    const { error } = await supabase.from("meal_plan_drafts").delete().eq("user_id", user.id);
    if (error) throw error;
    return actionOk("Draft discarded.");
  } catch (err) {
    return guard(err, "ai_meal_plan.discard");
  }
}
