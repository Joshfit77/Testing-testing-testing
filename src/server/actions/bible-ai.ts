"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireUser } from "@/server/auth";
import { askBible, type BibleAskResult } from "@/server/services/bible-ai";

/** Ask the Bible study helper (free for every member, within daily and monthly limits). */
export async function askBibleAction(question: string, threadId: string): Promise<BibleAskResult> {
  const user = await requireUser();
  const q = z.string().min(1).max(2000).safeParse(question);
  const t = z.string().uuid().safeParse(threadId);
  if (!q.success || !t.success) return { ok: false, code: "invalid", error: "Ask a question about the Bible." };
  return askBible(user.id, await getUserPlan(user.id), q.data, t.data);
}

/** Delete the member's Bible helper conversations. */
export async function clearBibleAiHistoryAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  await supabase.from("bible_ai_messages").delete().eq("user_id", user.id);
}
