import "server-only";
import { MICROS_PER_USD, sustainableAiBudget, usd } from "@/lib/domain/ai-economics";
import { getServiceSupabase } from "@/lib/supabase/server";
import { logError, logInfo } from "@/server/log";

/**
 * Server-side AI spending limits (migration 066). Every value has a safe default derived from the subscription
 * economics (src/lib/domain/ai-economics.ts) and can be changed by environment variable without a deploy:
 *
 *   AI_MEMBER_MONTHLY_BUDGET_USD   per member per calendar month (default: the sustainable budget, about $1.40)
 *   AI_GLOBAL_MONTHLY_BUDGET_USD   for the whole app per calendar month (default $100: an owner decision; see AI_COST.md)
 *   AI_MAX_CONCURRENT              AI requests running at once across the app (default 20)
 *   AI_BUDGET_ALERT_WEBHOOK_URL    optional: alerts at 50/75/90/100% are POSTed here (Slack-compatible {text}) as well
 *                                  as written to the server log
 */
export interface AiBudgetConfig {
  memberMonthlyMicros: number;
  globalMonthlyMicros: number;
  maxInflightPerMember: number;
  maxInflightGlobal: number;
  /** A request that hasn't finished after this long no longer counts as running (the coach's own deadline is 165 s). */
  inflightSeconds: number;
}

const DEFAULT_GLOBAL_MONTHLY_USD = 100;

function usdEnv(name: string, fallbackMicros: number): number {
  const raw = process.env[name];
  if (!raw) return fallbackMicros;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * MICROS_PER_USD) : fallbackMicros;
}

function intEnv(name: string, fallback: number, min = 1): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export function aiBudgetConfig(): AiBudgetConfig {
  return {
    memberMonthlyMicros: usdEnv("AI_MEMBER_MONTHLY_BUDGET_USD", sustainableAiBudget().perMemberMonthlyMicros),
    globalMonthlyMicros: usdEnv("AI_GLOBAL_MONTHLY_BUDGET_USD", DEFAULT_GLOBAL_MONTHLY_USD * MICROS_PER_USD),
    maxInflightPerMember: 2,
    maxInflightGlobal: intEnv("AI_MAX_CONCURRENT", 20),
    inflightSeconds: 180,
  };
}

export interface BudgetAlert {
  threshold: number;
  spent_micros: number;
  budget_micros: number;
}

/** The alert text: totals only, never anything about a member. */
export function budgetAlertText(a: BudgetAlert): string {
  const what = a.threshold >= 100 ? "is used up: AI features are paused for everyone until it is raised or the month ends" : `has reached ${a.threshold}%`;
  return `Narrow Gate Fitness: this month's AI budget ${what} (${usd(a.spent_micros)} of ${usd(a.budget_micros)}). Non-AI features are unaffected.`;
}

/** Tell the operators. Never throws: an alert that can't be delivered must not break the member's request. */
export async function notifyBudgetAlerts(alerts: BudgetAlert[], fetchImpl: typeof fetch = fetch): Promise<void> {
  for (const a of alerts) {
    logInfo("ai.budget_alert", { threshold: a.threshold, spent_usd: Number((a.spent_micros / MICROS_PER_USD).toFixed(2)), budget_usd: Number((a.budget_micros / MICROS_PER_USD).toFixed(2)) });
    const url = process.env.AI_BUDGET_ALERT_WEBHOOK_URL;
    if (!url) continue;
    try {
      const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: budgetAlertText(a) }), signal: AbortSignal.timeout(5_000) });
      if (!res.ok) logError("ai.budget_alert_webhook", new Error(`HTTP ${res.status}`));
    } catch (err) {
      logError("ai.budget_alert_webhook", err);
    }
  }
}

export interface BudgetStatus {
  month: string;
  budgetMicros: number;
  spentMicros: number;
  reservedMicros: number;
  alerts: number[];
}

/** This month's global spend, for operators (scripts/ai-budget-status.ts). */
export async function globalBudgetStatus(now = new Date()): Promise<BudgetStatus> {
  const month = `${now.toISOString().slice(0, 7)}-01`;
  const admin = getServiceSupabase();
  const [{ data: row, error }, { data: alerts }] = await Promise.all([
    admin.from("ai_budget_months").select("budget_micros, spent_micros, reserved_micros").eq("month", month).maybeSingle(),
    admin.from("ai_budget_alerts").select("threshold").eq("month", month).order("threshold"),
  ]);
  if (error) throw error;
  return {
    month,
    budgetMicros: Number(row?.budget_micros ?? aiBudgetConfig().globalMonthlyMicros),
    spentMicros: Number(row?.spent_micros ?? 0),
    reservedMicros: Number(row?.reserved_micros ?? 0),
    alerts: (alerts ?? []).map((a) => a.threshold as number),
  };
}
