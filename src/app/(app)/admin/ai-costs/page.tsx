import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { DOWNGRADE_REASON_LABEL, ROUTE_REASON_LABEL, summarizeCostReport, usdPrecise, type AiCostReportData } from "@/lib/domain/ai-cost-report";
import { globalBudgetCoverage } from "@/lib/domain/ai-economics";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { aiBudgetConfig } from "@/server/services/ai-budget";

export const metadata = { title: "Admin · AI costs" };

const PERIODS = { month: "This month", "30d": "Last 30 days", "7d": "Last 7 days", today: "Today" } as const;
type Period = keyof typeof PERIODS;

function range(period: Period, now: Date): { from: Date; to: Date } {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(startOfDay.getTime() + 86_400_000);
  if (period === "today") return { from: startOfDay, to };
  if (period === "7d") return { from: new Date(to.getTime() - 7 * 86_400_000), to };
  if (period === "30d") return { from: new Date(to.getTime() - 30 * 86_400_000), to };
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to };
}

const n = (v: number) => Number(v ?? 0).toLocaleString("en-US");
const card = "rounded-2xl border border-border bg-card p-4";
const th = "px-4 py-3";
const td = "px-4 py-2";

/**
 * AI usage and cost, measured from recorded requests (migration 081). Aggregates only: the database function returns no
 * member ids. Read through the admin's own session, so the database checks the admin role as well as this page.
 */
export default async function AdminAiCostsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const period: Period = sp.period && sp.period in PERIODS ? (sp.period as Period) : "month";
  const now = new Date();
  const { from, to } = range(period, now);
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("admin_ai_cost_report", { p_from: from.toISOString(), p_to: to.toISOString() });
  const report = (data as AiCostReportData | null) ?? null;
  const s = report ? summarizeCostReport(report) : null;
  const budget = aiBudgetConfig(now);
  const thisMonth = report?.budget_months.find((m) => m.month === `${now.toISOString().slice(0, 7)}-01`);
  const today = report?.today ?? null;
  const monthBudgetMicros = Number(thisMonth?.budget_micros ?? budget.globalMonthlyMicros);
  const coverage = s ? globalBudgetCoverage({ globalMonthlyMicros: monthBudgetMicros, memberMonthlyMicros: budget.memberMonthlyMicros, proMembers: s.proMembers }) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="AI costs"
        description="Measured from every recorded AI request: real token counts at published prices, the model that answered and why. Aggregates only; no member is identified."
      />
      <AdminNav current="/admin/ai-costs" />
      <nav aria-label="Period" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <Link
            key={p}
            href={`/admin/ai-costs?period=${p}`}
            aria-current={p === period ? "page" : undefined}
            className={
              p === period
                ? "rounded-full border border-gold bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-highlight"
                : "rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            }
          >
            {PERIODS[p]}
          </Link>
        ))}
      </nav>
      {error && <Notice tone="error">Couldn&apos;t load the AI cost report.</Notice>}
      {s && report && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals" data-testid="ai-cost-totals">
            <Tile label={`Spend (${PERIODS[period].toLowerCase()})`} value={usdPrecise(s.costMicros)} />
            <Tile label="AI requests" value={n(s.requests)} />
            <Tile label="Average per request" value={usdPrecise(s.avgCostPerRequestMicros)} />
            <Tile label="Standard / advanced" value={`${s.fastSharePct}% / ${s.smartSharePct}%`} hint="Share of requests (Haiku / Sonnet)" />
            <Tile label="Standard model cost" value={usdPrecise(s.fastCostMicros)} />
            <Tile label="Advanced model cost" value={usdPrecise(s.smartCostMicros)} />
            <Tile
              label="Saved by prompt caching"
              value={usdPrecise(s.cache.savedMicros)}
              hint={s.cache.requestsMeasured ? `${s.cache.savedPctOfNoCache}% of the uncached cost, over ${n(s.cache.requestsMeasured)} requests` : "No requests with cache data yet"}
            />
            <Tile label="Input read from cache" value={`${s.cache.hitRatePct}%`} hint={`${n(s.cache.readTokens)} read, ${n(s.cache.writeTokens)} written`} />
          </section>

          <section className={`${card} space-y-3`} aria-labelledby="member-costs">
            <h2 id="member-costs" className="font-display text-lg font-semibold uppercase">
              What members actually cost
            </h2>
            <p className="text-sm text-muted-foreground">
              The {usdPrecise(budget.memberMonthlyMicros)} per member per month is a ceiling the server enforces, not an average expense. These figures are what
              members actually cost over the period.
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Tile label="Members who used AI" value={n(s.members.members_using_ai)} />
              <Tile label="Average per member using AI" value={usdPrecise(s.members.avg_cost_micros)} />
              <Tile label="Median / 90th percentile" value={`${usdPrecise(s.members.median_cost_micros)} / ${usdPrecise(s.members.p90_cost_micros)}`} />
              <Tile label="Highest member" value={usdPrecise(s.members.max_cost_micros)} />
              <Tile label="Average per Pro member" value={s.avgPerProMemberMicros == null ? "—" : usdPrecise(s.avgPerProMemberMicros)} hint={`Spend ÷ ${n(s.proMembers)} current Pro members`} />
            </div>
          </section>

          <section className={`${card} space-y-2`} aria-labelledby="budgets">
            <h2 id="budgets" className="font-display text-lg font-semibold uppercase">
              App-wide limits
            </h2>
            {coverage?.short && (
              <Notice tone="warning" className="text-sm">
                <span data-testid="ai-budget-short">
                  The app-wide limit ({usdPrecise(monthBudgetMicros)} a month) covers {n(coverage.coversMembers)} members using their full{" "}
                  {usdPrecise(budget.memberMonthlyMicros)} allowance, and there are {n(s.proMembers)} Pro members now ({usdPrecise(coverage.fullAllowanceMicros)} at
                  their full allowance). When the limit is reached, the AI stops for every member until the month ends. Consider setting
                  AI_GLOBAL_MONTHLY_BUDGET_USD to about {usdPrecise(coverage.suggestedMicros)} (and AI_GLOBAL_DAILY_BUDGET_USD to match).
                </span>
              </Notice>
            )}
            <p className="text-sm">
              This month: {usdPrecise(Number(thisMonth?.spent_micros ?? 0))} spent of {usdPrecise(monthBudgetMicros)}
              {thisMonth?.reserved_micros ? ` (${usdPrecise(Number(thisMonth.reserved_micros))} held by requests in progress)` : ""}.
            </p>
            <p className="text-sm">
              Today (UTC): {usdPrecise(Number(today?.spent_micros ?? 0))} spent of {usdPrecise(Number(today?.budget_micros ?? budget.globalDailyMicros))}
              {today?.reserved_micros ? ` (${usdPrecise(Number(today.reserved_micros))} held by requests in progress)` : ""}.
            </p>
            <p className="text-xs text-muted-foreground">
              Budget figures include what the provider billed for requests that failed and were given back to members; the request tables below count completed
              requests only.
            </p>
          </section>

          <Table title="By model" head={["Model", "Tier", "Requests", "Cost", "Avg", "Max", "Input tokens", "Cache read", "Cache write", "Output tokens"]}>
            {report.by_model.map((m) => (
              <tr key={`${m.model}-${m.tier}`} className="border-t border-border">
                <td className={td}>{m.model}</td>
                <td className={td}>{m.tier === "smart" ? "advanced" : "standard"}</td>
                <td className={td}>{n(m.requests)}</td>
                <td className={td}>{usdPrecise(m.cost_micros)}</td>
                <td className={td}>{usdPrecise(m.avg_cost_micros)}</td>
                <td className={td}>{usdPrecise(m.max_cost_micros)}</td>
                <td className={td}>{n(m.input_tokens)}</td>
                <td className={td}>{n(m.cache_read_tokens)}</td>
                <td className={td}>{n(m.cache_write_tokens)}</td>
                <td className={td}>{n(m.output_tokens)}</td>
              </tr>
            ))}
          </Table>

          <Table title="Why each model was used" head={["Reason", "Model", "Lowered because", "Requests", "Cost"]}>
            {report.by_route_reason.map((r) => (
              <tr key={`${r.route_reason}-${r.tier}-${r.downgrade_reason}`} className="border-t border-border">
                <td className={td}>{ROUTE_REASON_LABEL[r.route_reason] ?? r.route_reason}</td>
                <td className={td}>{r.tier === "smart" ? "advanced" : "standard"}</td>
                <td className={td}>{DOWNGRADE_REASON_LABEL[r.downgrade_reason] ?? r.downgrade_reason}</td>
                <td className={td}>{n(r.requests)}</td>
                <td className={td}>{usdPrecise(r.cost_micros)}</td>
              </tr>
            ))}
          </Table>

          <Table title="By feature" head={["Feature", "Requests", "Cost", "Avg"]}>
            {report.by_kind.map((k) => (
              <tr key={k.kind} className="border-t border-border">
                <td className={td}>{k.kind.replace(/_/g, " ")}</td>
                <td className={td}>{n(k.requests)}</td>
                <td className={td}>{usdPrecise(k.cost_micros)}</td>
                <td className={td}>{usdPrecise(k.avg_cost_micros)}</td>
              </tr>
            ))}
          </Table>

          <Table title="By day (UTC)" head={["Day", "Requests", "Standard", "Advanced", "Cost", "Daily limit"]}>
            {report.by_day.map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className={td}>{d.day}</td>
                <td className={td}>{n(d.requests)}</td>
                <td className={td}>{n(d.fast_requests)}</td>
                <td className={td}>{n(d.smart_requests)}</td>
                <td className={td}>{usdPrecise(d.cost_micros)}</td>
                <td className={td}>{d.daily_budget_micros == null ? "—" : usdPrecise(d.daily_budget_micros)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={card}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-gold-highlight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Table({ title, head, children }: { title: string; head: string[]; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 font-display text-lg font-semibold uppercase">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {head.map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
