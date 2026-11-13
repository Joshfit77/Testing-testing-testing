/**
 * AI cost economics (pure, unit-tested): what an AI request costs, what a Pro member actually pays us after store
 * and payment fees, and how much AI each member can use per month sustainably. Every limit the server enforces
 * (the per-member monthly AI budget, the request allowance and the larger-model share) is derived here, so a price
 * or fee change flows through one place. See docs/pro/AI_COST.md for the worked numbers.
 *
 * Units: money in micro-USD (1 USD = 1,000,000) so sums stay exact integers. A model price of $X per million
 * tokens is exactly X micro-USD per token.
 */
import { APPROVED_PRO_PRICE_CENTS } from "./plans";

export const MICROS_PER_USD = 1_000_000;

/**
 * Anthropic first-party prices, USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, read
 * 2026-11-02; docs/ai-eval/COST_MODEL.md). Cache writes are the 5-minute cache. Prompts in this app stay far below the
 * 100,000-token long-context tier.
 */
export const MODEL_PRICES: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  "claude-opus-5-5": { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
};

export interface TokenUsage {
  /** Uncached input tokens. */
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

/** Price table for a model id; an unknown model is priced as the most expensive known one, never as free. */
export function priceFor(model: string) {
  const exact = MODEL_PRICES[model];
  if (exact) return exact;
  const family = Object.keys(MODEL_PRICES).find((k) => model.startsWith(k.replace(/-\d+-\d+$/, "")));
  return family ? MODEL_PRICES[family]! : MODEL_PRICES["claude-opus-5-5"]!;
}

/** Cost of one provider call in micro-USD, rounded up. */
export function costMicros(model: string, u: TokenUsage): number {
  const p = priceFor(model);
  const raw = u.input * p.input + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead + u.output * p.output;
  return Math.ceil(raw);
}

/** Usage block as the Anthropic SDK reports it. */
export interface ProviderUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function tokenUsage(u: ProviderUsage | null | undefined): TokenUsage {
  return { input: u?.input_tokens ?? 0, cacheWrite: u?.cache_creation_input_tokens ?? 0, cacheRead: u?.cache_read_input_tokens ?? 0, output: u?.output_tokens ?? 0 };
}

// --------------------------------------------------------------------------------------------- What a member pays us

/** The fees between the price and what reaches us. Stripe's standard US card fee; store rates as Apple/Google publish. */
export const FEES = {
  stripePercent: 0.029,
  stripeFixedCents: 30,
  /** App Store / Google Play: 15% (Small Business Program, or subscriptions after their first year), else 30%. */
  storeReduced: 0.15,
  storeStandard: 0.3,
} as const;

export interface Channel {
  key: string;
  label: string;
  /** What a member is charged per month on this channel (yearly ÷ 12). */
  grossMonthlyCents: number;
  /** What reaches us per member-month after fees. */
  netMonthlyCents: number;
}

/**
 * Net revenue per member-month for every way of buying Pro. A yearly member pays up front but uses AI all year, so
 * the yearly price is spread over 12 months and budgets are enforced month by month: a yearly member can't spend
 * the year's AI in the first month, and a refund in month 2 doesn't leave a year's AI already spent.
 */
export function revenueChannels(prices: { monthCents: number; yearCents: number } = { monthCents: APPROVED_PRO_PRICE_CENTS.month, yearCents: APPROVED_PRO_PRICE_CENTS.year }): Channel[] {
  const m = prices.monthCents;
  const y = prices.yearCents;
  const stripe = (cents: number) => cents - (cents * FEES.stripePercent + FEES.stripeFixedCents);
  return [
    { key: "web_month", label: "Web, monthly (Stripe)", grossMonthlyCents: m, netMonthlyCents: stripe(m) },
    { key: "web_year", label: "Web, yearly (Stripe)", grossMonthlyCents: y / 12, netMonthlyCents: stripe(y) / 12 },
    { key: "store_month_15", label: "App Store / Play, monthly at 15%", grossMonthlyCents: m, netMonthlyCents: m * (1 - FEES.storeReduced) },
    { key: "store_year_15", label: "App Store / Play, yearly at 15%", grossMonthlyCents: y / 12, netMonthlyCents: (y * (1 - FEES.storeReduced)) / 12 },
    { key: "store_month_30", label: "App Store / Play, monthly at 30%", grossMonthlyCents: m, netMonthlyCents: m * (1 - FEES.storeStandard) },
    { key: "store_year_30", label: "App Store / Play, yearly at 30%", grossMonthlyCents: y / 12, netMonthlyCents: (y * (1 - FEES.storeStandard)) / 12 },
  ].map((c) => ({ ...c, grossMonthlyCents: Math.round(c.grossMonthlyCents * 100) / 100, netMonthlyCents: Math.round(c.netMonthlyCents * 100) / 100 }));
}

/**
 * Assumptions for everything that isn't AI (owner to confirm; overridable by env without a deploy):
 * - other operating cost per Pro member-month: hosting, database, storage, email, error monitoring and support
 *   tools, $1.00 (an estimate, not a measured bill);
 * - AI may use at most 20% of what's left of the lowest-net channel's revenue, so the rest covers margin, refunds,
 *   chargebacks, taxes not included above and growth.
 */
export const ECONOMICS_DEFAULTS = { opsCostPerMemberCents: 100, aiShareOfNet: 0.2 } as const;

export interface AiBudget {
  /** The channel the budget is sized against (the one that leaves us least). */
  worstChannel: Channel;
  /** Per Pro member per calendar month, micro-USD. */
  perMemberMonthlyMicros: number;
}

/** The sustainable monthly AI budget per Pro member, sized for the lowest-net way of paying. */
export function sustainableAiBudget(opts: { prices?: { monthCents: number; yearCents: number }; opsCostPerMemberCents?: number; aiShareOfNet?: number } = {}): AiBudget {
  const channels = revenueChannels(opts.prices);
  const worst = channels.reduce((a, b) => (b.netMonthlyCents < a.netMonthlyCents ? b : a));
  const ops = opts.opsCostPerMemberCents ?? ECONOMICS_DEFAULTS.opsCostPerMemberCents;
  const share = opts.aiShareOfNet ?? ECONOMICS_DEFAULTS.aiShareOfNet;
  const afterOps = Math.max(0, worst.netMonthlyCents - ops);
  const cents = Math.min(afterOps, worst.netMonthlyCents * share);
  return { worstChannel: worst, perMemberMonthlyMicros: Math.floor(cents * 10_000) };
}

// ------------------------------------------------------------------------------------- Expected cost of each request

/**
 * Expected (not worst-case) cost of one request, used to hold budget while a request is running and to size the
 * allowance. Chat figures are the cold-cache costs from docs/ai-eval/COST_MODEL.md (1.5 rounds, 900/1,600 output
 * tokens per round); the rest are sized from each feature's max_tokens. The real cost replaces the hold afterwards.
 */
export const EXPECTED_COST_MICROS = {
  chat_fast: 3_400,
  chat_smart: 80_000,
  plan: 100_000,
  meal_plan: 6_000,
  food_photo: 4_000,
  food_explain: 2_500,
  weekly_report: 1_500,
} as const;

export type ExpectedCostKey = keyof typeof EXPECTED_COST_MICROS;

export function expectedCostMicros(kind: string, tier: "fast" | "smart"): number {
  if (kind === "chat") return tier === "smart" ? EXPECTED_COST_MICROS.chat_smart : EXPECTED_COST_MICROS.chat_fast;
  if (kind === "plan") return EXPECTED_COST_MICROS.plan;
  const base = EXPECTED_COST_MICROS[kind as ExpectedCostKey] ?? EXPECTED_COST_MICROS.chat_fast;
  // A feature that runs on the larger model costs roughly 20× its fast-model figure (Sonnet vs Haiku prices).
  return tier === "smart" ? base * 20 : base;
}

/**
 * The most one chat request may spend before the coach must answer with what it has (no further tool rounds).
 * About 6× the expected cost: room for real multi-step questions, while a runaway loop is cut off.
 */
export const REQUEST_CEILING_MICROS = { fast: 25_000, smart: 400_000 } as const;

/**
 * Request allowance that fits the budget: the larger-model share first (plans and complex questions), the rest on
 * the fast model, sized with cold-cache costs so a member who uses all of it still stays within budget.
 */
export function sustainableAllowance(budgetMicros: number, opts: { smartRequests?: number } = {}) {
  const smart = opts.smartRequests ?? 10;
  const smartCost = smart * EXPECTED_COST_MICROS.chat_smart;
  const fast = Math.max(0, Math.floor((budgetMicros - smartCost) / EXPECTED_COST_MICROS.chat_fast));
  return { smart, total: smart + fast, expectedMaxMicros: smartCost + fast * EXPECTED_COST_MICROS.chat_fast };
}

// --------------------------------------------------------------------------------------- Budget thresholds and alerts

/** Share of a budget at which operators are alerted (each once per month). */
export const ALERT_THRESHOLDS = [50, 75, 90, 100] as const;

/** From this share of a member's own monthly budget, requests run on the fast model only. */
export const MEMBER_DOWNGRADE_PERCENT = 75;
/** From this share of the global monthly budget, every request runs on the fast model only. */
export const GLOBAL_DOWNGRADE_PERCENT = 90;

export function percentOf(spent: number, budget: number): number {
  if (budget <= 0) return 100;
  return Math.floor((spent / budget) * 100);
}

/** Thresholds newly crossed when spend moves from `before` to `after`. */
export function crossedThresholds(beforeMicros: number, afterMicros: number, budgetMicros: number): number[] {
  const b = percentOf(beforeMicros, budgetMicros);
  const a = percentOf(afterMicros, budgetMicros);
  return ALERT_THRESHOLDS.filter((t) => b < t && a >= t);
}

export function usd(micros: number, digits = 2): string {
  return `$${(micros / MICROS_PER_USD).toFixed(digits)}`;
}
