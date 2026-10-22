import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { aiAllowance } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { aiPlanOutputSchema, validateAiPlan, type AiPlan } from "@/lib/validation/ai";
import { formatAthleteContext, type AthleteSnapshot } from "@/lib/coach/context";
import { buildSystemBlocks, CHAT_MAX_TOKENS, fallbackParams, MAX_TOOL_ROUNDS, sanitizeAssistantContent } from "@/lib/coach/prompt";
import { coachModelIds, routeCoachRequest, type ModelTier } from "@/lib/coach/routing";
import { coachToolDefinitions, toolActivityLabel, type CoachProposal } from "@/lib/coach/tools";
import { formatMemoriesForContext } from "@/lib/coach/memory";
import { loadAthleteSnapshot } from "@/server/coach/snapshot";
import { executeCoachTool, type ToolContext } from "@/server/coach/tools";
import { isAiConfigured, isServiceRoleConfigured, serverEnv } from "@/server/env";
import { getLegacyAiTerms } from "@/server/services/billing";
import { isFlagEnabled } from "@/server/flags";
import { rateLimit } from "@/server/rate-limit";
import { logError } from "@/server/log";

export type AiErrorCode =
  | "not_configured"
  | "disabled"
  | "not_entitled"
  | "consent_required"
  | "plan_not_entitled"
  | "quota"
  | "rate_limited"
  | "metering_unavailable"
  | "not_found"
  | "provider";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const AI_ERROR_STATUS: Record<AiErrorCode, number> = {
  not_configured: 503,
  disabled: 503,
  not_entitled: 403,
  consent_required: 403,
  plan_not_entitled: 403,
  quota: 429,
  rate_limited: 429,
  metering_unavailable: 503,
  not_found: 404,
  provider: 502,
};

const PLAN_INSTRUCTIONS = `Plan mode: create a training plan for this athlete as structured output.
Rules:
- Use ONLY exercise slugs from the provided catalog list, and only exercises the athlete's equipment allows.
- 1–7 days per week (match the athlete's available days unless they asked otherwise), 3–8 exercises per day, realistic for their session length.
- reps as a string like "5", "8-12", "10 per side" or "AMRAP"; use seconds (and reps null) for timed exercises.
- rest_seconds 30–240 typically; rpe 5–9 (null for mobility/timed work).
- weeks 1–12. Include a clear progression description (how to add load/reps, when to deload).
- Apply the coaching principles above: sensible weekly volume per muscle for their experience, main lifts first, progression and a deload.
- Respect stated limitations and logged pain skips by avoiding aggravating movements, without diagnosing anything.
- In "reply", briefly explain the plan's logic in 3–6 sentences. Remind the athlete they can skip anything that causes pain.`;

/** Longest earlier message sent back to the model as history (new messages are limited to 4,000 characters). */
const HISTORY_MESSAGE_CHARS = 8_000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // baseURL comes from the SDK's standard ANTHROPIC_BASE_URL env var when set (e2e tests point it at a local mock).
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, maxRetries: 2, timeout: 120_000 });
  return client;
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** The user's monthly AI allowance: their plan's, raised by any legacy terms their subscription kept. */
export async function getAiAllowance(userId: string, plan: Plan) {
  return aiAllowance(plan, await getLegacyAiTerms(userId));
}

/**
 * This month's AI usage against the user's allowance. `chatUsed` counts every request (chat and plan),
 * `planUsed` plan generations and `smartUsed` requests served by the larger model.
 */
export async function getAiUsage(userId: string, plan: Plan) {
  const allowance = await getAiAllowance(userId, plan);
  const limits = { chatLimit: allowance.chatLimit, planLimit: allowance.planLimit, smartLimit: allowance.smartLimit, legacy: allowance.legacy };
  if (!isServiceRoleConfigured()) return { chatUsed: 0, planUsed: 0, smartUsed: 0, ...limits };
  const admin = getServiceSupabase();
  const since = monthStartIso();
  const count = (q: ReturnType<typeof admin.from>) => q.select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  const [chat, gen, smart] = await Promise.all([
    count(admin.from("ai_usage_events")),
    count(admin.from("ai_usage_events")).eq("kind", "plan"),
    count(admin.from("ai_usage_events")).eq("model_tier", "smart"),
  ]);
  // Not knowing the usage must never read as "nothing used".
  const failed = chat.error ?? gen.error ?? smart.error;
  if (failed) {
    logError("ai.usage_count", failed);
    throw new AiError("metering_unavailable", "AI usage can't be checked right now. Please try again shortly.");
  }
  return { chatUsed: chat.count ?? 0, planUsed: gen.count ?? 0, smartUsed: smart.count ?? 0, ...limits };
}

/** All server-side eligibility checks for an AI request. Throws AiError when not allowed. */
export async function assertAiAllowed(userId: string, plan: Plan, mode: "chat" | "plan") {
  if (!isAiConfigured()) throw new AiError("not_configured", "The AI coach isn't configured on this server.");
  if (!(await isFlagEnabled("ai_coach"))) throw new AiError("disabled", "The AI coach is temporarily unavailable.");
  const allowance = await getAiAllowance(userId, plan);
  if (allowance.chatLimit <= 0) throw new AiError("not_entitled", "AI coaching is included with Pro.");
  if (mode === "plan") {
    if (allowance.planLimit <= 0) throw new AiError("plan_not_entitled", "Personalized plan generation is included with Pro.");
    if (!(await isFlagEnabled("ai_plan_generation"))) throw new AiError("disabled", "Plan generation is temporarily unavailable.");
  }
  // Durable metering requires the service role (users cannot write their own usage rows).
  if (!isServiceRoleConfigured()) throw new AiError("metering_unavailable", "AI usage metering isn't configured on this server.");
  const burst = rateLimit(`ai:${userId}`, aiPerMinute(), 60_000);
  if (!burst.ok) throw new AiError("rate_limited", "You're sending messages quickly — please wait a moment.", burst.retryAfterSeconds);
  // The in-memory limiter is per server instance; reserveUsage enforces the same limit across instances.
  const usage = await getAiUsage(userId, plan);
  if (usage.chatUsed >= usage.chatLimit) throw new AiError("quota", `You've used all ${usage.chatLimit} AI messages for this month.`);
  if (mode === "plan" && (usage.planUsed >= usage.planLimit || usage.smartUsed >= usage.smartLimit)) {
    throw new AiError("quota", `You've used this month's plan generations. They reset on the 1st.`);
  }
  return usage;
}

function aiPerMinute(): number {
  return Number.parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "6", 10) || 6;
}

/**
 * Reserve one request against the member's limits before the provider is called. The database re-checks every
 * limit under a per-member lock, so requests sent at the same moment can't overshoot, and a request is counted
 * even if saving its reply later fails. Returns the usage row and the tier allowed (a chat that wanted the larger
 * model falls back to the fast one once that share is used up).
 */
export type AiUsageKind = "chat" | "plan" | "meal_plan" | "food_photo" | "food_explain";

async function reserveUsage(
  userId: string,
  kind: AiUsageKind,
  tier: ModelTier,
  usage: { chatLimit: number; planLimit: number; smartLimit: number },
): Promise<{ usageId: string; tier: ModelTier }> {
  const { data, error } = await getServiceSupabase().rpc("reserve_ai_usage", {
    p_user_id: userId,
    p_kind: kind,
    p_tier: tier,
    p_chat_limit: usage.chatLimit,
    p_plan_limit: usage.planLimit,
    p_smart_limit: usage.smartLimit,
    p_per_minute: aiPerMinute(),
  });
  const row = (data as { usage_id: string; model_tier: ModelTier }[] | null)?.[0];
  if (error || !row) {
    const msg = error?.message ?? "";
    if (msg.includes("ai_rate_limited")) throw new AiError("rate_limited", "You're sending messages quickly — please wait a moment.", 60);
    if (msg.includes("ai_quota_plan")) throw new AiError("quota", "You've used this month's plan generations. They reset on the 1st.");
    if (msg.includes("ai_quota")) throw new AiError("quota", `You've used all ${usage.chatLimit} AI messages for this month.`);
    logError("ai.usage_reserve", error ?? new Error("No reservation returned"));
    throw new AiError("metering_unavailable", "AI usage can't be checked right now. Please try again shortly.");
  }
  return { usageId: row.usage_id, tier: row.model_tier };
}

/** Fill in what a reserved request actually used. */
async function finalizeUsage(usageId: string, model: string, inputTokens: number, outputTokens: number) {
  const { error } = await getServiceSupabase().from("ai_usage_events").update({ model, input_tokens: inputTokens, output_tokens: outputTokens }).eq("id", usageId);
  if (error) logError("ai.usage_record", error);
}

/** Give back a reservation when the provider call itself failed, so members aren't charged for errors. */
async function releaseUsage(usageId: string) {
  const { error } = await getServiceSupabase().from("ai_usage_events").delete().eq("id", usageId);
  if (error) logError("ai.usage_release", error);
}

/** Summarize the user's authorized data for the model (used by plan mode and the chat). */
export async function buildAthleteContext(supabase: SupabaseClient, userId: string): Promise<{ text: string; snapshot: AthleteSnapshot }> {
  const snapshot = await loadAthleteSnapshot(supabase, userId);
  return { text: formatAthleteContext(snapshot), snapshot };
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: AiPlan | CoachProposal | null;
  proposal_status: "proposed" | "applied" | "dismissed" | null;
  created_at: string;
}

export interface CoachTurnResult {
  conversationId: string;
  userMessage: CoachMessage;
  assistantMessage: CoachMessage;
  usage: { used: number; limit: number };
}

/** Streamed progress for the chat UI. */
export type CoachEvent =
  | { type: "status"; text: string }
  | { type: "tool"; name: string; label: string }
  | { type: "text"; delta: string }
  | { type: "reset" };

const REFUSAL_REPLY = "I can't help with that request. I'm happy to help with training, technique, recovery or general nutrition questions instead.";

interface ChatLoopResult {
  reply: string;
  proposal: CoachProposal | null;
  inputTokens: number;
  outputTokens: number;
}

/** The streaming tool-use loop for chat mode. */
async function runChatLoop(params: {
  model: string;
  system: Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  toolCtx: ToolContext;
  onEvent: (e: CoachEvent) => void;
  signal?: AbortSignal;
}): Promise<ChatLoopResult> {
  const { model, system, toolCtx, onEvent, signal } = params;
  const messages = [...params.messages];
  const tools = coachToolDefinitions();
  const texts: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let jsonRetries = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS - 1;
    const stream = getClient().beta.messages.stream(
      {
        model,
        max_tokens: CHAT_MAX_TOKENS,
        system,
        messages,
        tools,
        // On the last allowed round, ask for a final answer without more tool calls.
        tool_choice: lastRound ? { type: "none" } : { type: "auto" },
        output_config: { effort: "medium" },
        ...fallbackParams(model),
      },
      { signal },
    );
    let roundText = "";
    stream.on("text", (delta) => {
      roundText += delta;
      onEvent({ type: "text", delta });
    });
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // With eager input streaming, an unparseable tool input rejects here; re-issue that turn (capped).
      if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIUserAbortError || jsonRetries++ >= 2) throw err;
      if (roundText) onEvent({ type: "reset" });
      onEvent({ type: "status", text: "Retrying…" });
      round--;
      continue;
    }
    inputTokens += (message.usage.input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    outputTokens += message.usage.output_tokens ?? 0;

    if (message.stop_reason === "refusal") {
      onEvent({ type: "reset" });
      return { reply: REFUSAL_REPLY, proposal: null, inputTokens, outputTokens };
    }
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (text) texts.push(text);

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: sanitizeAssistantContent(message.content) });
      continue;
    }
    if (!toolUses.length) {
      if (message.stop_reason === "max_tokens") texts.push("_(Response shortened — ask me to continue.)_");
      break;
    }
    if (message.stop_reason === "max_tokens") {
      // A truncated tool input can still parse; never run it.
      texts.push("_(I ran out of room while checking your data — please ask again, maybe more specifically.)_");
      break;
    }

    messages.push({ role: "assistant", content: sanitizeAssistantContent(message.content) });
    if (text) onEvent({ type: "text", delta: "\n\n" });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of toolUses) {
      onEvent({ type: "tool", name: call.name, label: toolActivityLabel(call.name, call.input) });
      const outcome = await executeCoachTool(toolCtx, call.name, call.input);
      if (outcome.proposal && !toolCtx.proposal) toolCtx.proposal = outcome.proposal;
      results.push({ type: "tool_result", tool_use_id: call.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
    }
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results });
  }

  return { reply: texts.join("\n\n").trim(), proposal: toolCtx.proposal, inputTokens, outputTokens };
}

export async function coachTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  plan: Plan;
  conversationId: string | null;
  message: string;
  mode: "chat" | "plan";
  /** For a new conversation: don't remember anything from it (Pro coaching memory). */
  memoryOff?: boolean;
  onEvent?: (e: CoachEvent) => void;
  signal?: AbortSignal;
}): Promise<CoachTurnResult> {
  const { supabase, userId, plan, message, mode } = params;
  const onEvent = params.onEvent ?? (() => {});
  const usage = await assertAiAllowed(userId, plan, mode);
  // Nothing goes to the AI provider until the user has allowed it (and only while they keep it allowed).
  const { data: consent } = await supabase.from("profiles").select("ai_data_consent_at").eq("id", userId).maybeSingle();
  if (!consent?.ai_data_consent_at) throw new AiError("consent_required", "Allow the AI Coach to use your data first (on the AI Coach screen).");

  let conversationId = params.conversationId;
  let chatMemoryOff = Boolean(params.memoryOff);
  if (conversationId) {
    const { data } = await supabase.from("ai_conversations").select("id, memory_off").eq("id", conversationId).eq("user_id", userId).maybeSingle();
    if (!data) throw new AiError("not_found", "Conversation not found.");
    chatMemoryOff = Boolean(data.memory_off);
  } else {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: userId, title: message.replace(/\s+/g, " ").slice(0, 60) || "New conversation", memory_off: chatMemoryOff })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Conversation insert failed");
    conversationId = data.id as string;
  }

  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: userRow, error: umErr } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "user", content: message })
    .select("id, role, content, proposal, proposal_status, created_at")
    .single();
  if (umErr || !userRow) throw umErr ?? new Error("Message insert failed");

  onEvent({ type: "status", text: "Reading your training log…" });
  const { data: tzRow } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const context = await buildAthleteContext(supabase, userId);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    // Earlier turns, each capped, so stored history can never make one request much larger than intended.
    ...((history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, HISTORY_MESSAGE_CHARS) })) as Anthropic.Beta.BetaMessageParam[]),
    { role: "user", content: message },
  ];
  // The API requires a user turn first; drop a leading assistant message if present.
  while (messages.length && messages[0]!.role !== "user") messages.shift();

  const route = routeCoachRequest({ mode, message, smartUsed: usage.smartUsed, smartLimit: usage.smartLimit, env: process.env });
  let reservation: { usageId: string; tier: ModelTier };
  try {
    reservation = await reserveUsage(userId, mode, route.tier, usage);
  } catch (err) {
    await supabase.from("ai_messages").delete().eq("id", userRow.id);
    throw err;
  }
  const model = reservation.tier === route.tier ? route.model : coachModelIds(process.env)[reservation.tier];
  const memory = context.snapshot.memory;
  const system = buildSystemBlocks({
    faithEnabled: context.snapshot.faithEnabled,
    contextText: context.text,
    memoryText: memory?.enabled
      ? formatMemoriesForContext(memory.items, { wellnessConsent: memory.wellnessConsent, chatMemoryOff })
      : "Coaching memory: switched off by the athlete. Don't offer to remember anything; they can turn it on in AI Coach → Memory.",
  });

  let reply = "";
  let proposal: AiPlan | CoachProposal | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    if (mode === "chat") {
      const toolCtx: ToolContext = { supabase, userId, timeZone: (tzRow?.timezone as string) || "UTC", snapshot: context.snapshot, proposal: null, chatMemoryOff };
      onEvent({ type: "status", text: "Thinking…" });
      const r = await runChatLoop({ model, system, messages, toolCtx, onEvent, signal: params.signal });
      reply = r.reply;
      proposal = r.proposal;
      inputTokens = r.inputTokens;
      outputTokens = r.outputTokens;
    } else {
      onEvent({ type: "status", text: "Drafting your plan — this can take a little while…" });
      const { data: exRows } = await supabase.from("exercises").select("slug, name, equipment, difficulty, is_timed").eq("is_published", true);
      const catalog = (exRows ?? []).map((e) => `${e.slug} | ${e.name} | equipment: ${(e.equipment as string[]).join("/")} | ${e.difficulty}${e.is_timed ? " | timed" : ""}`);
      const knownSlugs = new Set((exRows ?? []).map((e) => e.slug as string));
      const res = await getClient().beta.messages.parse(
        {
          model,
          max_tokens: 16_000,
          system: [...system, { type: "text", text: `${PLAN_INSTRUCTIONS}\n\nExercise catalog (slug | name | equipment | difficulty):\n${catalog.join("\n")}` }],
          messages,
          output_config: { effort: "medium", format: betaZodOutputFormat(aiPlanOutputSchema) },
          ...fallbackParams(model),
        },
        { signal: params.signal },
      );
      inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      outputTokens = res.usage.output_tokens;
      if (res.stop_reason === "refusal") {
        reply = "I can't create a plan for that request. Try describing your goal, schedule and equipment, and I'll draft one.";
      } else if (!res.parsed_output) {
        reply = "I couldn't produce a complete plan that time. Please try again, perhaps with a simpler request.";
      } else {
        const validation = validateAiPlan(res.parsed_output.plan, knownSlugs);
        if (validation.ok) {
          proposal = validation.plan;
          reply = res.parsed_output.reply.trim();
        } else {
          logError("ai.plan_validation", new Error(validation.errors.slice(0, 3).join(" | ")));
          reply = "I drafted a plan, but it didn't pass our safety and format checks, so I haven't shown it. Please try again.";
        }
      }
    }
  } catch (err) {
    // The provider call failed: give the request back and remove the orphaned user message, so retries don't
    // duplicate it.
    await releaseUsage(reservation.usageId);
    await supabase.from("ai_messages").delete().eq("id", userRow.id);
    if (err instanceof Anthropic.APIUserAbortError) throw new AiError("provider", "The request was cancelled.");
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      logError("ai.provider_auth", err, { status: err.status ?? null });
      throw new AiError("not_configured", "The AI coach isn't configured correctly on this server (the AI provider rejected its key).");
    }
    if (err instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI service is busy. Please try again shortly.", 30);
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("provider", "Couldn't reach the AI service. Please try again.");
    if (err instanceof Anthropic.APIError) {
      logError("ai.provider", err, { status: err.status ?? null });
      throw new AiError("provider", "The AI service returned an error. Please try again.");
    }
    throw err;
  }

  // Counted before anything else can fail.
  await finalizeUsage(reservation.usageId, model, inputTokens, outputTokens);
  // Replies are written by the server (members can only insert their own questions).
  const { data: assistantRow, error: amErr } = await getServiceSupabase()
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: (reply || "Sorry — I didn't get a response. Please try again.").slice(0, 20_000),
      proposal,
      proposal_status: proposal ? "proposed" : null,
    })
    .select("id, role, content, proposal, proposal_status, created_at")
    .single();
  if (amErr || !assistantRow) throw amErr ?? new Error("Assistant message insert failed");
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  return {
    conversationId,
    userMessage: userRow as CoachMessage,
    assistantMessage: assistantRow as CoachMessage,
    usage: { used: usage.chatUsed + 1, limit: usage.chatLimit },
  };
}

/**
 * One AI request outside the coach chat (meal plans, food photos, food explanations), under the same rules as the
 * chat: the member's AI allowance and rate limits, their AI data consent, a reservation counted before the provider
 * is called (given back if the call fails), and token counts recorded afterwards. `run` makes the provider call.
 */
export async function withAiRequest<T>(
  params: { supabase: SupabaseClient; userId: string; plan: Plan; kind: Exclude<AiUsageKind, "chat" | "plan">; tier?: ModelTier },
  run: (ctx: { client: Anthropic; model: string }) => Promise<{ value: T; inputTokens: number; outputTokens: number }>,
): Promise<T> {
  const usage = await assertAiAllowed(params.userId, params.plan, "chat");
  const { data: consent } = await params.supabase.from("profiles").select("ai_data_consent_at").eq("id", params.userId).maybeSingle();
  if (!consent?.ai_data_consent_at) throw new AiError("consent_required", "Allow the AI features to use your data first (on the AI Coach screen).");
  const reservation = await reserveUsage(params.userId, params.kind, params.tier ?? "fast", usage);
  const model = coachModelIds(process.env)[reservation.tier];
  let result: { value: T; inputTokens: number; outputTokens: number };
  try {
    result = await run({ client: getClient(), model });
  } catch (err) {
    await releaseUsage(reservation.usageId);
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.APIUserAbortError) throw new AiError("provider", "The request was cancelled.");
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      logError("ai.provider_auth", err, { status: err.status ?? null });
      throw new AiError("not_configured", "The AI service isn't configured correctly on this server.");
    }
    if (err instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI service is busy. Please try again shortly.", 30);
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("provider", "Couldn't reach the AI service. Please try again.");
    if (err instanceof Anthropic.APIError) {
      logError("ai.provider", err, { status: err.status ?? null, kind: params.kind });
      throw new AiError("provider", "The AI service returned an error. Please try again.");
    }
    throw err;
  }
  await finalizeUsage(reservation.usageId, model, result.inputTokens, result.outputTokens);
  return result.value;
}
