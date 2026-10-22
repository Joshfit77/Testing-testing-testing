/**
 * Prompt assembly and model selection for the AI coach (pure, unit-tested).
 *
 * Cache layout (render order is tools → system → messages): the tool list and `COACH_STATIC_PROMPT`
 * are identical for every user on a model, so the first breakpoint caches them for everyone. Faith
 * users get a second cached block (the verse list in the active translation). The per-user athlete context comes last and
 * is never cached across users.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { Plan } from "@/lib/domain/types";
import { COACH_STATIC_PROMPT, FAITH_DISABLED_INSTRUCTIONS, FAITH_ENABLED_INSTRUCTIONS, PLAN_NOTES } from "./knowledge";

/**
 * Model ids (per Anthropic's current model guidance): Pro gets Claude Opus 5.5, the current default
 * and strongest general-availability Opus; Plus gets Claude Sonnet 5.5, the current Sonnet — capable
 * and about half the per-token price. Both can be overridden by env without a deploy.
 */
export const DEFAULT_COACH_MODELS = { pro: "claude-opus-5-5", plus: "claude-sonnet-5-5" } as const;

export function selectCoachModel(plan: Plan, env: Record<string, string | undefined>): string {
  if (plan === "pro") return env.COACH_MODEL_PRO || env.AI_MODEL || DEFAULT_COACH_MODELS.pro;
  return env.COACH_MODEL_PLUS || DEFAULT_COACH_MODELS.plus;
}

/** Models that accept server-side refusal fallbacks in the `"default"` routing form. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
export function fallbackParams(model: string): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
}

/** Output budget per request (includes adaptive thinking). Streaming, so a generous cap is safe. */
export const CHAT_MAX_TOKENS = 32_000;
/** Upper bound on model round-trips per user message (each tool batch is one round-trip). */
export const MAX_TOOL_ROUNDS = 6;

export function buildSystemBlocks(opts: { faithEnabled: boolean; plan: Plan; contextText: string }): Anthropic.Beta.BetaTextBlockParam[] {
  const blocks: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: COACH_STATIC_PROMPT, cache_control: { type: "ephemeral" } }];
  if (opts.faithEnabled) blocks.push({ type: "text", text: FAITH_ENABLED_INSTRUCTIONS, cache_control: { type: "ephemeral" } });
  const planNote = opts.plan === "pro" ? PLAN_NOTES.pro : PLAN_NOTES.plus;
  blocks.push({
    type: "text",
    text: [opts.faithEnabled ? null : FAITH_DISABLED_INSTRUCTIONS, planNote, `Athlete context (this user's own logged data, loaded just now):\n${opts.contextText}`].filter(Boolean).join("\n\n"),
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
