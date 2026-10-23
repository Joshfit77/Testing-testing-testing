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
