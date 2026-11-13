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

/**
 * The fees between the price and what reaches us, per provider (checked 2026-11-13; re-check before launch):
 * - Stripe (web): 2.9% + 30¢ per US card payment, plus Stripe Billing at 0.7% of recurring volume (pay-as-you-go).
 * - Apple App Store: 30% in a subscriber's first year, 15% after a year of paid service or for every subscription
 *   under the App Store Small Business Program (under $1M a year, on application).
 * - Google Play: 15% on subscriptions from the first day.
 * - RevenueCat (store purchases only): free up to $2,500 of monthly tracked revenue, then 1% of tracked revenue.
 *   Counted at 1% throughout, the conservative case.
 */
export const FEES = {
  stripePercent: 0.029,
  stripeFixedCents: 30,
  stripeBillingPercent: 0.007,
  appleStandard: 0.3,
  appleReduced: 0.15,
  google: 0.15,
  revenueCatPercent: 0.01,
} as const;

export interface Channel {
  key: string;
  label: string;
  /** What a member is charged per month on this channel (yearly ÷ 12: a yearly member pays once a year). */
  grossMonthlyCents: number;
  /** What reaches us per member-month after the store or payment fees. */
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
  const stripe = (cents: number) => cents - (cents * (FEES.stripePercent + FEES.stripeBillingPercent) + FEES.stripeFixedCents);
  const store = (cents: number, commission: number) => cents * (1 - commission - FEES.revenueCatPercent);
  return [
    { key: "web_month", label: "Web, monthly (Stripe + Stripe Billing)", grossMonthlyCents: m, netMonthlyCents: stripe(m) },
    { key: "web_year", label: "Web, yearly (Stripe + Stripe Billing)", grossMonthlyCents: y / 12, netMonthlyCents: stripe(y) / 12 },
    { key: "google_month", label: "Google Play, monthly (15%)", grossMonthlyCents: m, netMonthlyCents: store(m, FEES.google) },
    { key: "google_year", label: "Google Play, yearly (15%)", grossMonthlyCents: y / 12, netMonthlyCents: store(y, FEES.google) / 12 },
    { key: "apple_month_15", label: "App Store, monthly at 15% (Small Business Program, or after year one)", grossMonthlyCents: m, netMonthlyCents: store(m, FEES.appleReduced) },
    { key: "apple_year_15", label: "App Store, yearly at 15% (Small Business Program, or after year one)", grossMonthlyCents: y / 12, netMonthlyCents: store(y, FEES.appleReduced) / 12 },
    { key: "apple_month_30", label: "App Store, monthly at 30% (first year, no Small Business Program)", grossMonthlyCents: m, netMonthlyCents: store(m, FEES.appleStandard) },
    { key: "apple_year_30", label: "App Store, yearly at 30% (first year, no Small Business Program)", grossMonthlyCents: y / 12, netMonthlyCents: store(y, FEES.appleStandard) / 12 },
  ].map((c) => ({ ...c, grossMonthlyCents: Math.round(c.grossMonthlyCents * 100) / 100, netMonthlyCents: Math.round(c.netMonthlyCents * 100) / 100 }));
}

/**
 * Everything that isn't AI, per Pro member-month (estimates, not measured bills; owner to confirm, overridable):
 * hosting $0.35, database $0.30, storage $0.10, email and monitoring $0.10, support and other tools $0.15 = $1.00,
 * plus 2% of the price set aside for refunds and chargebacks. AI should use at most 20% of the lowest net.
 */
export const OPERATING_COST_CENTS = { hosting: 35, database: 30, storage: 10, emailAndMonitoring: 10, supportAndOther: 15 } as const;
export const ECONOMICS_DEFAULTS = {
  opsCostPerMemberCents: Object.values(OPERATING_COST_CENTS).reduce((a, b) => a + b, 0),
  refundShareOfGross: 0.02,
  aiShareOfNet: 0.2,
  /** The owner's AI spending target per Pro member-month (brief 2026-11-13): the enforced member budget. */
  aiTargetMicros: 1_400_000,
} as const;

export interface AiBudget {
  /** The channel that leaves us least. */
  worstChannel: Channel;
  /** The enforced budget per Pro member per calendar month, micro-USD (the owner's target). */
  perMemberMonthlyMicros: number;
  /** What the guideline (20% of the lowest net, after other costs and refunds) would allow, for comparison. */
  derivedMicros: number;
}

/** The monthly AI budget per Pro member: the owner's target, with what the lowest-net channel would sustain. */
export function sustainableAiBudget(opts: { prices?: { monthCents: number; yearCents: number }; opsCostPerMemberCents?: number; aiShareOfNet?: number; targetMicros?: number } = {}): AiBudget {
  const channels = revenueChannels(opts.prices);
  const worst = channels.reduce((a, b) => (b.netMonthlyCents < a.netMonthlyCents ? b : a));
  const ops = opts.opsCostPerMemberCents ?? ECONOMICS_DEFAULTS.opsCostPerMemberCents;
  const share = opts.aiShareOfNet ?? ECONOMICS_DEFAULTS.aiShareOfNet;
  const refunds = worst.grossMonthlyCents * ECONOMICS_DEFAULTS.refundShareOfGross;
  const afterCosts = Math.max(0, worst.netMonthlyCents - ops - refunds);
  const derivedMicros = Math.floor(Math.min(afterCosts, worst.netMonthlyCents * share) * 10_000);
  const target = opts.targetMicros ?? ECONOMICS_DEFAULTS.aiTargetMicros;
  // Never more than the channel can pay for after its other costs.
  return { worstChannel: worst, perMemberMonthlyMicros: Math.min(target, Math.floor(afterCosts * 10_000)), derivedMicros };
}

export interface ChannelEconomics extends Channel {
  refundsCents: number;
  opsCents: number;
  /** AI at the given monthly cost, and what's left. */
  aiCents: number;
  marginCents: number;
  aiShareOfNetPct: number;
  /** AI above 20% of net, or a margin under $1: worth the owner's attention. */
  flagged: boolean;
}

/** Per-channel monthly economics for a member who spends `aiMicros` on AI (e.g. the full $1.40 target). */
export function channelEconomics(aiMicros: number, prices?: { monthCents: number; yearCents: number }): ChannelEconomics[] {
  return revenueChannels(prices).map((c) => {
    const refundsCents = Math.round(c.grossMonthlyCents * ECONOMICS_DEFAULTS.refundShareOfGross * 100) / 100;
    const opsCents = ECONOMICS_DEFAULTS.opsCostPerMemberCents;
    const aiCents = aiMicros / 10_000;
    const marginCents = Math.round((c.netMonthlyCents - refundsCents - opsCents - aiCents) * 100) / 100;
    const aiShareOfNetPct = Math.round((aiCents / c.netMonthlyCents) * 1000) / 10;
    return { ...c, refundsCents, opsCents, aiCents, marginCents, aiShareOfNetPct, flagged: aiShareOfNetPct > ECONOMICS_DEFAULTS.aiShareOfNet * 100 || marginCents < 100 };
  });
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
 * Fast: about 4× the expected cost (room for a multi-tool question; a runaway loop is cut off, so a long request
 * can't eat many standard requests' worth of budget). Larger: 5×.
 */
export const REQUEST_CEILING_MICROS = { fast: 15_000, smart: 400_000 } as const;

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
