import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceSupabase } from "@/lib/supabase/server";
import {
  BIBLE_AI_CONSENT_REQUIRED,
  BIBLE_AI_CUT_SHORT_NOTE,
  BIBLE_AI_DISABLED,
  BIBLE_AI_LIMITS,
  BIBLE_AI_MAX_QUESTION,
  BIBLE_AI_MAX_TOKENS,
  BIBLE_AI_REFUSAL,
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
import { isAiConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { logError } from "@/server/log";
import { AiError, withAiRequest } from "@/server/services/ai-coach";
import { hasFeature } from "@/lib/domain/plans";
import { costMicros, tokenUsage } from "@/lib/domain/ai-economics";

/*
 * The Bible study helper. Its own quota (bible_ai_usage; the fitness coach's allowance is untouched), its own history
 * (bible_ai_messages) and its own instructions. What the model sees: the member's question, the earlier turns of this
 * conversation, and BSB passages retrieved from the verified text. Never the prayer journal, notes or any other data.
 */

export const BIBLE_AI_MODEL = () => process.env.BIBLE_AI_MODEL || "claude-haiku-5-5";
const MAX_PASSAGE_VERSES = 40;
const MAX_CONTEXT_VERSES = 80;
const HISTORY_TURNS = 6;


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
export type BibleAskResult = BibleAnswer | { ok: false; code: "unavailable" | "consent_required" | "not_entitled" | "rate_limited" | "quota" | "invalid" | "refused" | "error"; error: string };

export const BIBLE_AI_PRO_ONLY = "The AI Bible study helper is included with Pro All Access. Reading, searching, highlights, journeys, prayer and the 40-day challenge stay free.";

/**
 * Whether the helper may send anything to the AI provider for this member, checked before any quota is reserved:
 * the AI kill switch (the `ai_coach` flag turns every AI feature off) and the member's own AI data-sharing consent,
 * the same two conditions as the coach (assertAiAllowed and coachTurn in ai-coach.ts). Null when it may.
 */
export async function bibleAiBlocked(userId: string): Promise<Extract<BibleAskResult, { ok: false }> | null> {
  if (!(await isFlagEnabled("ai_coach"))) return { ok: false, code: "unavailable", error: BIBLE_AI_DISABLED };
  const { data: consent, error } = await getServiceSupabase().from("profiles").select("ai_data_consent_at").eq("id", userId).maybeSingle();
  if (error) {
    // Not knowing must never read as "allowed".
    logError("bible_ai.consent", error);
    return { ok: false, code: "error", error: "Couldn't ask right now. Please try again." };
  }
  if (!consent?.ai_data_consent_at) return { ok: false, code: "consent_required", error: BIBLE_AI_CONSENT_REQUIRED };
  return null;
}

/**
 * Ask the Bible study helper. It is a Pro AI feature (2026-11-13 owner decision: Free members have no generative AI;
 * reading, prayer, journeys and the 40-day challenge stay free) and runs under exactly the same rules as every other
 * AI request (withAiRequest): Pro on the server, the member's AI consent, one request from their monthly allowance,
 * their money budget and the global one, held before the provider is called. Its own daily question limit applies
 * on top.
 */
export async function askBible(userId: string, plan: Plan, questionRaw: string, threadId: string): Promise<BibleAskResult> {
  const question = questionRaw.trim().slice(0, BIBLE_AI_MAX_QUESTION);
  if (question.length < 3) return { ok: false, code: "invalid", error: "Ask a question about the Bible." };
  if (!isAiConfigured() || isDemoMode()) return { ok: false, code: "unavailable", error: "The Bible study helper isn't available yet." };
  const blocked = await bibleAiBlocked(userId);
  if (blocked) return blocked;
  if (!hasFeature(plan, "ai_bible_study")) return { ok: false, code: "not_entitled", error: BIBLE_AI_PRO_ONLY };
  const limits = BIBLE_AI_LIMITS.pro;
  const service = getServiceSupabase();
  const passages = retrievePassages(question);
  try {
    return await withAiRequest({ supabase: service, userId, plan, kind: "bible_study", tier: "fast" }, async ({ client, model }) => {
      // The helper's own daily and monthly question limits, on top of the member's AI allowance.
      const { data: usageId, error: quotaError } = await service.rpc("reserve_bible_ai_usage", { p_user_id: userId, p_per_minute: limits.perMinute, p_daily: limits.daily, p_monthly: limits.monthly });
      if (quotaError) {
        if (quotaError.message?.includes("bible_ai_rate_limited")) throw new AiError("rate_limited", "That's a lot of questions at once. Please wait a minute.", 60);
        if (quotaError.message?.includes("bible_ai_quota")) throw new AiError("quota", `You've reached today's limit of ${limits.daily} Bible questions. The Bible itself is always free to read and search.`);
        logError("bible_ai.reserve", quotaError);
        throw new AiError("metering_unavailable", "Couldn't ask right now. Please try again.");
      }
      const { data: history } = await service.from("bible_ai_messages").select("role, content").eq("user_id", userId).eq("thread_id", threadId).order("created_at", { ascending: false }).limit(HISTORY_TURNS);
      let msg: Anthropic.Message;
      try {
        msg = await client.messages.create({
          model,
          max_tokens: BIBLE_AI_MAX_TOKENS,
          system: BIBLE_AI_SYSTEM,
          messages: [
            ...[...(history ?? [])].reverse().map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 4000) })),
            { role: "user" as const, content: buildBibleAiMessage(question, passages) },
          ],
        });
      } catch (err) {
        await service.from("bible_ai_usage").update({ status: "failed", model }).eq("id", usageId as number);
        throw err;
      }
      const usage = { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, costMicros: costMicros(model, tokenUsage(msg.usage)) };
      if (msg.stop_reason === "refusal") {
        // Nothing is saved and the helper's own question count is given back; the provider call itself is still
        // counted (it was answered, and billed).
        await service.from("bible_ai_usage").update({ status: "failed", model }).eq("id", usageId as number);
        return { value: { ok: false, code: "refused", error: BIBLE_AI_REFUSAL } as BibleAskResult, ...usage };
      }
      const raw = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();
      const check = checkCitations(raw, (r) => getPassage(r).length > 0);
      const marked = markUnverified(raw || "I couldn't answer that. Try asking it another way.", check.unverified);
      // Out of room mid-answer: what was written is still shown, and said to be incomplete.
      const answer = msg.stop_reason === "max_tokens" ? `${marked}\n\n${BIBLE_AI_CUT_SHORT_NOTE}` : marked;
      const citations = check.verified.slice(0, 12).map((r) => ({ reference: formatReference(r), text: passageText(r) ?? "", parts: passageParts(r) ?? undefined }));
      // Explicit, distinct times so the question and its answer never tie when read back as history.
      const askedAt = new Date();
      const answeredAt = new Date(askedAt.getTime() + 1);
      const [saved, metered] = await Promise.all([
        service.from("bible_ai_messages").insert([
          { user_id: userId, thread_id: threadId, role: "user", content: question, citations: [], created_at: askedAt.toISOString() },
          { user_id: userId, thread_id: threadId, role: "assistant", content: answer.slice(0, 20000), citations: citations.map((c) => c.reference), created_at: answeredAt.toISOString() },
        ]),
        service.from("bible_ai_usage").update({ status: "done", model, input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens }).eq("id", usageId as number),
      ]);
      if (saved.error) logError("bible_ai.history", saved.error);
      if (metered.error) logError("bible_ai.usage", metered.error);
      return { value: { ok: true, threadId, answer, citations, unverified: check.unverified } as BibleAskResult, ...usage };
    });
  } catch (err) {
    if (err instanceof AiError) return { ok: false, code: bibleCode(err.code), error: err.message };
    logError("bible_ai.call", err);
    return { ok: false, code: "error", error: "The helper couldn't answer just now. Please try again." };
  }
}

function bibleCode(code: AiError["code"]): Extract<BibleAskResult, { ok: false }>["code"] {
  if (code === "not_entitled") return "not_entitled";
  if (code === "consent_required") return "consent_required";
  if (code === "rate_limited" || code === "in_progress" || code === "busy") return "rate_limited";
  if (code === "quota" || code === "budget_member") return "quota";
  if (code === "not_configured" || code === "disabled" || code === "budget_global") return "unavailable";
  return "error";
}

/** Questions left today, for the page. */
export async function bibleAiRemainingToday(userId: string, plan: Plan): Promise<number> {
  if (!hasFeature(plan, "ai_bible_study")) return 0;
  const limits = BIBLE_AI_LIMITS.pro;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await getServiceSupabase().from("bible_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "failed").gte("created_at", since);
  return Math.max(0, limits.daily - (count ?? 0));
}
