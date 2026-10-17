"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { aiPlanStrictSchema, aiPlanToProgramSeed, validateAiPlan } from "@/lib/validation/ai";
import { getUserPlan, requireUser } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";
import { logError } from "@/server/log";

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
