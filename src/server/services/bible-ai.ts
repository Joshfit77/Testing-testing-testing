import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceSupabase } from "@/lib/supabase/server";
import {
  BIBLE_AI_LIMITS,
  BIBLE_AI_MAX_QUESTION,
  BIBLE_AI_MAX_TOKENS,
  BIBLE_AI_SYSTEM,
  buildBibleAiMessage,
  checkCitations,
  findReferences,
  markUnverified,
  searchTerms,
  type ContextPassage,
} from "@/lib/bible/ai";
import { formatReference } from "@/lib/bible/reference";
import type { Plan } from "@/lib/domain/types";
import { getPassage, passageParts, passageText, searchBible } from "@/server/bible/text";
import type { TextPart } from "@/lib/bible/red-letter";
import { isDemoMode } from "@/server/demo";
import { isAiConfigured, serverEnv } from "@/server/env";
import { logError } from "@/server/log";

/*
 * The Bible study helper. Its own quota (bible_ai_usage; the fitness coach's allowance is untouched), its own history
 * (bible_ai_messages) and its own instructions. What the model sees: the member's question, the earlier turns of this
 * conversation, and BSB passages retrieved from the verified text. Never the prayer journal, notes or any other data.
 */

export const BIBLE_AI_MODEL = () => process.env.BIBLE_AI_MODEL || "claude-haiku-5-5";
const MAX_PASSAGE_VERSES = 40;
const MAX_CONTEXT_VERSES = 80;
const HISTORY_TURNS = 6;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey, maxRetries: 1, timeout: 60_000 }));

/** Passages for a question: any references it names, then verses containing its distinctive words. */
export function retrievePassages(question: string): ContextPassage[] {
  const out: ContextPassage[] = [];
  let verses = 0;
  for (const { ref } of findReferences(question)) {
    if (!ref) continue;
    const vs = getPassage(ref).slice(0, MAX_PASSAGE_VERSES);
    if (!vs.length || verses + vs.length > MAX_CONTEXT_VERSES) continue;
    verses += vs.length;
    out.push({ reference: formatReference(ref), text: vs.map((v) => v.text).join(" ") });
  }
  const terms = searchTerms(question);
  if (terms.length && verses < MAX_CONTEXT_VERSES) {
    // All the words first; if that's too narrow, the two most distinctive.
    const all = searchBible(terms.join(" "), { limit: 12 });
    const hits = all.total ? all.hits : searchBible(terms.slice(0, 2).join(" "), { limit: 12 }).hits;
    for (const h of hits) {
      if (verses >= MAX_CONTEXT_VERSES || out.some((p) => p.reference === h.reference)) continue;
      verses++;
      out.push({ reference: h.reference, text: h.text });
    }
  }
  return out;
}

export interface BibleAnswer {
  ok: true;
  threadId: string;
  answer: string;
  citations: { reference: string; text: string; parts?: TextPart[] }[];
  unverified: string[];
}
export type BibleAskResult = BibleAnswer | { ok: false; code: "unavailable" | "rate_limited" | "quota" | "invalid" | "error"; error: string };

export async function askBible(userId: string, plan: Plan, questionRaw: string, threadId: string): Promise<BibleAskResult> {
  const question = questionRaw.trim().slice(0, BIBLE_AI_MAX_QUESTION);
  if (question.length < 3) return { ok: false, code: "invalid", error: "Ask a question about the Bible." };
  if (!isAiConfigured() || isDemoMode()) return { ok: false, code: "unavailable", error: "The Bible study helper isn't available yet." };
  const limits = plan === "pro" ? BIBLE_AI_LIMITS.pro : BIBLE_AI_LIMITS.free;
  const service = getServiceSupabase();
  const { data: usageId, error: quotaError } = await service.rpc("reserve_bible_ai_usage", { p_user_id: userId, p_per_minute: limits.perMinute, p_daily: limits.daily, p_monthly: limits.monthly });
  if (quotaError) {
    if (quotaError.message?.includes("bible_ai_rate_limited")) return { ok: false, code: "rate_limited", error: "That's a lot of questions at once. Please wait a minute." };
    if (quotaError.message?.includes("bible_ai_quota")) return { ok: false, code: "quota", error: `You've reached today's limit of ${limits.daily} questions (or this month's ${limits.monthly}). The Bible itself is always free to read and search.` };
    logError("bible_ai.reserve", quotaError);
    return { ok: false, code: "error", error: "Couldn't ask right now. Please try again." };
  }

  const { data: history } = await service.from("bible_ai_messages").select("role, content").eq("user_id", userId).eq("thread_id", threadId).order("created_at", { ascending: false }).limit(HISTORY_TURNS);
  const passages = retrievePassages(question);
  const model = BIBLE_AI_MODEL();
  try {
    const msg = await getClient().messages.create({
      model,
      max_tokens: BIBLE_AI_MAX_TOKENS,
      system: BIBLE_AI_SYSTEM,
      messages: [
        ...[...(history ?? [])].reverse().map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 4000) })),
        { role: "user" as const, content: buildBibleAiMessage(question, passages) },
      ],
    });
    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    const check = checkCitations(raw, (r) => getPassage(r).length > 0);
    const answer = markUnverified(raw || "I couldn't answer that. Try asking it another way.", check.unverified);
    const citations = check.verified.slice(0, 12).map((r) => ({ reference: formatReference(r), text: passageText(r) ?? "", parts: passageParts(r) ?? undefined }));
    // (Every row names every column: in a multi-row insert a column one row leaves out is sent as null, not its default.)
    const [saved, metered] = await Promise.all([
      service.from("bible_ai_messages").insert([
        { user_id: userId, thread_id: threadId, role: "user", content: question, citations: [] },
        { user_id: userId, thread_id: threadId, role: "assistant", content: answer.slice(0, 20000), citations: citations.map((c) => c.reference) },
      ]),
      service.from("bible_ai_usage").update({ status: "done", model, input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens }).eq("id", usageId as number),
    ]);
    if (saved.error) logError("bible_ai.history", saved.error);
    if (metered.error) logError("bible_ai.usage", metered.error);
    return { ok: true, threadId, answer, citations, unverified: check.unverified };
  } catch (e) {
    logError("bible_ai.call", e);
    await service.from("bible_ai_usage").update({ status: "failed", model }).eq("id", usageId as number);
    return { ok: false, code: "error", error: "The helper couldn't answer just now. Please try again." };
  }
}

/** Questions left today, for the page. */
export async function bibleAiRemainingToday(userId: string, plan: Plan): Promise<number> {
  const limits = plan === "pro" ? BIBLE_AI_LIMITS.pro : BIBLE_AI_LIMITS.free;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await getServiceSupabase().from("bible_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "failed").gte("created_at", since);
  return Math.max(0, limits.daily - (count ?? 0));
}
