"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { findDuplicateMemory, MEMORY_LIMIT, memoryInputSchema } from "@/lib/coach/memory";
import { getUserPlan, requireUser } from "@/server/auth";
import { getAiAllowance } from "@/server/services/ai-coach";
import { logError } from "@/server/log";

type Result = { ok: true; message: string } | { ok: false; error: string };

/** Memory is part of the AI coach (Pro, or a subscription that kept its AI allowance). Viewing and deleting never need it. */
async function hasAiCoach(userId: string): Promise<boolean> {
  return (await getAiAllowance(userId, await getUserPlan(userId))).chatLimit > 0;
}

/** Turn coaching memory on (the member's consent, recorded with the time) or off (memories are kept but not used). */
export async function setCoachMemoryEnabledAction(enabled: boolean): Promise<Result> {
  const user = await requireUser();
  if (enabled && !(await hasAiCoach(user.id))) return { ok: false, error: "Coaching memory is included with Pro." };
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update(enabled ? { coach_memory_enabled: true, coach_memory_consent_at: new Date().toISOString() } : { coach_memory_enabled: false })
    .eq("id", user.id);
  if (error) {
    logError("coach_memory.toggle", error);
    return { ok: false, error: "Couldn't change the memory setting. Please try again." };
  }
  revalidatePath("/coach", "layout");
  return { ok: true, message: enabled ? "Memory is on. The coach will suggest things to remember; nothing is saved without you." : "Memory is off. The coach won't use or suggest memories." };
}

export async function addCoachMemoryAction(raw: { category: string; content: string }): Promise<Result> {
  const user = await requireUser();
  const input = memoryInputSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Invalid memory." };
  if (!(await hasAiCoach(user.id))) return { ok: false, error: "Coaching memory is included with Pro." };
  const supabase = await getServerSupabase();
  const [{ data: prof }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("coach_memory_enabled").eq("id", user.id).maybeSingle(),
    supabase.from("coach_memories").select("content").eq("user_id", user.id),
  ]);
  if (!prof?.coach_memory_enabled) return { ok: false, error: "Turn memory on first." };
  const dup = findDuplicateMemory(input.data.content, existing ?? []);
  if (dup) return { ok: false, error: `Already remembered: "${dup.content}"` };
  const { error } = await supabase.from("coach_memories").insert({ user_id: user.id, ...input.data, source: "member" });
  if (error) {
    if (error.message.includes("coach_memory_limit")) return { ok: false, error: `You can keep up to ${MEMORY_LIMIT} memories. Delete some first.` };
    logError("coach_memory.add", error);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
  revalidatePath("/coach/memory");
  return { ok: true, message: "Saved." };
}

export async function updateCoachMemoryAction(id: string, raw: { category: string; content: string }): Promise<Result> {
  const user = await requireUser();
  const memoryId = z.string().uuid().safeParse(id);
  const input = memoryInputSchema.safeParse(raw);
  if (!memoryId.success) return { ok: false, error: "Memory not found." };
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Invalid memory." };
  if (!(await hasAiCoach(user.id))) return { ok: false, error: "Editing memories is included with Pro. You can still delete them." };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("coach_memories").update(input.data).eq("id", memoryId.data).eq("user_id", user.id).select("id");
  if (error) {
    logError("coach_memory.update", error);
    return { ok: false, error: "Couldn't save that change. Turn memory on to edit memories." };
  }
  if (!data?.length) return { ok: false, error: "Memory not found." };
  revalidatePath("/coach/memory");
  return { ok: true, message: "Updated." };
}

export async function deleteCoachMemoryAction(id: string): Promise<Result> {
  const user = await requireUser();
  const memoryId = z.string().uuid().safeParse(id);
  if (!memoryId.success) return { ok: false, error: "Memory not found." };
  const supabase = await getServerSupabase();
  const { error, count } = await supabase.from("coach_memories").delete({ count: "exact" }).eq("id", memoryId.data).eq("user_id", user.id);
  if (error) {
    logError("coach_memory.delete", error);
    return { ok: false, error: "Couldn't delete it. Please try again." };
  }
  if (!count) return { ok: false, error: "Memory not found." };
  revalidatePath("/coach/memory");
  return { ok: true, message: "Deleted." };
}

export async function deleteAllCoachMemoriesAction(): Promise<Result> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { error, count } = await supabase.from("coach_memories").delete({ count: "exact" }).eq("user_id", user.id);
  if (error) {
    logError("coach_memory.delete_all", error);
    return { ok: false, error: "Couldn't delete your memories. Please try again." };
  }
  revalidatePath("/coach/memory");
  return { ok: true, message: count ? `Deleted ${count} ${count === 1 ? "memory" : "memories"}.` : "There was nothing to delete." };
}

/** "Don't remember anything from this chat" for an existing conversation. */
export async function setConversationMemoryOffAction(conversationId: string, off: boolean): Promise<Result> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(conversationId);
  if (!id.success) return { ok: false, error: "Conversation not found." };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("ai_conversations").update({ memory_off: off }).eq("id", id.data).eq("user_id", user.id).select("id");
  if (error || !data?.length) {
    if (error) logError("coach_memory.chat_toggle", error);
    return { ok: false, error: "Couldn't change this chat's memory setting." };
  }
  return { ok: true, message: off ? "Nothing from this chat will be remembered." : "The coach may suggest things to remember from this chat." };
}
