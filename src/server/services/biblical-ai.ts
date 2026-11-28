import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { formatReference, parseReference, type ScriptureRef } from "@/lib/bible/reference";
import { ANSWER_TOOL, CRISIS_PATTERN, SAFETY_TEXT, answerToText, checkText, rawAnswerSchema, validateAnswer, type SourceDocument, type ValidatedAnswer } from "@/lib/biblical-ai/answer";
import {
  BIBLICAL_AI_FLAG,
  DEFAULT_LIMITS,
  FREE_MEMBER_BUDGET_MICROS,
  MAX_QUESTION,
  categoryById,
  tierOf,
  type CategoryId,
  type Depth,
  type Limits,
  type StudyDuration,
} from "@/lib/biblical-ai/config";
import { BIBLICAL_AI_SYSTEM, PLAN_TOOL, STUDY_PLAN_SYSTEM, buildUserMessage, correctionMessage } from "@/lib/biblical-ai/prompt";
import { isStudyDuration, rawPlanSchema, validatePlan, type StudyPlan } from "@/lib/biblical-ai/study-plan";
import type { Plan } from "@/lib/domain/types";
import type { TextPart } from "@/lib/bible/red-letter";
import { costMicros, tokenUsage } from "@/lib/domain/ai-economics";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getPassage, passageParts, passageText } from "@/server/bible/text";
import { isDemoMode } from "@/server/demo";
import { isAiConfigured } from "@/server/env";
import { isFlagOn } from "@/server/flags";
import { logError, logInfo } from "@/server/log";
import { AiError, withAiRequest, type AllowanceOverride } from "@/server/services/ai-coach";
import { bibleAiBlocked } from "@/server/services/bible-ai";
import { retrieveScripture, toPromptDocuments, verseHasStrong, wordFor } from "@/server/services/biblical-ai-retrieval";

/*
 * Narrow Gate Biblical AI (behind the strict flag `biblical_ai`). One question:
 *   1. checks: flag, AI kill switch and consent (bibleAiBlocked), plan and depth, the question itself;
 *   2. idempotency: a request id already answered returns the saved answer (a retry never asks twice);
 *   3. retrieval from the app's verified data (retrieveScripture) and approved knowledge documents;
 *   4. the provider call through withAiRequest (the member's and the app's money budgets, in-flight limits; Free
 *      members get their own small allowance) and the Bible questions counter (reserve_bible_ai_usage);
 *   5. the answer is a forced tool call, checked by validateAnswer; on failures it is asked once more with the list,
 *      then whatever still fails is removed and said so;
 *   6. saved (conversation, question, answer) and returned with the BSB text of every passage it cites.
 * The model never sees the prayer journal, notes or anything else, unless the member chose to share a piece of text
 * with this question (memberShared), which the screen shows before it is sent.
 */

export const MAX_ATTEMPTS = 2;
const MAX_TOKENS: Record<Depth, number> = { quick: 900, standard: 1800, deep: 3600 };
const HISTORY_TURNS = 4;
/**
 * Time budgets, nested so each layer gives up after the one inside it: one provider attempt (60 s) < the whole
 * question with its one retry (BIBLICAL_AI_TIMEOUT_MS, 140 s) < the route's maxDuration (180 s) < the screen's own
 * timer (170 s, it shows Try again). A question that runs out of time is given back and can be retried.
 */
export const PROVIDER_ATTEMPT_TIMEOUT_MS = 60_000;
export const BIBLICAL_AI_TIMEOUT_MS = 140_000;

export type BiblicalAiCode = "unavailable" | "consent_required" | "not_entitled" | "rate_limited" | "quota" | "invalid" | "refused" | "not_found" | "cancelled" | "timeout" | "error";
export type Failure = { ok: false; code: BiblicalAiCode; error: string; retryAfter?: number };

export interface CitedPassage {
  reference: string;
  text: string;
  parts?: TextPart[];
  /** True when only the first verses are shown (the passage is long). */
  truncated: boolean;
}
export interface AskSuccess {
  ok: true;
  conversationId: string;
  messageId: string;
  answer: ValidatedAnswer;
  passages: CitedPassage[];
  depth: Depth;
  /** True when the same request id had already been answered (nothing new was asked or counted). */
  replayed: boolean;
}
export type AskResult = AskSuccess | Failure;

export function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** The member's limits: the defaults, with the owner's BIBLICAL_AI_{FREE,PRO}_{DAILY,MONTHLY,PER_MINUTE} overrides. */
export function biblicalAiLimits(plan: Plan): Limits & { tier: "free" | "pro" } {
  const tier = tierOf(plan);
  const d = DEFAULT_LIMITS[tier];
  const p = `BIBLICAL_AI_${tier.toUpperCase()}`;
  return { ...d, tier, daily: envInt(`${p}_DAILY`, d.daily), monthly: envInt(`${p}_MONTHLY`, d.monthly), perMinute: Math.max(1, envInt(`${p}_PER_MINUTE`, d.perMinute)) };
}

/** Whether Biblical AI is switched on for everyone (strict flag) and can run on this server. */
export async function biblicalAiEnabled(): Promise<boolean> {
  return (await isFlagOn(BIBLICAL_AI_FLAG)) && isAiConfigured() && !isDemoMode();
}

/** The flag alone (screens use it to decide whether to show Biblical AI at all). */
export async function biblicalAiFlagOn(): Promise<boolean> {
  return isFlagOn(BIBLICAL_AI_FLAG);
}

/** Questions left today (rolling 24 hours, like the counter). */
export async function biblicalAiRemaining(userId: string, plan: Plan): Promise<{ today: number; month: number; limits: ReturnType<typeof biblicalAiLimits> }> {
  const limits = biblicalAiLimits(plan);
  const admin = getServiceSupabase();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const count = (from: string) => admin.from("bible_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "failed").gte("created_at", from);
  const [day, month] = await Promise.all([count(since), count(monthStart)]);
  if (day.error || month.error) return { today: 0, month: 0, limits };
  return { today: Math.max(0, limits.daily - (day.count ?? 0)), month: Math.max(0, limits.monthly - (month.count ?? 0)), limits };
}

/** BSB text for display: whole passages up to 30 verses, then the first 30 with a note. */
export function citedPassage(reference: string): CitedPassage | null {
  const ref = parseReference(reference);
  if (!ref) return null;
  const verses = getPassage(ref);
  if (!verses.length) return null;
  const truncated = verses.length > 30;
  const shown = truncated ? { ...ref, chapterEnd: undefined, verseEnd: verses[29]!.verse, chapter: verses[0]!.chapter, verseStart: verses[0]!.verse } : ref;
  const sameChapter = !truncated || verses[29]!.chapter === verses[0]!.chapter;
  const r = sameChapter ? shown : ref;
  return { reference: formatReference(ref), text: (truncated && sameChapter ? passageText(r) : passageText(ref)) ?? "", parts: (truncated && sameChapter ? passageParts(r) : passageParts(ref)) ?? undefined, truncated };
}

/** Approved knowledge documents relevant to the question (empty until a source is approved and loaded). */
async function retrieveDocuments(question: string, limit: number): Promise<SourceDocument[]> {
  if (limit <= 0) return [];
  const admin = getServiceSupabase();
  const { data: sources, error } = await admin.from("biblical_ai_sources").select("slug, attribution, attribution_required").eq("status", "approved").in("kind", ["teacher", "history"]);
  if (error) {
    logError("biblical_ai.sources", error);
    return [];
  }
  if (!sources?.length) return [];
  const terms = question.replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim().split(/\s+/).filter((w) => w.length > 3).slice(0, 8).join(" or ");
  if (!terms) return [];
  const { data: docs, error: docError } = await admin
    .from("biblical_ai_source_documents")
    .select("id, source_slug, author, title, url, published_on, body")
    .in("source_slug", sources.map((s) => s.slug as string))
    .textSearch("search", terms, { type: "websearch", config: "english" })
    .limit(limit);
  if (docError) {
    logError("biblical_ai.documents", docError);
    return [];
  }
  // A credit is shown only where the source's licence requires one (set in the admin backend).
  const credit = new Map(sources.map((s) => [s.slug as string, s.attribution_required ? ((s.attribution as string | null) ?? null) : null]));
  return (docs ?? []).map((d) => ({ id: String(d.id), author: String(d.author), title: String(d.title), url: String(d.url), publishedOn: (d.published_on as string | null) ?? null, body: String(d.body), attribution: credit.get(String(d.source_slug)) ?? null }));
}

function toolInput(msg: Anthropic.Message, name: string): unknown {
  const block = msg.content.find((b) => b.type === "tool_use" && b.name === name);
  return block && block.type === "tool_use" ? block.input : null;
}

function codeOf(err: AiError): BiblicalAiCode {
  if (err.code === "not_entitled" || err.code === "plan_not_entitled") return "not_entitled";
  if (err.code === "consent_required") return "consent_required";
  if (err.code === "rate_limited" || err.code === "in_progress" || err.code === "busy") return "rate_limited";
  if (err.code === "quota" || err.code === "budget_member") return "quota";
  if (err.code === "not_configured" || err.code === "disabled" || err.code === "budget_global") return "unavailable";
  return "error";
}

const UNAVAILABLE = "Biblical AI is temporarily unavailable. The Bible is free to read and search.";

/** Stopped by the member, or out of time: neither is counted; running out of time can be retried. */
export function abortedResult(signal: AbortSignal, counted = false): Failure {
  const reason = signal.reason as { name?: string } | undefined;
  if (reason?.name === "TimeoutError") return { ok: false, code: "timeout", error: "That took too long, so nothing was counted. Please try again." };
  return { ok: false, code: "cancelled", error: counted ? "Cancelled. A question already sent to the AI still counts toward your limit." : "Cancelled. Nothing was counted." };
}

/** Common checks before anything is retrieved, counted or sent. */
async function preflight(userId: string, plan: Plan, depth: Depth): Promise<Failure | { limits: ReturnType<typeof biblicalAiLimits> }> {
  if (!(await biblicalAiEnabled())) return { ok: false, code: "unavailable", error: UNAVAILABLE };
  const blocked = await bibleAiBlocked(userId);
  if (blocked) return { ok: false, code: blocked.code === "consent_required" ? "consent_required" : blocked.code === "unavailable" ? "unavailable" : "error", error: blocked.error };
  const limits = biblicalAiLimits(plan);
  if (limits.daily <= 0 || limits.monthly <= 0) return { ok: false, code: "not_entitled", error: "Biblical AI is included with Pro All Access. The Bible is free to read and search." };
  if (!limits.depths.includes(depth)) return { ok: false, code: "not_entitled", error: "Deep studies are included with Pro All Access. Quick answers and standard studies are included in the Free plan." };
  return { limits };
}

function allowanceFor(limits: ReturnType<typeof biblicalAiLimits>): AllowanceOverride | undefined {
  // Pro members use their plan's AI allowance; Free members use Biblical AI's own small allowance.
  return limits.tier === "free" ? { chatLimit: limits.monthly, smartLimit: 0, memberBudgetMicros: FREE_MEMBER_BUDGET_MICROS } : undefined;
}

/** Reserve one Bible question on the shared counter (per minute, per day, per month). */
async function reserveQuestion(userId: string, limits: Limits): Promise<number> {
  const service = getServiceSupabase();
  // A reservation left behind by a request that died (a crashed worker) would count forever; anything still reserved
  // after 10 minutes can't be running (requests are limited to 3 minutes), so it stops counting.
  await service.from("bible_ai_usage").update({ status: "failed" }).eq("user_id", userId).eq("status", "reserved").lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  const { data, error } = await service.rpc("reserve_bible_ai_usage", { p_user_id: userId, p_per_minute: limits.perMinute, p_daily: limits.daily, p_monthly: limits.monthly });
  if (error) {
    if (error.message?.includes("bible_ai_rate_limited")) throw new AiError("rate_limited", "That's a lot of questions at once. Please wait a minute.", 60);
    if (error.message?.includes("bible_ai_quota")) throw new AiError("quota", `You've reached your Biblical AI limit (${limits.daily} a day, ${limits.monthly} a month). The Bible is free to read and search.`);
    logError("biblical_ai.reserve", error);
    throw new AiError("metering_unavailable", "Couldn't ask right now. Please try again.");
  }
  return data as number;
}

async function replay(userId: string, requestId: string): Promise<AskSuccess | null> {
  const { data } = await getServiceSupabase().from("biblical_ai_messages").select("id, conversation_id, answer, depth").eq("user_id", userId).eq("request_id", requestId).eq("role", "assistant").maybeSingle();
  if (!data?.answer) return null;
  const answer = data.answer as ValidatedAnswer;
  return { ok: true, conversationId: data.conversation_id as string, messageId: data.id as string, answer, passages: answer.scripture.map((s) => citedPassage(s.reference)).filter((p): p is CitedPassage => Boolean(p)), depth: (data.depth as Depth) ?? "standard", replayed: true };
}

interface Claim {
  conversationId: string;
  /** The conversation was created for this question (removed again if it fails). */
  created: boolean;
  messageId: string;
  askedAt: number;
}

/** A claim older than this with no answer belongs to a request that died; it may be taken over. */
const STALE_CLAIM_MS = 4 * 60_000;

async function claimRequest(input: AskInput, question: string, passage: string | null): Promise<Claim | Failure> {
  const service = getServiceSupabase();
  let conversationId = input.conversationId ?? null;
  let created = false;
  if (!conversationId) {
    const { data: convo, error } = await service.from("biblical_ai_conversations").insert({ user_id: input.userId, title: question.slice(0, 120), category: input.category, passage }).select("id").single();
    if (error || !convo) {
      logError("biblical_ai.claim_conversation", error);
      return { ok: false, code: "error", error: "Biblical AI couldn't answer just now. Please try again." };
    }
    conversationId = convo.id as string;
    created = true;
  }
  const askedAt = Date.now();
  const row = { conversation_id: conversationId, user_id: input.userId, role: "user", content: question, depth: input.depth, request_id: input.requestId, created_at: new Date(askedAt).toISOString() };
  let { data, error } = await service.from("biblical_ai_messages").insert(row).select("id").single();
  if (error?.code === "23505") {
    // Already claimed: answered (replay), still running (say so), or left by a request that died (take it over).
    const earlier = await replay(input.userId, input.requestId);
    if (earlier) {
      if (created) await service.from("biblical_ai_conversations").delete().eq("id", conversationId).eq("user_id", input.userId);
      return earlier as unknown as Failure;
    }
    const { data: old } = await service.from("biblical_ai_messages").select("id, created_at").eq("user_id", input.userId).eq("request_id", input.requestId).eq("role", "user").maybeSingle();
    if (old && Date.now() - new Date(old.created_at as string).getTime() > STALE_CLAIM_MS) {
      await service.from("biblical_ai_messages").delete().eq("id", old.id).eq("user_id", input.userId);
      ({ data, error } = await service.from("biblical_ai_messages").insert(row).select("id").single());
    } else {
      if (created) await service.from("biblical_ai_conversations").delete().eq("id", conversationId).eq("user_id", input.userId);
      return { ok: false, code: "rate_limited", error: "This question is already being answered. Please wait a moment.", retryAfter: 10 };
    }
  }
  if (error || !data) {
    if (created) await service.from("biblical_ai_conversations").delete().eq("id", conversationId).eq("user_id", input.userId);
    logError("biblical_ai.claim", error);
    return { ok: false, code: "error", error: "Biblical AI couldn't answer just now. Please try again." };
  }
  return { conversationId, created, messageId: data.id as string, askedAt };
}

/** Undo a claim after a failed question: its question row, and the conversation if it was made for it. */
async function releaseClaim(userId: string, claim: Claim): Promise<void> {
  const service = getServiceSupabase();
  if (claim.created) await service.from("biblical_ai_conversations").delete().eq("id", claim.conversationId).eq("user_id", userId);
  else await service.from("biblical_ai_messages").delete().eq("id", claim.messageId).eq("user_id", userId);
}

export interface AskInput {
  userId: string;
  plan: Plan;
  question: string;
  depth: Depth;
  category: CategoryId;
  requestId: string;
  conversationId?: string | null;
  /** The passage being studied (from the reader), as a reference. */
  passage?: string | null;
  /** Text the member chose to share with this question (from their journal or a prayer), shown to them first. */
  memberShared?: string | null;
  signal?: AbortSignal;
  onStatus?: (status: "retrieving" | "answering" | "checking" | "saving") => void;
}

export async function askBiblicalAi(input: AskInput): Promise<AskResult> {
  const question = input.question.trim().slice(0, MAX_QUESTION);
  if (question.length < 3) return { ok: false, code: "invalid", error: "Ask a question about the Bible." };
  if (!categoryById(input.category)) return { ok: false, code: "invalid", error: "Choose a study area." };
  const passageRef = input.passage ? parseReference(input.passage) : null;
  if (input.passage && (!passageRef || !passageText(passageRef))) return { ok: false, code: "invalid", error: "That passage isn't in the Bible." };
  const pre = await preflight(input.userId, input.plan, input.depth);
  if ("ok" in pre) return pre;
  const { limits } = pre;
  const service = getServiceSupabase();

  const earlier = await replay(input.userId, input.requestId);
  if (earlier) return earlier;

  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (input.conversationId) {
    const { data: convo } = await service.from("biblical_ai_conversations").select("id").eq("id", input.conversationId).eq("user_id", input.userId).maybeSingle();
    if (!convo) return { ok: false, code: "not_found", error: "That conversation no longer exists." };
    const { data: rows } = await service.from("biblical_ai_messages").select("role, content").eq("conversation_id", input.conversationId).eq("user_id", input.userId).order("created_at", { ascending: false }).limit(HISTORY_TURNS * 2);
    history = (rows ?? []).reverse().map((r) => ({ role: r.role as "user" | "assistant", content: String(r.content).slice(0, r.role === "assistant" ? 1500 : 1200) }));
  }

  // Claim the request id before anything is asked: the question is saved now under the unique (member, request id)
  // index, so a second request with the same id (a double tap, a retry while the first is still running) can't ask
  // and pay a second time. It is removed again if the question fails.
  const passageFocus = passageRef ? formatReference(passageRef) : null;
  const claim = await claimRequest(input, question, passageFocus);
  if ("ok" in claim) return claim;
  input.onStatus?.("retrieving");
  const scripture = retrieveScripture(question, { depth: input.depth, category: input.category, passage: passageFocus });
  const documents = await retrieveDocuments(question, input.depth === "quick" ? 2 : input.depth === "standard" ? 3 : 5);
  const userMessage = buildUserMessage({
    question,
    depth: input.depth,
    category: input.category,
    passages: scripture.passages,
    crossReferences: scripture.crossReferences,
    words: scripture.words,
    documents: toPromptDocuments(documents),
    memberShared: input.memberShared?.slice(0, 2000) ?? null,
    passageFocus,
  });

  const started = Date.now();
  const crisis = CRISIS_PATTERN.test(question);
  let usageId: number | null = null;
  let modelUsed = "";
  let validationFailures = 0;
  try {
    const result = await withAiRequest(
      { supabase: service, userId: input.userId, plan: input.plan, kind: "bible_study", tier: input.depth === "deep" && limits.tier === "pro" ? "smart" : "fast", allowance: allowanceFor(limits) },
      async ({ client, model }) => {
        modelUsed = model;
        usageId = await reserveQuestion(input.userId, limits);
        input.onStatus?.("answering");
        const messages: Anthropic.MessageParam[] = [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: userMessage }];
        let inputTokens = 0;
        let outputTokens = 0;
        let cost = 0;
        let validated: ReturnType<typeof validateAnswer> | null = null;
        let budget = MAX_TOKENS[input.depth];
        const deps = { passageText: (r: ScriptureRef) => passageText(r), verseHasStrong, wordFor, documents: new Map(documents.map((d) => [d.id, d])), retrieved: scripture.references };
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const msg = await client.messages.create(
            {
              model,
              max_tokens: budget,
              system: [{ type: "text", text: BIBLICAL_AI_SYSTEM, cache_control: { type: "ephemeral" } }],
              tools: [ANSWER_TOOL],
              tool_choice: { type: "tool", name: ANSWER_TOOL.name },
              messages,
            },
            { signal: input.signal, timeout: PROVIDER_ATTEMPT_TIMEOUT_MS },
          );
          inputTokens += msg.usage.input_tokens;
          outputTokens += msg.usage.output_tokens;
          cost += costMicros(model, tokenUsage(msg.usage));
          // A refusal on the corrective attempt keeps the first attempt's checked answer.
          if (msg.stop_reason === "refusal") {
            if (validated) break;
            throw new AiError("provider", "refused", undefined, cost);
          }
          // Cut off at the output limit: the tool input is incomplete, so ask again from the start with more room.
          if (msg.stop_reason === "max_tokens") {
            validationFailures++;
            budget = Math.round(MAX_TOKENS[input.depth] * 1.6);
            continue;
          }
          input.onStatus?.("checking");
          const raw = rawAnswerSchema.safeParse(toolInput(msg, ANSWER_TOOL.name));
          const toolUse = msg.content.find((b) => b.type === "tool_use");
          if (!raw.success) {
            validationFailures++;
            if (attempt < MAX_ATTEMPTS && toolUse) {
              messages.push({ role: "assistant", content: msg.content }, { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: "The answer did not match the required structure. Call submit_study again with every required field." }] });
              continue;
            }
            break;
          }
          const checked = validateAnswer(raw.data, deps, input.depth, { crisis, question });
          // The corrective attempt replaces the first only if it is at least as good.
          if (!validated || checked.failures.length <= validated.failures.length) validated = checked;
          if (!validated.failures.length || attempt === MAX_ATTEMPTS || !toolUse) break;
          validationFailures += checked.failures.length;
          messages.push({ role: "assistant", content: msg.content }, { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: correctionMessage(checked.failures) }] });
        }
        if (validated?.failures.length) validationFailures += validated.failures.length;
        // Cancelled (or out of time) while the answer was being checked: nothing is saved or counted for the member;
        // what the provider billed still goes into the app's spend figures.
        if (input.signal?.aborted) throw new AiError("provider", "aborted", undefined, cost);
        return { value: validated?.answer ?? null, inputTokens, outputTokens, costMicros: cost };
      },
    );

    // Nothing usable even after a retry: a Scripture-centered fallback from the passages found, never an unchecked answer.
    const usable = Boolean(result && result.answer && result.scripture.length);
    const answer: ValidatedAnswer =
      result && usable
        ? result
        : {
            title: question.slice(0, 60),
            answer: "A verified answer couldn't be prepared for this question. Here are passages from the Berean Standard Bible that relate to it; read them in their context, and try asking in another way.",
            scripture: scripture.passages.slice(0, 5).map((p) => ({ reference: p.reference, quote: null, note: null })),
            context: null,
            originalLanguage: [],
            history: [],
            sources: [],
            application: null,
            reflectionQuestions: [],
            furtherStudy: [],
            uncertainty: null,
            safety: result?.safety ?? (crisis ? SAFETY_TEXT : null),
            limitations: ["The answer didn't pass the accuracy checks, so only the passages are shown."],
          };

    input.onStatus?.("saving");
    const conversationId = claim.conversationId;
    const now = new Date();
    await service
      .from("biblical_ai_conversations")
      .update({ updated_at: now.toISOString(), ...(claim.created ? { title: answer.title.slice(0, 120) || "Bible study" } : {}) })
      .eq("id", conversationId)
      .eq("user_id", input.userId);
    const text = answerToText(answer, (r) => {
      const ref = parseReference(r);
      return ref ? passageText(ref) : null;
    });
    const { data: saved, error: saveError } = await service
      .from("biblical_ai_messages")
      .insert({ conversation_id: conversationId, user_id: input.userId, role: "assistant", content: text || answer.answer, answer, depth: input.depth, model: modelUsed, request_id: input.requestId, created_at: new Date(Math.max(now.getTime(), claim.askedAt + 1)).toISOString() })
      .select("id, role");
    if (saveError) {
      // The same request id saved by a parallel attempt: return that one.
      const again = await replay(input.userId, input.requestId);
      if (again) return again;
      throw saveError;
    }
    const messageId = (saved ?? []).find((m) => m.role === "assistant")?.id as string;
    if (usageId !== null) {
      const { error } = await service
        .from("bible_ai_usage")
        // The passages-only fallback isn't counted against the member's questions.
        .update({ status: usable ? "done" : "failed", model: modelUsed, feature: "biblical_ai", depth: input.depth, latency_ms: Date.now() - started, validation_failures: validationFailures })
        .eq("id", usageId);
      if (error) logError("biblical_ai.usage", error);
    }
    logInfo("biblical_ai.answered", { depth: input.depth, category: input.category, ms: Date.now() - started, validationFailures, limitations: answer.limitations.length });
    return { ok: true, conversationId, messageId, answer, passages: answer.scripture.map((s) => citedPassage(s.reference)).filter((p): p is CitedPassage => Boolean(p)), depth: input.depth, replayed: false };
  } catch (err) {
    await releaseClaim(input.userId, claim);
    // A question already sent to the AI and then cancelled or declined still counts toward the member's limits
    // ('cancelled'), so neither can be used to spend the app's AI budget freely. Provider failures and time-outs don't.
    const timedOut = (input.signal?.reason as { name?: string } | undefined)?.name === "TimeoutError";
    const memberStopped = (input.signal?.aborted && !timedOut) || (err instanceof AiError && err.message === "refused");
    if (usageId !== null) await service.from("bible_ai_usage").update({ status: memberStopped ? "cancelled" : "failed", model: modelUsed, feature: "biblical_ai", depth: input.depth, latency_ms: Date.now() - started, validation_failures: validationFailures }).eq("id", usageId);
    if (input.signal?.aborted) return abortedResult(input.signal, memberStopped && usageId !== null);
    if (err instanceof AiError) {
      if (err.message === "refused") return { ok: false, code: "refused", error: "Biblical AI can't answer that one. Try asking about a passage, a person, a doctrine or a theme in the Bible." };
      return { ok: false, code: codeOf(err), error: err.message, retryAfter: err.retryAfterSeconds };
    }
    logError("biblical_ai.ask", err);
    return { ok: false, code: "error", error: "Biblical AI couldn't answer just now. Please try again." };
  }
}

export interface PlanInput {
  userId: string;
  plan: Plan;
  topic: string;
  days: number;
  passage?: string | null;
  requestId: string;
  signal?: AbortSignal;
}
export type PlanResult = { ok: true; studyId: string; study: StudyPlan; replayed: boolean } | Failure;

const PLAN_TOKENS: Record<StudyDuration, number> = { 7: 4000, 14: 6500, 30: 11000, 60: 15000, 90: 20000 };
/** One plan attempt may take this long; the whole request is limited by the page (180 s). */
const PLAN_ATTEMPT_TIMEOUT_MS = 150_000;

/** Run the prose checks over every free-text field of a plan; returns the cleaned plan and what was wrong. */
function checkPlanProse(plan: StudyPlan, retrieved: string[]): { plan: StudyPlan; failures: string[] } {
  const deps = { passageText: (r: ScriptureRef) => passageText(r), verseHasStrong, documents: new Map<string, SourceDocument>(), retrieved };
  const failures: string[] = [];
  const clean = (t: string) => {
    const r = checkText(t, deps);
    failures.push(...r.failures);
    return r.text;
  };
  return {
    plan: {
      ...plan,
      title: clean(plan.title) || plan.title.replace(/[^\p{L}\p{N} ,'-]/gu, ""),
      objective: clean(plan.objective),
      days: plan.days.map((d) => ({ ...d, title: clean(d.title) || `Day ${d.day}`, explanation: clean(d.explanation), questions: d.questions.map(clean).filter(Boolean), application: d.application ? clean(d.application) || null : null, prayer: d.prayer ? clean(d.prayer) || null : null })),
    },
    failures,
  };
}

/** Generate a personalized study (Pro), check it, and save it. */
export async function generateStudyPlan(input: PlanInput): Promise<PlanResult> {
  const topic = input.topic.trim().slice(0, 160);
  if (topic.length < 3) return { ok: false, code: "invalid", error: "Choose or describe a topic." };
  if (!isStudyDuration(input.days)) return { ok: false, code: "invalid", error: "Choose 7, 14, 30, 60 or 90 days." };
  const days = input.days;
  const pre = await preflight(input.userId, input.plan, "standard");
  if ("ok" in pre) return pre;
  if (!pre.limits.studyPlans) return { ok: false, code: "not_entitled", error: "Personalized Bible studies are included with Pro All Access." };
  const service = getServiceSupabase();
  const { data: existing } = await service.from("biblical_ai_saved_studies").select("id, content").eq("user_id", input.userId).eq("request_id", input.requestId).maybeSingle();
  if (existing) return { ok: true, studyId: existing.id as string, study: (existing.content as { plan: StudyPlan }).plan, replayed: true };

  const scripture = retrieveScripture(`${topic} ${input.passage ?? ""}`, { depth: "deep", category: "personal", passage: input.passage ?? null });
  const userMessage = `${buildUserMessage({ question: `Create a ${days}-day Bible study on: ${topic}`, depth: "standard", category: "personal", passages: scripture.passages, crossReferences: scripture.crossReferences, words: [], documents: [] })}\n\nThe plan must have exactly ${days} days, numbered 1 to ${days}.${days >= 60 ? " Keep each day short: a two-sentence explanation and two questions." : ""}`;
  const started = Date.now();
  let usageId: number | null = null;
  let modelUsed = "";
  try {
    const study = await withAiRequest({ supabase: service, userId: input.userId, plan: input.plan, kind: "bible_study", tier: "fast", allowance: allowanceFor(pre.limits) }, async ({ client, model }) => {
      modelUsed = model;
      usageId = await reserveQuestion(input.userId, pre.limits);
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
      let inputTokens = 0;
      let outputTokens = 0;
      let cost = 0;
      let out: StudyPlan | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !out; attempt++) {
        const msg = await client.messages.create(
          { model, max_tokens: PLAN_TOKENS[days], system: [{ type: "text", text: STUDY_PLAN_SYSTEM, cache_control: { type: "ephemeral" } }], tools: [PLAN_TOOL], tool_choice: { type: "tool", name: PLAN_TOOL.name }, messages },
          { signal: input.signal, timeout: PLAN_ATTEMPT_TIMEOUT_MS },
        );
        inputTokens += msg.usage.input_tokens;
        outputTokens += msg.usage.output_tokens;
        cost += costMicros(model, tokenUsage(msg.usage));
        if (msg.stop_reason === "refusal") throw new AiError("provider", "refused", undefined, cost);
        const raw = rawPlanSchema.safeParse(toolInput(msg, PLAN_TOOL.name));
        const toolUse = msg.content.find((b) => b.type === "tool_use");
        const checked = raw.success ? validatePlan(raw.data, { days, topic, verseCount: (r) => getPassage(r).filter((v) => v.text).length }) : { plan: null, failures: ["The plan did not match the required structure."] };
        let failures = checked;
        if (checked.plan) {
          // Readings are valid; the prose gets the same reference, quotation and attribution checks as answers.
          const prose = checkPlanProse(checked.plan, scripture.references);
          if (!prose.failures.length || attempt === MAX_ATTEMPTS || !toolUse) out = prose.plan;
          else failures = { plan: null, failures: prose.failures };
        }
        if (out) break;
        if (attempt < MAX_ATTEMPTS && toolUse) messages.push({ role: "assistant", content: msg.content }, { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: `The plan failed these checks:\n${failures.failures.slice(0, 15).map((f) => `- ${f}`).join("\n")}\nCall submit_plan again with a corrected plan.` }] });
      }
      return { value: out, inputTokens, outputTokens, costMicros: cost };
    });
    if (!study) {
      if (usageId !== null) await service.from("bible_ai_usage").update({ status: "failed", model: modelUsed, feature: "study_plan", latency_ms: Date.now() - started }).eq("id", usageId);
      return { ok: false, code: "error", error: "A study that passed every check couldn't be prepared. Nothing was counted; please try again." };
    }
    const { data: row, error } = await service
      .from("biblical_ai_saved_studies")
      .insert({ user_id: input.userId, kind: "plan", title: study.title.slice(0, 120), content: { plan: study }, request_id: input.requestId })
      .select("id")
      .single();
    if (error || !row) throw error ?? new Error("study not saved");
    if (usageId !== null) await service.from("bible_ai_usage").update({ status: "done", model: modelUsed, feature: "study_plan", latency_ms: Date.now() - started }).eq("id", usageId);
    return { ok: true, studyId: row.id as string, study, replayed: false };
  } catch (err) {
    if (usageId !== null) await service.from("bible_ai_usage").update({ status: "failed", model: modelUsed, feature: "study_plan", latency_ms: Date.now() - started }).eq("id", usageId);
    if (input.signal?.aborted) return abortedResult(input.signal);
    if (err instanceof AiError) {
      if (err.message === "refused") return { ok: false, code: "refused", error: "Biblical AI can't create a study on that topic. Try another topic." };
      return { ok: false, code: codeOf(err), error: err.message, retryAfter: err.retryAfterSeconds };
    }
    logError("biblical_ai.plan", err);
    return { ok: false, code: "error", error: "The study couldn't be created just now. Please try again." };
  }
}
