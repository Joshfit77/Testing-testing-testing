/**
 * Anthropic first-party API prices used by the evaluation harness to meter and cap spend, in USD per million tokens.
 * Source: https://platform.claude.com/docs/en/about-claude/pricing, read 2026-11-02 (5-minute cache writes; the app
 * only uses the default 5-minute cache). Check the page again before relying on these for a budget decision.
 */
export const PRICING_SOURCE = "platform.claude.com/docs/en/about-claude/pricing (read 2026-11-02)";

export interface Price {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

interface ModelPrice extends Price {
  /** Prices for a prompt (all input tokens, cached or not) above this many tokens, where the model has a long-context tier. */
  longContext?: { threshold: number } & Price;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-haiku-5-5": { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5, longContext: { threshold: 100_000, input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 } },
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  "claude-opus-5-5": { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
};

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** The price row for a model id, or null for a model the harness has no verified price for (it then refuses to run it). */
export function priceFor(model: string, promptTokens = 0): Price | null {
  const p = PRICES[model];
  if (!p) return null;
  return p.longContext && promptTokens > p.longContext.threshold ? p.longContext : p;
}

/** What a response cost, from its reported usage. */
export function costUsd(model: string, u: Usage): number {
  const input = u.input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  const p = priceFor(model, input + read + write);
  if (!p) throw new Error(`No verified price for ${model}`);
  return (input * p.input + write * p.cacheWrite + read * p.cacheRead + (u.output_tokens ?? 0) * p.output) / 1_000_000;
}

/**
 * The most a request could cost before it is sent: every input token at the highest input rate (a cache write) and
 * every allowed output token. `requestBytes` over-counts tokens on purpose (about 3 bytes a token; English text and
 * JSON run nearer 4), so the estimate errs high.
 */
export function worstCaseUsd(model: string, requestBytes: number, maxTokens: number): number {
  const inputTokens = Math.ceil(requestBytes / 3);
  const p = priceFor(model, inputTokens);
  if (!p) throw new Error(`No verified price for ${model}`);
  return (inputTokens * Math.max(p.input, p.cacheWrite) + maxTokens * p.output) / 1_000_000;
}
