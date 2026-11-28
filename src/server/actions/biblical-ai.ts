"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import type { ValidatedAnswer } from "@/lib/biblical-ai/answer";
import { STUDY_DURATIONS } from "@/lib/biblical-ai/config";
import { getUserPlan, requireAdmin, requireUser } from "@/server/auth";
import { logError, logInfo } from "@/server/log";
import { biblicalAiFlagOn, generateStudyPlan, type PlanResult } from "@/server/services/biblical-ai";

/*
 * Biblical AI actions. Every one checks the signed-in member on the server and touches only that member's rows
 * (members can read and delete their own rows under RLS; inserts and updates go through the service role here, always
 * filtered by the member's id). Nothing here calls the AI provider except generateStudyAction.
 */

type Result = { ok: true; id?: string } | { ok: false; error: string };
const OFF: Result = { ok: false, error: "Biblical AI isn't available." };
const id = z.string().uuid();

async function member(): Promise<{ userId: string } | null> {
  const user = await requireUser();
  if (!(await biblicalAiFlagOn())) return null;
  return { userId: user.id };
}

export async function renameConversationAction(conversationId: string, title: string): Promise<Result> {
  const m = await member();
  if (!m) return OFF;
  const t = z.string().trim().min(1).max(120).safeParse(title);
  if (!id.safeParse(conversationId).success || !t.success) return { ok: false, error: "Enter a title of up to 120 characters." };
  const { data, error } = await getServiceSupabase().from("biblical_ai_conversations").update({ title: t.data, updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", m.userId).select("id");
  if (error) {
    logError("biblical_ai.rename", error);
    return { ok: false, error: "Couldn't rename it. Please try again." };
  }
  if (!data?.length) return { ok: false, error: "That conversation no longer exists." };
  revalidatePath("/faith/biblical-ai");
  return { ok: true };
}

/** Delete one conversation and its messages (RLS: the member's own only). Saved copies of its answers are kept. */
export async function deleteConversationAction(conversationId: string): Promise<Result> {
  await requireUser();
  if (!id.safeParse(conversationId).success) return { ok: false, error: "Not found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("biblical_ai_conversations").delete().eq("id", conversationId);
  if (error) {
    logError("biblical_ai.delete_conversation", error);
    return { ok: false, error: "Couldn't delete it. Please try again." };
  }
  revalidatePath("/faith/biblical-ai");
  return { ok: true };
}

/** Delete every Biblical AI conversation (saved studies are kept unless the member deletes them too). */
export async function deleteAllConversationsAction(): Promise<Result> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("biblical_ai_conversations").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't delete your history. Please try again." };
  // Reports keep only their kind and note: the copies of questions and answers go with the history.
  const reports = await getServiceSupabase().from("biblical_ai_feedback").update({ question: null, answer: null }).eq("user_id", user.id);
  if (reports.error) logError("biblical_ai.delete_all_reports", reports.error);
  revalidatePath("/faith/biblical-ai");
  return { ok: true };
}

/** Save an answer to the member's studies (a copy: deleting the conversation later keeps it). */
export async function saveAnswerAction(messageId: string, bookmarked = false): Promise<Result> {
  const m = await member();
  if (!m) return OFF;
  if (!id.safeParse(messageId).success) return { ok: false, error: "Not found." };
  const service = getServiceSupabase();
  const { data: msg } = await service.from("biblical_ai_messages").select("id, conversation_id, answer").eq("id", messageId).eq("user_id", m.userId).eq("role", "assistant").maybeSingle();
  if (!msg?.answer) return { ok: false, error: "That answer no longer exists." };
  const { data: existing } = await service.from("biblical_ai_saved_studies").select("id").eq("user_id", m.userId).eq("message_id", messageId).maybeSingle();
  if (existing) {
    if (bookmarked) await service.from("biblical_ai_saved_studies").update({ bookmarked: true, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", m.userId);
    return { ok: true, id: existing.id as string };
  }
  const answer = msg.answer as ValidatedAnswer;
  const { data, error } = await service
    .from("biblical_ai_saved_studies")
    .insert({ user_id: m.userId, kind: "answer", title: answer.title.slice(0, 120) || "Bible study", conversation_id: msg.conversation_id, message_id: messageId, content: { answer }, bookmarked })
    .select("id")
    .single();
  if (error || !data) {
    logError("biblical_ai.save", error);
    return { ok: false, error: "Couldn't save it. Please try again." };
  }
  revalidatePath("/faith/biblical-ai/saved");
  return { ok: true, id: data.id as string };
}

export async function updateSavedStudyAction(studyId: string, input: { note?: string | null; bookmarked?: boolean; title?: string }): Promise<Result> {
  const m = await member();
  if (!m) return OFF;
  const parsed = z.object({ note: z.string().max(4000).nullish(), bookmarked: z.boolean().optional(), title: z.string().trim().min(1).max(120).optional() }).safeParse(input);
  if (!id.safeParse(studyId).success || !parsed.success) return { ok: false, error: "Check what you entered." };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.note !== undefined) patch.note = parsed.data.note?.trim() || null;
  if (parsed.data.bookmarked !== undefined) patch.bookmarked = parsed.data.bookmarked;
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  const { data, error } = await getServiceSupabase().from("biblical_ai_saved_studies").update(patch).eq("id", studyId).eq("user_id", m.userId).select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't update it." };
  revalidatePath("/faith/biblical-ai/saved");
  return { ok: true };
}

/** Mark a day of a personalized study done or not done. */
export async function setStudyDayDoneAction(studyId: string, day: number, done: boolean): Promise<Result> {
  const m = await member();
  if (!m) return OFF;
  if (!id.safeParse(studyId).success || !Number.isInteger(day) || day < 1 || day > 90) return { ok: false, error: "Not found." };
  const service = getServiceSupabase();
  const { data: row } = await service.from("biblical_ai_saved_studies").select("completed_days, content").eq("id", studyId).eq("user_id", m.userId).eq("kind", "plan").maybeSingle();
  if (!row) return { ok: false, error: "That study no longer exists." };
  const total = ((row.content as { plan?: { durationDays?: number } }).plan?.durationDays ?? 0) as number;
  if (day > total) return { ok: false, error: "Not found." };
  const set = new Set<number>((row.completed_days as number[]) ?? []);
  if (done) set.add(day);
  else set.delete(day);
  const { error } = await service.from("biblical_ai_saved_studies").update({ completed_days: [...set].sort((a, b) => a - b), updated_at: new Date().toISOString() }).eq("id", studyId).eq("user_id", m.userId);
  if (error) return { ok: false, error: "Couldn't save your progress." };
  revalidatePath(`/faith/biblical-ai/studies/${studyId}`);
  return { ok: true };
}

export async function deleteSavedStudyAction(studyId: string): Promise<Result> {
  await requireUser();
  if (!id.safeParse(studyId).success) return { ok: false, error: "Not found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("biblical_ai_saved_studies").delete().eq("id", studyId);
  if (error) return { ok: false, error: "Couldn't delete it." };
  revalidatePath("/faith/biblical-ai/saved");
  return { ok: true };
}

/**
 * Report an answer (inaccurate, helpful or unhelpful). An inaccuracy report includes the question and the answer, so
 * the team can check it; the screen says so before it is sent.
 */
export async function reportAnswerAction(messageId: string, kind: "inaccurate" | "helpful" | "unhelpful", note: string | null): Promise<Result> {
  const m = await member();
  if (!m) return OFF;
  const parsed = z.object({ kind: z.enum(["inaccurate", "helpful", "unhelpful"]), note: z.string().max(1000).nullish() }).safeParse({ kind, note });
  if (!id.safeParse(messageId).success || !parsed.success) return { ok: false, error: "Check what you entered." };
  const service = getServiceSupabase();
  const { data: msg } = await service.from("biblical_ai_messages").select("id, conversation_id, content, request_id").eq("id", messageId).eq("user_id", m.userId).eq("role", "assistant").maybeSingle();
  if (!msg) return { ok: false, error: "That answer no longer exists." };
  // At most 20 reports a day per member (abuse guard).
  const { count } = await service.from("biblical_ai_feedback").select("id", { count: "exact", head: true }).eq("user_id", m.userId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 20) return { ok: false, error: "Thank you. You've sent the most reports allowed today." };
  let question: string | null = null;
  if (parsed.data.kind === "inaccurate" && msg.request_id) {
    const { data: q } = await service.from("biblical_ai_messages").select("content").eq("user_id", m.userId).eq("request_id", msg.request_id).eq("role", "user").maybeSingle();
    question = (q?.content as string | undefined)?.slice(0, 2000) ?? null;
  }
  const { error } = await service.from("biblical_ai_feedback").insert({
    user_id: m.userId,
    message_id: messageId,
    kind: parsed.data.kind,
    note: parsed.data.note?.trim() || null,
    question: parsed.data.kind === "inaccurate" ? question : null,
    answer: parsed.data.kind === "inaccurate" ? String(msg.content).slice(0, 24000) : null,
  });
  if (error) {
    logError("biblical_ai.report", error);
    return { ok: false, error: "Couldn't send it. Please try again." };
  }
  logInfo("biblical_ai.report", { kind: parsed.data.kind });
  return { ok: true };
}

/** Create a personalized Bible study (Pro). */
export async function generateStudyAction(input: { topic: string; days: number; passage?: string | null; requestId: string }): Promise<PlanResult> {
  const user = await requireUser();
  const parsed = z
    .object({ topic: z.string().trim().min(3).max(160), days: z.number().refine((d) => (STUDY_DURATIONS as readonly number[]).includes(d)), passage: z.string().max(60).nullish(), requestId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", error: "Choose a topic and a length." };
  // Bounded below the page's 180 s limit, so the provider call stops (and isn't counted) before the request is cut off.
  const result = await generateStudyPlan({ userId: user.id, plan: await getUserPlan(user.id), ...parsed.data, signal: AbortSignal.timeout(170_000) });
  if (result.ok) revalidatePath("/faith/biblical-ai/saved");
  return result;
}

/** Founders: the administrators allowed to approve a teacher's material (FOUNDER_USER_IDS, comma-separated). */
function isFounder(userId: string): boolean {
  return (process.env.FOUNDER_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

/** Change a source's status (admin, with two-step sign-in). Approving a teacher's material needs a founder. */
export async function setSourceStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const parsed = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/), status: z.enum(["pending_review", "approved", "disabled"]), reason: z.string().trim().min(3).max(1000) }).safeParse({
    slug: formData.get("slug"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;
  const { error } = await getServiceSupabase().rpc("biblical_ai_set_source_status", { p_slug: parsed.data.slug, p_status: parsed.data.status, p_reason: parsed.data.reason, p_founder: isFounder(user.id), p_actor: user.id });
  if (error) logError("biblical_ai.source_status", error, { slug: parsed.data.slug });
  revalidatePath("/admin/biblical-ai");
}

/** Mark an inaccuracy report reviewed (admin). */
export async function markReportReviewedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const reportId = id.safeParse(formData.get("id"));
  if (!reportId.success) return;
  await getServiceSupabase().from("biblical_ai_feedback").update({ status: "reviewed" }).eq("id", reportId.data);
  revalidatePath("/admin/biblical-ai");
}
