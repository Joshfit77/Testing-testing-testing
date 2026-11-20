/**
 * The AI cost report (pure, unit-tested): what `admin_ai_cost_report` (migration 081) returns, and the figures the
 * owner reads from it. Everything is measured from recorded requests: real token counts at the published prices,
 * which model served each request and why. The per-member budget ($1.40 a month by default) is a ceiling the server
 * enforces, never an average: actual spend per member is shown separately here.
 *
 * Aggregates only: the report has no member ids or personal data.
 */

export interface CostRow {
  requests: number;
  cost_micros: number;
}

export interface AiCostReportData {
  from: string;
  to: string;
  totals: CostRow & {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    requests_with_cache_data: number;
    /** Input tokens of the requests that have cache data (older rows folded cache tokens into input). */
    input_tokens_with_cache_data?: number;
    no_cache_cost_micros: number;
    cost_micros_with_cache_data: number;
  };
  by_model: (CostRow & { model: string; tier: "fast" | "smart"; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number; avg_cost_micros: number; max_cost_micros: number })[];
  by_kind: (CostRow & { kind: string; avg_cost_micros: number })[];
  by_route_reason: (CostRow & { route_reason: string; tier: "fast" | "smart"; downgrade_reason: string })[];
  by_day: (CostRow & { day: string; fast_requests: number; smart_requests: number; budget_spent_micros: number | null; daily_budget_micros: number | null })[];
  members: { members_using_ai: number; avg_cost_micros: number; median_cost_micros: number; p90_cost_micros: number; max_cost_micros: number; avg_requests: number };
  /** Current Pro entitlements (expired ones not counted). */
  pro_members_now: number;
  /** Today's (UTC) global figures as the budget table holds them, holds included. */
  today?: { day: string; budget_micros: number; spent_micros: number; reserved_micros: number } | null;
  budget_months: { month: string; budget_micros: number; spent_micros: number; reserved_micros: number }[];
  budget_month_alerts: { month: string; threshold: number }[];
  budget_day_alerts: { day: string; threshold: number }[];
}

export interface CostSummary {
  requests: number;
  costMicros: number;
  avgCostPerRequestMicros: number;
  /** Share of requests (not of cost) served by each tier, in percent with one decimal. */
  fastSharePct: number;
  smartSharePct: number;
  fastCostMicros: number;
  smartCostMicros: number;
  /** Measured on the requests recorded since cache data was kept (migration 081). */
  cache: { requestsMeasured: number; savedMicros: number; savedPctOfNoCache: number; readTokens: number; writeTokens: number; hitRatePct: number };
  members: AiCostReportData["members"];
  /** Total spend divided by current Pro members: what an average Pro member cost over the period (members who used no AI included). */
  avgPerProMemberMicros: number | null;
  proMembers: number;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export function summarizeCostReport(r: AiCostReportData): CostSummary {
  const requests = Number(r.totals.requests) || 0;
  const cost = Number(r.totals.cost_micros) || 0;
  const tierRequests = (t: "fast" | "smart") => r.by_model.filter((m) => m.tier === t).reduce((a, m) => a + Number(m.requests), 0);
  const tierCost = (t: "fast" | "smart") => r.by_model.filter((m) => m.tier === t).reduce((a, m) => a + Number(m.cost_micros), 0);
  const noCache = Number(r.totals.no_cache_cost_micros) || 0;
  const withData = Number(r.totals.cost_micros_with_cache_data) || 0;
  const read = Number(r.totals.cache_read_tokens) || 0;
  const write = Number(r.totals.cache_write_tokens) || 0;
  const input = Number(r.totals.input_tokens_with_cache_data ?? r.totals.input_tokens) || 0;
  const pro = Number(r.pro_members_now) || 0;
  return {
    requests,
    costMicros: cost,
    avgCostPerRequestMicros: requests ? Math.round(cost / requests) : 0,
    fastSharePct: pct(tierRequests("fast"), requests),
    smartSharePct: pct(tierRequests("smart"), requests),
    fastCostMicros: tierCost("fast"),
    smartCostMicros: tierCost("smart"),
    cache: {
      requestsMeasured: Number(r.totals.requests_with_cache_data) || 0,
      savedMicros: noCache - withData,
      savedPctOfNoCache: pct(noCache - withData, noCache),
      readTokens: read,
      writeTokens: write,
      // Share of input tokens read from the cache, over the requests that recorded the split.
      hitRatePct: pct(read, input),
    },
    members: r.members,
    avgPerProMemberMicros: pro > 0 ? Math.round(cost / pro) : null,
    proMembers: pro,
  };
}

/** USD with enough digits for sub-cent request costs. */
export function usdPrecise(micros: number): string {
  const usd = micros / 1_000_000;
  const digits = Math.abs(usd) >= 1 ? 2 : Math.abs(usd) >= 0.01 ? 3 : 4;
  return `${usd < 0 ? "−" : ""}$${Math.abs(usd).toFixed(digits)}`;
}

/** Plain-language labels for the routing and downgrade reasons stored with each request. */
export const ROUTE_REASON_LABEL: Record<string, string> = {
  quick: "Routine question (standard model)",
  complex: "Complex question (advanced model)",
  plan: "Program generation (advanced model)",
  smart_budget_used: "Complex, but advanced requests kept for programs",
  feature: "Other AI feature (meal plan, photo, label, explanation, Bible helper, weekly report)",
  "not recorded": "Recorded before routing reasons were kept",
};
export const DOWNGRADE_REASON_LABEL: Record<string, string> = {
  none: "—",
  advanced_used: "Advanced requests used up",
  member_budget: "Member budget protected",
  global_budget: "Monthly app budget at 90%",
  global_daily_budget: "Daily app budget at 90%",
};
