import "server-only";
import { aiRetentionDays, retentionCutoff } from "@/lib/domain/ai-retention";
import { getServiceSupabase } from "@/lib/supabase/server";
import { logInfo } from "@/server/log";

export type AiRetentionReport =
  | { enabled: false }
  | { enabled: true; days: number; cutoff: string; coachMessages: number; coachConversations: number; bibleMessages: number; biblicalAiMessages: number; biblicalAiConversations: number };

/**
 * Deletes AI conversation content past the configured retention (AI_CHAT_RETENTION_DAYS; src/lib/domain/ai-retention.ts):
 *   1. coach messages created before the cutoff, in any conversation (feedback on them goes with them; training changes
 *      and memories that came from them keep existing, they just lose the link to the message);
 *   2. coach conversations with no activity since the cutoff (with anything left in them);
 *   3. Bible-helper messages created before the cutoff;
 *   4. Biblical AI messages created before the cutoff, and Biblical AI conversations with no activity since (saved
 *      studies are the member's own copies and are kept until the member deletes them).
 * Does nothing when retention is off. The report holds counts only, never content.
 */
export async function purgeExpiredAiChats(options: { now?: Date; days?: number | null } = {}): Promise<AiRetentionReport> {
  const days = options.days === undefined ? aiRetentionDays(process.env.AI_CHAT_RETENTION_DAYS) : options.days;
  if (days === null) return { enabled: false };
  const cutoff = retentionCutoff(days, options.now).toISOString();
  const admin = getServiceSupabase();

  const messages = await admin.from("ai_messages").delete({ count: "exact" }).lt("created_at", cutoff);
  if (messages.error) throw messages.error;
  const conversations = await admin.from("ai_conversations").delete({ count: "exact" }).lt("updated_at", cutoff);
  if (conversations.error) throw conversations.error;
  const bible = await admin.from("bible_ai_messages").delete({ count: "exact" }).lt("created_at", cutoff);
  if (bible.error) throw bible.error;

  const biblical = await admin.from("biblical_ai_messages").delete({ count: "exact" }).lt("created_at", cutoff);
  if (biblical.error) throw biblical.error;
  const biblicalConvos = await admin.from("biblical_ai_conversations").delete({ count: "exact" }).lt("updated_at", cutoff);
  if (biblicalConvos.error) throw biblicalConvos.error;
  // Inaccuracy reports keep their kind and note; the copies of the question and answer follow the same retention.
  const reportCopies = await admin.from("biblical_ai_feedback").update({ question: null, answer: null }).lt("created_at", cutoff).or("question.not.is.null,answer.not.is.null");
  if (reportCopies.error) throw reportCopies.error;

  const report = {
    enabled: true as const,
    days,
    cutoff,
    coachMessages: messages.count ?? 0,
    coachConversations: conversations.count ?? 0,
    bibleMessages: bible.count ?? 0,
    biblicalAiMessages: biblical.count ?? 0,
    biblicalAiConversations: biblicalConvos.count ?? 0,
  };
  logInfo("ai_retention.purged", report);
  return report;
}
