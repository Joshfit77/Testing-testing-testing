/**
 * AI usage and cost report for operators (migration 081): Haiku and Sonnet usage, token counts, cost per request,
 * monthly and daily spend, routing reasons, cache savings, and what members actually cost (not the per-member ceiling).
 * Aggregates only: the database function returns no member ids. Reads nothing else and changes nothing.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/ops/ai-cost-report.ts [--days=30 | --month] [--json]
 *
 * The service-role key is read from the environment and never printed.
 */
import { createClient } from "@supabase/supabase-js";
import { DOWNGRADE_REASON_LABEL, ROUTE_REASON_LABEL, summarizeCostReport, usdPrecise, type AiCostReportData } from "../../src/lib/domain/ai-cost-report";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const args = process.argv.slice(2);
const days = Number(args.find((a) => a.startsWith("--days="))?.slice(7) ?? "0");
const now = new Date();
const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
const from = days > 0 ? new Date(to.getTime() - days * 86_400_000) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

const db = createClient(url, service, { auth: { persistSession: false } });
const { data, error } = await db.rpc("admin_ai_cost_report", { p_from: from.toISOString(), p_to: to.toISOString() });
if (error) {
  console.error(`Report failed: ${error.message}`);
  process.exit(1);
}
const report = data as AiCostReportData;
if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
const s = summarizeCostReport(report);
const line = (label: string, value: string) => console.log(`${label.padEnd(34)} ${value}`);
console.log(`AI cost report, ${from.toISOString().slice(0, 10)} to ${new Date(to.getTime() - 1).toISOString().slice(0, 10)} (UTC)\n`);
line("Spend", usdPrecise(s.costMicros));
line("Requests", String(s.requests));
line("Average per request", usdPrecise(s.avgCostPerRequestMicros));
line("Standard (Haiku) / advanced (Sonnet)", `${s.fastSharePct}% / ${s.smartSharePct}% of requests; ${usdPrecise(s.fastCostMicros)} / ${usdPrecise(s.smartCostMicros)}`);
line("Saved by prompt caching", `${usdPrecise(s.cache.savedMicros)} (${s.cache.savedPctOfNoCache}% of uncached cost, ${s.cache.requestsMeasured} requests measured)`);
line("Input tokens read from cache", `${s.cache.hitRatePct}%`);
line("Members who used AI", String(s.members.members_using_ai));
line("Per member using AI: avg / median", `${usdPrecise(s.members.avg_cost_micros)} / ${usdPrecise(s.members.median_cost_micros)}`);
line("Per member: 90th percentile / max", `${usdPrecise(s.members.p90_cost_micros)} / ${usdPrecise(s.members.max_cost_micros)}`);
line("Average per current Pro member", s.avgPerProMemberMicros == null ? "no Pro members" : `${usdPrecise(s.avgPerProMemberMicros)} (${s.proMembers} members)`);
console.log("\nBy model");
for (const m of report.by_model) console.log(`  ${m.model.padEnd(22)} ${m.tier.padEnd(6)} ${String(m.requests).padStart(7)} req  ${usdPrecise(m.cost_micros).padStart(10)}  avg ${usdPrecise(m.avg_cost_micros)}  in ${m.input_tokens} (cache read ${m.cache_read_tokens}, write ${m.cache_write_tokens})  out ${m.output_tokens}`);
console.log("\nWhy each model was used");
for (const r of report.by_route_reason) console.log(`  ${(ROUTE_REASON_LABEL[r.route_reason] ?? r.route_reason).padEnd(60)} ${r.tier.padEnd(6)} lowered: ${(DOWNGRADE_REASON_LABEL[r.downgrade_reason] ?? r.downgrade_reason).padEnd(28)} ${String(r.requests).padStart(7)} req  ${usdPrecise(r.cost_micros)}`);
console.log("\nBy feature");
for (const k of report.by_kind) console.log(`  ${k.kind.padEnd(16)} ${String(k.requests).padStart(7)} req  ${usdPrecise(k.cost_micros).padStart(10)}  avg ${usdPrecise(k.avg_cost_micros)}`);
console.log("\nBudgets");
for (const m of report.budget_months) console.log(`  month ${m.month}: ${usdPrecise(m.spent_micros)} of ${usdPrecise(m.budget_micros)} (held ${usdPrecise(m.reserved_micros)})`);
for (const d of report.by_day) console.log(`  day ${d.day}: ${d.requests} req, ${usdPrecise(d.cost_micros)} (budget figures ${d.budget_spent_micros == null ? "—" : usdPrecise(d.budget_spent_micros)} of ${d.daily_budget_micros == null ? "—" : usdPrecise(d.daily_budget_micros)})`);
