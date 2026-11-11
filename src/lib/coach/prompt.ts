/**
 * Prompt assembly for the AI coach (pure, unit-tested). Model choice is in `routing.ts`.
 *
 * Cache layout (render order is tools → system → messages): the tool list and `COACH_STATIC_PROMPT`
 * are identical for every user on a model, so the first breakpoint caches them for everyone. Faith
 * users get a second cached block (the verse list in the active translation). The per-user athlete context comes last and
 * is never cached across users.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { COACH_STATIC_PROMPT, FAITH_DISABLED_INSTRUCTIONS, FAITH_ENABLED_INSTRUCTIONS, PRO_PLAN_NOTE } from "./knowledge";

/** Models that accept server-side refusal fallbacks in the `"default"` routing form. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
export function fallbackParams(model: string): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
}

/** Output budget per chat request (includes adaptive thinking): enough for a long answer, small enough to bound cost. */
export const CHAT_MAX_TOKENS = 12_000;
/** Output budget for plan generation, whose structured output (a whole program) is much longer than a chat reply. */
export const PLAN_MAX_TOKENS = 16_000;
/** Upper bound on model round-trips per user message (each tool batch is one round-trip). */
export const MAX_TOOL_ROUNDS = 6;
/**
 * Plan generation is one request, sent once: the SDK's automatic retries could re-send a slow or failed plan (each
 * attempt billed) past the route's 180 s limit, which then ended the function mid-retry. A failed plan is reported at
 * once and the member can try again.
 */
export const PLAN_REQUEST_OPTIONS = { timeout: 150_000, maxRetries: 0 } as const;
/**
 * A chat turn is up to MAX_TOOL_ROUNDS requests, each allowed 120 s, inside the route's 180 s limit. Each request is
 * retried at most once, and the whole turn is ended at COACH_TURN_DEADLINE_MS (the route passes an AbortSignal),
 * which leaves time to give the reserved message back and tell the member before the platform ends the function.
 */
export const CHAT_REQUEST_OPTIONS = { maxRetries: 1 } as const;
export const COACH_TURN_DEADLINE_MS = 165_000;

/** Longest reply saved (matches the `ai_messages.content` check, migration 049). */
export const REPLY_MAX_CHARS = 60_000;
const SHORTENED_NOTE = "_(Response shortened — ask me to continue.)_";
/**
 * The reply as it is saved: whole when it fits; otherwise cut at a line or word break with the "shortened" note at the
 * end, so the note itself is never what gets cut.
 */
export function fitStoredReply(reply: string, max = REPLY_MAX_CHARS): string {
  if (reply.length <= max) return reply;
  if (reply.endsWith(SHORTENED_NOTE) && reply.length - SHORTENED_NOTE.length <= max) return reply;
  const room = max - SHORTENED_NOTE.length - 2;
  const head = reply.slice(0, room);
  const cut = Math.max(head.lastIndexOf("\n"), head.lastIndexOf(" "));
  return `${(cut > room * 0.8 ? head.slice(0, cut) : head).trimEnd()}\n\n${SHORTENED_NOTE}`;
}

export function buildSystemBlocks(opts: { faithEnabled: boolean; contextText: string; memoryText?: string | null }): Anthropic.Beta.BetaTextBlockParam[] {
  const blocks: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: COACH_STATIC_PROMPT, cache_control: { type: "ephemeral" } }];
  if (opts.faithEnabled) blocks.push({ type: "text", text: FAITH_ENABLED_INSTRUCTIONS, cache_control: { type: "ephemeral" } });
  blocks.push({
    type: "text",
    text: [opts.faithEnabled ? null : FAITH_DISABLED_INSTRUCTIONS, PRO_PLAN_NOTE, `Athlete context (this user's own logged data, loaded just now):\n${opts.contextText}`, opts.memoryText ?? null]
      .filter(Boolean)
      .join("\n\n"),
  });
  return blocks;
}

/**
 * After a mid-output server-side fallback, the declined model's thinking / tool_use blocks before the
 * last `fallback` block must not be echoed back (only its text is continuation context).
 */
export function sanitizeAssistantContent(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlockParam[] {
  const lastFallback = content.map((b) => b.type).lastIndexOf("fallback");
  if (lastFallback < 0) return content as Anthropic.Beta.BetaContentBlockParam[];
  return content.filter((b, i) => i > lastFallback || !["thinking", "redacted_thinking", "tool_use", "server_tool_use"].includes(b.type)) as Anthropic.Beta.BetaContentBlockParam[];
}
