"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { aiPlanStrictSchema, aiPlanToProgramSeed, validateAiPlan } from "@/lib/validation/ai";
import { getUserPlan, requireUser } from "@/server/auth";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";
import { getAiAllowance } from "@/server/services/ai-coach";
import { logError } from "@/server/log";
import { checkNutritionTargets, coachProposalSchema } from "@/lib/coach/tools";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import type { Sex } from "@/lib/domain/nutrition";
import { getActiveProgramRef } from "@/server/coach/snapshot";
import { approvedChangeMemory, findDuplicateMemory, MEMORY_LIMIT, memoryInputSchema } from "@/lib/coach/memory";
import type { CoachProposal } from "@/lib/coach/tools";
import type { SupabaseClient } from "@supabase/supabase-js";

type Result = { ok: true; message: string; programSlug?: string } | { ok: false; error: string };

/** Save an AI proposal as a private program — only after the user explicitly approves it. */
export async function applyProposalAction(messageId: string, activate: boolean): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid proposal." };
  if ((await getAiAllowance(user.id, await getUserPlan(user.id))).planLimit <= 0) return { ok: false, error: "Saving AI plans requires Pro." };
  const supabase = await getServerSupabase();
  const { data: msg } = await supabase.from("ai_messages").select("id, proposal, proposal_status").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!msg?.proposal) return { ok: false, error: "Proposal not found." };
  if (msg.proposal_status !== "proposed") return { ok: false, error: "This proposal was already handled." };

  // Re-validate before saving: never trust stored JSON blindly.
  const { data: exRows } = await supabase.from("exercises").select("slug").eq("is_published", true);
  const validation = validateAiPlan(msg.proposal, new Set((exRows ?? []).map((e) => e.slug as string)));
  if (!validation.ok) return { ok: false, error: "This plan no longer passes validation and can't be saved." };
  const { data: answers } = await supabase.from("onboarding_answers").select("primary_goal").eq("user_id", user.id).maybeSingle();

  // Claim the proposal first, so a second tap (or another tab) can't save the same plan twice.
  const { data: claimed, error: claimErr } = await supabase
    .from("ai_messages")
    .update({ proposal_status: "applied" })
    .eq("id", msg.id)
    .eq("user_id", user.id)
    .eq("proposal_status", "proposed")
    .select("id");
  if (claimErr) {
    logError("coach.apply_claim", claimErr);
    return { ok: false, error: "Couldn't save the plan. Please try again." };
  }
  if (!claimed?.length) return { ok: false, error: "This proposal was already handled." };

  try {
    const seed = aiPlanToProgramSeed(aiPlanStrictSchema.parse(validation.plan), answers?.primary_goal ? [answers.primary_goal as string] : []);
    const programId = await createPrivateProgram(supabase, user.id, seed, "ai");
    if (activate) await activateProgram(supabase, user.id, programId);
    else {
      const { error: saveErr } = await supabase.from("user_programs").insert({ user_id: user.id, program_id: programId, status: "saved" });
      if (saveErr) throw saveErr;
    }
    const { data: p } = await supabase.from("training_programs").select("slug").eq("id", programId).single();
    revalidatePath("/", "layout");
    return { ok: true, message: activate ? "Plan saved and activated." : "Plan saved to My programs.", programSlug: p?.slug as string };
  } catch (err) {
    logError("coach.apply", err);
    // Let them try again.
    await supabase.from("ai_messages").update({ proposal_status: "proposed" }).eq("id", msg.id).eq("user_id", user.id);
    return { ok: false, error: "Couldn't save the plan. Please try again." };
  }
}

export async function dismissProposalAction(messageId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid proposal." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("ai_messages").update({ proposal_status: "dismissed" }).eq("id", id.data).eq("user_id", user.id).eq("proposal_status", "proposed");
  if (error) {
    logError("coach.dismiss", error);
    return { ok: false, error: "Couldn't dismiss that suggestion. Please try again." };
  }
  return { ok: true, message: "Dismissed." };
}

export async function deleteConversationAction(conversationId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(conversationId);
  if (!id.success) return { ok: false, error: "Invalid conversation." };
  const supabase = await getServerSupabase();
  const { error, count } = await supabase.from("ai_conversations").delete({ count: "exact" }).eq("id", id.data).eq("user_id", user.id);
  if (error) {
    logError("coach.delete_conversation", error);
    return { ok: false, error: "Couldn't delete the conversation. Please try again." };
  }
  if (!count) return { ok: false, error: "Conversation not found." };
  revalidatePath("/coach");
  return { ok: true, message: "Conversation deleted." };
}

/**
 * Apply a coach-suggested change (exercise swap, nutrition targets, bodyweight entry) — only ever called
 * from the explicit Confirm button on the suggestion card. Everything is re-validated here against the
 * user's current data; the model never writes anything itself.
 */
export async function applyCoachProposalAction(messageId: string, edited?: { category: string; content: string }): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid suggestion." };
  if ((await getAiAllowance(user.id, await getUserPlan(user.id))).chatLimit <= 0) return { ok: false, error: "Coach suggestions are included with Pro." };
  const supabase = await getServerSupabase();
  const { data: msg } = await supabase.from("ai_messages").select("id, conversation_id, proposal, proposal_status").eq("id", id.data).eq("user_id", user.id).eq("role", "assistant").maybeSingle();
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
    } else if (p.kind === "memory") {
      // The member may edit the note before saving it; whatever is saved is validated again here.
      const input = memoryInputSchema.safeParse(edited ?? { category: p.category, content: p.content });
      if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Invalid memory." };
      const { data: prof } = await supabase.from("profiles").select("coach_memory_enabled").eq("id", user.id).maybeSingle();
      if (!prof?.coach_memory_enabled) return { ok: false, error: "Memory is switched off. Turn it on in AI Coach → Memory first." };
      const { data: existing } = await supabase.from("coach_memories").select("content").eq("user_id", user.id);
      const dup = findDuplicateMemory(input.data.content, existing ?? []);
      if (dup) return { ok: false, error: `Already remembered: "${dup.content}"` };
      const { error } = await supabase.from("coach_memories").insert({ user_id: user.id, ...input.data, source: "coach", source_message_id: msg.id });
      if (error) {
        if (error.message.includes("coach_memory_limit")) return { ok: false, error: `You can keep up to ${MEMORY_LIMIT} memories. Delete some in AI Coach → Memory first.` };
        throw error;
      }
      message = "Saved to your coaching memory.";
    } else if (p.kind === "memory_forget") {
      const { error, count } = await supabase.from("coach_memories").delete({ count: "exact" }).eq("id", p.memoryId).eq("user_id", user.id);
      if (error) throw error;
      message = count ? "Forgotten." : "That memory was already deleted.";
    } else {
      const { data: prof } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      const today = isoDateInTz(new Date(), (prof?.timezone as string) || "UTC");
      if (p.date > today || p.date < addDays(today, -365)) return { ok: false, error: "That date can't be logged." };
      const { error } = await supabase.from("weight_entries").upsert({ user_id: user.id, recorded_on: p.date, weight_kg: p.weightKg }, { onConflict: "user_id,recorded_on" });
      if (error) throw error;
      message = `Logged ${p.display} for ${p.date}.`;
    }
    await supabase.from("ai_messages").update({ proposal_status: "applied" }).eq("id", msg.id).eq("user_id", user.id);
    if (p.kind === "exercise_swap" || p.kind === "nutrition_targets") await rememberApprovedChange(supabase, user.id, msg.conversation_id as string, p);
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (err) {
    logError("coach.apply_suggestion", err);
    return { ok: false, error: "Couldn't apply that change. Please try again." };
  }
}

/**
 * With coaching memory on (and not switched off for that chat), a change the member confirmed is noted, so the coach
 * knows later what was changed and why. Best effort: the change itself has already been applied.
 */
async function rememberApprovedChange(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  p: Extract<CoachProposal, { kind: "exercise_swap" | "nutrition_targets" }>,
) {
  try {
    const [{ data: prof }, { data: conv }] = await Promise.all([
      supabase.from("profiles").select("coach_memory_enabled, timezone").eq("id", userId).maybeSingle(),
      supabase.from("ai_conversations").select("memory_off").eq("id", conversationId).eq("user_id", userId).maybeSingle(),
    ]);
    if (!prof?.coach_memory_enabled || conv?.memory_off) return;
    const date = isoDateInTz(new Date(), (prof.timezone as string) || "UTC");
    const note = approvedChangeMemory(
      p.kind === "exercise_swap"
        ? { kind: "exercise_swap", from: p.from.name, to: p.to.name, scope: p.scope, reason: p.reason }
        : { kind: "nutrition_targets", calories: p.calories, protein_g: p.protein_g, reason: p.reason },
      date,
    );
    const { error } = await supabase.from("coach_memories").insert({ user_id: userId, ...note, source: "approved_change" });
    if (error && !error.message.includes("coach_memory_limit")) logError("coach.remember_change", error);
  } catch (err) {
    logError("coach.remember_change", err);
  }
}
