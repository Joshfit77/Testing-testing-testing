"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { aiPlanStrictSchema, aiPlanToProgramSeed, validateAiPlan } from "@/lib/validation/ai";
import { getUserPlan, requireUser } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";
import { logError } from "@/server/log";
import { checkNutritionTargets, coachProposalSchema } from "@/lib/coach/tools";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import type { Sex } from "@/lib/domain/nutrition";
import { getActiveProgramRef } from "@/server/coach/snapshot";

type Result = { ok: true; message: string; programSlug?: string } | { ok: false; error: string };

/** Save an AI proposal as a private program — only after the user explicitly approves it. */
export async function applyProposalAction(messageId: string, activate: boolean): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid proposal." };
  if (!hasFeature(await getUserPlan(user.id), "ai_plan_generation")) return { ok: false, error: "Saving AI plans requires Pro." };
  const supabase = await getServerSupabase();
  const { data: msg } = await supabase.from("ai_messages").select("id, proposal, proposal_status").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!msg?.proposal) return { ok: false, error: "Proposal not found." };
  if (msg.proposal_status !== "proposed") return { ok: false, error: "This proposal was already handled." };

  // Re-validate before saving: never trust stored JSON blindly.
  const { data: exRows } = await supabase.from("exercises").select("slug").eq("is_published", true);
  const validation = validateAiPlan(msg.proposal, new Set((exRows ?? []).map((e) => e.slug as string)));
  if (!validation.ok) return { ok: false, error: "This plan no longer passes validation and can't be saved." };
  const { data: answers } = await supabase.from("onboarding_answers").select("primary_goal").eq("user_id", user.id).maybeSingle();

  try {
    const seed = aiPlanToProgramSeed(aiPlanStrictSchema.parse(validation.plan), answers?.primary_goal ? [answers.primary_goal as string] : []);
    const programId = await createPrivateProgram(supabase, user.id, seed, "ai");
    if (activate) await activateProgram(supabase, user.id, programId);
    else await supabase.from("user_programs").insert({ user_id: user.id, program_id: programId, status: "saved" });
    await supabase.from("ai_messages").update({ proposal_status: "applied" }).eq("id", msg.id);
    const { data: p } = await supabase.from("training_programs").select("slug").eq("id", programId).single();
    revalidatePath("/", "layout");
    return { ok: true, message: activate ? "Plan saved and activated." : "Plan saved to My programs.", programSlug: p?.slug as string };
  } catch (err) {
    logError("coach.apply", err);
    return { ok: false, error: "Couldn't save the plan. Please try again." };
  }
}

export async function dismissProposalAction(messageId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid proposal." };
  const supabase = await getServerSupabase();
  await supabase.from("ai_messages").update({ proposal_status: "dismissed" }).eq("id", id.data).eq("user_id", user.id).eq("proposal_status", "proposed");
  return { ok: true, message: "Dismissed." };
}

export async function deleteConversationAction(conversationId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(conversationId);
  if (!id.success) return { ok: false, error: "Invalid conversation." };
  const supabase = await getServerSupabase();
  await supabase.from("ai_conversations").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/coach");
  return { ok: true, message: "Conversation deleted." };
}

/**
 * Apply a coach-suggested change (exercise swap, nutrition targets, bodyweight entry) — only ever called
 * from the explicit Confirm button on the suggestion card. Everything is re-validated here against the
 * user's current data; the model never writes anything itself.
 */
export async function applyCoachProposalAction(messageId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid suggestion." };
  if (!hasFeature(await getUserPlan(user.id), "ai_coach")) return { ok: false, error: "Coach suggestions are included with Pro." };
  const supabase = await getServerSupabase();
  const { data: msg } = await supabase.from("ai_messages").select("id, proposal, proposal_status").eq("id", id.data).eq("user_id", user.id).eq("role", "assistant").maybeSingle();
  if (!msg?.proposal) return { ok: false, error: "Suggestion not found." };
  if (msg.proposal_status !== "proposed") return { ok: false, error: "This suggestion was already handled." };
  const parsed = coachProposalSchema.safeParse(msg.proposal);
  if (!parsed.success) return { ok: false, error: "This suggestion can't be applied." };
  const p = parsed.data;

  try {
    let message: string;
    if (p.kind === "exercise_swap") {
      const ref = await getActiveProgramRef(supabase, user.id);
      if (!ref) return { ok: false, error: "You don't have an active program anymore." };
      if (!ref.editable || ref.name !== p.programName) return { ok: false, error: "This program can't be edited here. Use Swap in the workout logger instead." };
      const { data: exRows } = await supabase.from("exercises").select("id, slug").in("slug", [p.from.slug, p.to.slug]);
      const fromId = exRows?.find((e) => e.slug === p.from.slug)?.id as string | undefined;
      const toId = exRows?.find((e) => e.slug === p.to.slug)?.id as string | undefined;
      if (!fromId || !toId) return { ok: false, error: "One of those exercises is no longer available." };
      const { data: rows } = await supabase
        .from("program_exercises")
        .select("id, day:program_days!inner(day_number, week:program_weeks!inner(program_id, week_number))")
        .eq("exercise_id", fromId)
        .eq("day.week.program_id", ref.programId)
        .gte("day.week.week_number", ref.currentWeek);
      const candidates = ((rows ?? []) as unknown as { id: string; day: { day_number: number; week: { week_number: number } } }[])
        .map((r) => ({ id: r.id, week: r.day.week.week_number, day: r.day.day_number }))
        .filter((r) => r.week > ref.currentWeek || r.day >= ref.currentDay || p.scope === "rest_of_program")
        .sort((a, b) => a.week - b.week || a.day - b.day);
      if (!candidates.length) return { ok: false, error: `${p.from.name} isn't in the rest of your program.` };
      const first = candidates[0]!;
      const target = p.scope === "next_workout" ? candidates.filter((c) => c.week === first.week && c.day === first.day) : candidates;
      const { data: updated, error } = await supabase.from("program_exercises").update({ exercise_id: toId }).in("id", target.map((t) => t.id)).select("id");
      if (error) throw error;
      if (!updated?.length) return { ok: false, error: "Couldn't change this program. Use Swap in the workout logger instead." };
      message = p.scope === "next_workout" ? `Swapped ${p.from.name} for ${p.to.name} in your next session.` : `Swapped ${p.from.name} for ${p.to.name} for the rest of the program.`;
    } else if (p.kind === "nutrition_targets") {
      const [{ data: prof }, { data: w }, { data: current }] = await Promise.all([
        supabase.from("profiles").select("sex").eq("id", user.id).maybeSingle(),
        supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("nutrition_goals").select("water_ml").eq("user_id", user.id).maybeSingle(),
      ]);
      const errors = checkNutritionTargets(p, { sex: (prof?.sex as Sex | null) ?? null, weightKg: w ? Number(w.weight_kg) : null });
      if (errors.length) return { ok: false, error: errors[0]! };
      const { error } = await supabase.from("nutrition_goals").upsert({
        user_id: user.id,
        calories: p.calories,
        protein_g: p.protein_g,
        carbs_g: p.carbs_g,
        fat_g: p.fat_g,
        water_ml: (current?.water_ml as number | undefined) ?? 2500,
        is_estimate: false,
      });
      if (error) throw error;
      message = `Targets updated: ${p.calories} kcal, ${p.protein_g} g protein.`;
    } else {
      const { data: prof } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      const today = isoDateInTz(new Date(), (prof?.timezone as string) || "UTC");
      if (p.date > today || p.date < addDays(today, -365)) return { ok: false, error: "That date can't be logged." };
      const { error } = await supabase.from("weight_entries").upsert({ user_id: user.id, recorded_on: p.date, weight_kg: p.weightKg }, { onConflict: "user_id,recorded_on" });
      if (error) throw error;
      message = `Logged ${p.display} for ${p.date}.`;
    }
    await supabase.from("ai_messages").update({ proposal_status: "applied" }).eq("id", msg.id).eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (err) {
    logError("coach.apply_suggestion", err);
    return { ok: false, error: "Couldn't apply that change. Please try again." };
  }
}
