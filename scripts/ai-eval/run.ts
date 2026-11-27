/**
 * AI coach evaluation harness. Runs the scenario set (scenarios.ts) through the app's own coach code path
 * (`coachTurn`: the same prompt, tools, routing, validation and metering as production) for synthetic members on a
 * LOCAL Supabase stack, three times each, and writes transcripts, automated check results, rubric scores, latency,
 * token use, cost and consistency to ai-eval-results/<run>/ (git-ignored).
 *
 *   Estimate only, no network, no spend:
 *     npx tsx --conditions=react-server scripts/ai-eval/run.ts --estimate
 *   Self-test of the harness against a local scripted stand-in (no model, nothing leaves the machine; results are
 *   marked SELF-TEST and are not evaluation results):
 *     npx tsx --conditions=react-server scripts/ai-eval/run.ts --self-test
 *   Live (spends money; the key is read from AI_EVAL_ANTHROPIC_API_KEY and never written anywhere):
 *     AI_EVAL_ANTHROPIC_API_KEY=… npx tsx --conditions=react-server scripts/ai-eval/run.ts --live --confirm-spend --max-usd 8
 *
 * Every model request goes through a local budget proxy (budget-proxy.ts) that stops the run before it could pass
 * --max-usd or --max-requests. The provider's own spend limits are separate: set one on the API key's workspace too.
 * Needs NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY for the local stack.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { startBudgetProxy, type BudgetProxy, type MeteredCall } from "./budget-proxy";
import { CHECK_TITLES, runChecks, type CheckResult } from "./checks";
import { startMockMessagesApi, type MockAnswer, type MockRequestBody } from "./mock-api";
import { PRICES, PRICING_SOURCE } from "./pricing";
import { assertLocalStack, PROFILES, removeEvalMembers, seedMember, type ProfileId, type SeededMember } from "./profiles";
import { CONSISTENCY_SCENARIOS, SCENARIOS, type Scenario } from "./scenarios";
import { CRITERIA, judgeTurn, type Criterion, type JudgeVerdict } from "./judge";

type Mode = "live" | "self-test" | "estimate";

function args() {
  const a = process.argv.slice(2);
  const val = (name: string, d: string) => {
    const i = a.indexOf(name);
    return i >= 0 && a[i + 1] ? a[i + 1]! : d;
  };
  const mode: Mode = a.includes("--live") ? "live" : a.includes("--self-test") ? "self-test" : "estimate";
  return {
    mode,
    confirmSpend: a.includes("--confirm-spend"),
    runs: Math.max(1, Math.min(5, Number(val("--runs", "3")))),
    only: val("--only", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    maxUsd: Number(val("--max-usd", "5")),
    maxRequests: Number(val("--max-requests", "450")),
    judgeModel: val("--judge-model", "claude-opus-5-5"),
    judge: !a.includes("--no-judge"),
    keep: a.includes("--keep-members"),
    out: val("--out", join("ai-eval-results", `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode}`)),
  };
}

export interface TurnRecord {
  scenario: string;
  run: number;
  profile: ProfileId;
  mode: "chat" | "plan";
  status: "done" | "error" | "not-run";
  reply: string;
  replies: string[];
  tools: string[];
  proposal: Record<string, unknown> | null;
  error: string | null;
  models: string[];
  checks: CheckResult[];
  judge: JudgeVerdict | null;
  ms: number;
  firstTextMs: number | null;
  calls: MeteredCall[];
  costUsd: number;
}

// ---------------------------------------------------------------------------------------------- self-test stand-in

const SELF_TEST_NOTE = "[SELF-TEST: scripted stand-in reply, not model output]";
function selfTestAnswer(body: MockRequestBody): MockAnswer {
  const system = typeof body.system === "string" ? body.system : (body.system ?? []).map((b) => b.text).join("\n");
  const last = body.messages.at(-1)!;
  const text = typeof last.content === "string" ? last.content : "";
  if (system.includes("evaluation judge")) {
    const s = { score: 3, reason: "SELF-TEST scripted score" };
    return { blocks: [{ type: "text", text: JSON.stringify({ accuracy: s, personalization: s, safety: s, actionability: s, clarity: s, tone: s, honesty: s, app_rules: s, critical_concerns: [] }) }], usage: { input_tokens: 1500, output_tokens: 300 } };
  }
  if (body.output_config?.format) {
    const four = /4-day/i.test(text);
    const slugs = four ? ["back-squat", "bench-press", "conventional-deadlift", "barbell-row"] : ["goblet-squat", "push-up", "one-arm-dumbbell-row"];
    const days = Array.from({ length: four ? 4 : 3 }, (_, i) => ({
      name: `Day ${i + 1}`,
      focus: "Full body",
      exercises: slugs.map((slug) => ({ exercise_slug: slug, sets: 3, reps: "8-10", seconds: null, rest_seconds: 90, rpe: 7, notes: null })),
    }));
    const plan = { name: "Self-test plan", summary: "Scripted plan for the harness self-test.", weeks: four ? 8 : 4, session_minutes: four ? 75 : 30, difficulty: four ? "intermediate" : "beginner", progression: "Add a rep each week, then load.", days };
    return { blocks: [{ type: "text", text: JSON.stringify({ reply: `${SELF_TEST_NOTE} A ${days.length}-day plan.`, plan }) }], usage: { input_tokens: 9000, output_tokens: 1200 } };
  }
  const toolResult = Array.isArray(last.content) && last.content.some((c) => c.type === "tool_result");
  if (!toolResult && /swap bench press/i.test(text)) {
    return { blocks: [{ type: "tool_use", id: `toolu_self_${Date.now()}`, name: "propose_exercise_swap", input: { from_exercise_slug: "bench-press", to_exercise_slug: "incline-dumbbell-press", scope: "next_workout", reason: "Self-test swap." } }], usage: { input_tokens: 8000, output_tokens: 120 } };
  }
  return { blocks: [{ type: "text", text: `${SELF_TEST_NOTE} Coaching reply for: ${text.slice(0, 80) || "(tool result)"}` }], usage: { input_tokens: 8000, cache_read_input_tokens: 0, output_tokens: 150 } };
}

// ------------------------------------------------------------------------------------------------------ estimate

async function estimate() {
  const { COACH_STATIC_PROMPT } = await import("@/lib/coach/knowledge");
  const { coachToolDefinitions } = await import("@/lib/coach/tools");
  const { CHAT_MAX_TOKENS, PLAN_MAX_TOKENS, MAX_TOOL_ROUNDS } = await import("@/lib/coach/prompt");
  const staticChars = COACH_STATIC_PROMPT.length;
  const toolChars = JSON.stringify(coachToolDefinitions()).length;
  // Characters per token for English prose and JSON: about 4 on older tokenizers; the 5.5 models' tokenizer counts
  // the same text as roughly 30% more tokens, so ~3.1 is used here. These are estimates, not counts.
  const tok = (chars: number) => Math.round(chars / 3.1);
  const lines = [
    `Static prompt: ${staticChars.toLocaleString()} chars ≈ ${tok(staticChars).toLocaleString()} tokens (cached across members)`,
    `Tool definitions: ${toolChars.toLocaleString()} chars ≈ ${tok(toolChars).toLocaleString()} tokens (cached)`,
    `Output caps: chat ${CHAT_MAX_TOKENS.toLocaleString()} tokens per round × up to ${MAX_TOOL_ROUNDS} rounds; plan ${PLAN_MAX_TOKENS.toLocaleString()}.`,
    `Prices (${PRICING_SOURCE}): ${Object.entries(PRICES)
      .map(([m, p]) => `${m} $${p.input}/$${p.output} per MTok (cache read $${p.cacheRead}, write $${p.cacheWrite})`)
      .join("; ")}`,
  ];
  return { staticTokens: tok(staticChars), toolTokens: tok(toolChars), lines };
}

// ---------------------------------------------------------------------------------------------------------- main

async function main() {
  const opt = args();
  const est = await estimate();
  if (opt.mode === "estimate") {
    console.log(est.lines.join("\n"));
    console.log(`\nScenarios: ${SCENARIOS.length} × ${opt.runs} runs. Nothing was sent anywhere. Use --self-test or --live.`);
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anon || !service) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for the local stack.");
  assertLocalStack(url);

  let upstream: string;
  let apiKey: string;
  let stopMock: (() => Promise<void>) | null = null;
  if (opt.mode === "live") {
    apiKey = process.env.AI_EVAL_ANTHROPIC_API_KEY ?? "";
    if (!apiKey) {
      console.error("BLOCKED: no AI_EVAL_ANTHROPIC_API_KEY. Live evaluation was not run. (The key is read only from that variable and never stored.)");
      process.exit(2);
    }
    if (!opt.confirmSpend) {
      console.error(`Live evaluation spends real money (ceiling $${opt.maxUsd.toFixed(2)}). Re-run with --confirm-spend.`);
      process.exit(2);
    }
    upstream = process.env.AI_EVAL_UPSTREAM ?? "https://api.anthropic.com";
  } else {
    const mock = await startMockMessagesApi((b) => selfTestAnswer(b));
    upstream = mock.url;
    apiKey = "self-test-not-a-key";
    stopMock = mock.close;
  }

  mkdirSync(opt.out, { recursive: true });
  const logLines: string[] = [];
  const log = (l: string) => {
    logLines.push(l);
    console.log(l);
  };
  const proxy: BudgetProxy = await startBudgetProxy({ upstream, apiKey, limits: { maxRequests: opt.maxRequests, maxUsd: opt.maxUsd }, log });

  // The app under test talks only to the proxy, with a dummy key; no other credential is visible to it.
  process.env.ANTHROPIC_API_KEY = "ai-eval-local-proxy";
  process.env.ANTHROPIC_BASE_URL = proxy.url;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  // One turn at a time from one process: the per-minute burst limit would only slow the run down.
  process.env.AI_RATE_LIMIT_PER_MINUTE = "1000";
  const { coachTurn, buildAthleteContext } = await import("@/server/services/ai-coach");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const judgeClient = new Anthropic({ apiKey: "ai-eval-local-proxy", baseURL: proxy.url, maxRetries: 0 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const leftovers = await removeEvalMembers(admin);
  if (leftovers) log(`removed ${leftovers} evaluation accounts left from an earlier run`);
  const scenarios = SCENARIOS.filter((s) => !opt.only.length || opt.only.includes(s.id));
  const profileIds = [...new Set<ProfileId>([...scenarios.map((s) => s.profile), "decoy_other_member"])];
  const members = new Map<ProfileId, SeededMember>();
  for (const id of profileIds) members.set(id, await seedMember(admin, url, anon, PROFILES[id]));
  log(`seeded ${members.size} synthetic members on ${new URL(url).host}`);
  const { data: ex } = await admin.from("exercises").select("slug, equipment").eq("is_published", true);
  const catalog = new Map((ex ?? []).map((e) => [e.slug as string, e.equipment as string[]]));
  const context = new Map<ProfileId, string>();
  for (const [id, m] of members) context.set(id, (await buildAthleteContext(m.client, m.userId)).text);

  const records: TurnRecord[] = [];
  outer: for (const s of scenarios) {
    for (let run = 1; run <= opt.runs; run++) {
      const tag = `${s.id}#${run}`;
      const m = members.get(s.profile)!;
      if (proxy.stopped()) {
        records.push(blank(s, run, "not-run", `budget: ${proxy.stopped()}`));
        continue;
      }
      // Each turn is judged on its own: a fresh conversation, and this month's usage cleared so the production
      // routing (fast vs larger model) depends on the message, not on how many turns came before.
      await admin.from("ai_usage_events").delete().eq("user_id", m.userId);
      proxy.setTag(tag);
      const callsBefore = proxy.calls.length;
      const started = Date.now();
      let firstText: number | null = null;
      const tools: string[] = [];
      const replies: string[] = [];
      let conversationId: string | null = null;
      let proposal: Record<string, unknown> | null = null;
      let error: string | null = null;
      for (const message of s.messages) {
        try {
          const res = await coachTurn({
            supabase: m.client,
            userId: m.userId,
            plan: "pro",
            conversationId,
            message,
            mode: s.mode,
            onEvent: (e) => {
              if (e.type === "tool") tools.push(e.name);
              if (e.type === "text" && firstText === null) firstText = Date.now() - started;
            },
          });
          conversationId = res.conversationId;
          replies.push(res.assistantMessage.content);
          proposal = (res.assistantMessage.proposal as Record<string, unknown> | null) ?? proposal;
        } catch (err) {
          error = `${(err as { code?: string }).code ?? "error"}: ${(err as Error).message}`;
          break;
        }
      }
      const calls = proxy.calls.slice(callsBefore);
      const reply = replies.at(-1) ?? "";
      const checks = runChecks(s.checks, { reply, tools, proposal, error, sex: m.profile.sex, equipment: m.profile.onboarding.equipment, catalog, knownData: context.get(s.profile) ?? "" });
      records.push({
        scenario: s.id,
        run,
        profile: s.profile,
        mode: s.mode,
        status: error ? "error" : "done",
        reply,
        replies,
        tools,
        proposal,
        error,
        models: [...new Set(calls.map((c) => c.model))],
        checks,
        judge: null,
        ms: Date.now() - started,
        firstTextMs: firstText,
        calls,
        costUsd: calls.reduce((a, c) => a + c.costUsd, 0),
      });
      log(`${tag} ${error ? `ERROR ${error}` : "done"} · ${checks.filter((c) => c.verdict !== "PASS").map((c) => `${c.id}=${c.verdict}`).join(" ") || "all checks pass"}`);
      if (proxy.stopped()) {
        log(`STOPPED: ${proxy.stopped()}`);
        continue outer;
      }
    }
  }

  if (opt.judge) {
    for (const rec of records.filter((r) => r.status === "done")) {
      if (proxy.stopped()) break;
      const s = scenarios.find((x) => x.id === rec.scenario)!;
      const tag = `judge:${rec.scenario}#${rec.run}`;
      const before = proxy.calls.length;
      try {
        rec.judge = await judgeTurn({ client: judgeClient, model: opt.judgeModel, tag, scenario: s, profile: PROFILES[rec.profile], reply: rec.reply, tools: rec.tools, proposal: rec.proposal, checks: rec.checks });
      } catch (err) {
        log(`${tag} judge error: ${(err as Error).message}`);
      }
      rec.calls.push(...proxy.calls.slice(before));
    }
  }

  if (!opt.keep) log(`removed ${await removeEvalMembers(admin)} synthetic members`);
  await proxy.close();
  await stopMock?.();

  const meta = {
    mode: opt.mode,
    live: opt.mode === "live",
    note: opt.mode === "live" ? "Live model responses." : "SELF-TEST: every reply and score came from a scripted local stand-in. These are NOT evaluation results.",
    at: new Date().toISOString(),
    runs: opt.runs,
    scenarios: scenarios.length,
    judgeModel: opt.judge ? opt.judgeModel : null,
    limits: { maxUsd: opt.maxUsd, maxRequests: opt.maxRequests },
    spentUsd: proxy.spentUsd(),
    requests: proxy.calls.length,
    stopped: proxy.stopped(),
    pricing: PRICING_SOURCE,
  };
  writeFileSync(join(opt.out, "results.json"), JSON.stringify({ meta, records }, null, 2));
  writeFileSync(join(opt.out, "summary.md"), summarize(meta, scenarios, records));
  writeFileSync(join(opt.out, "transcripts.md"), transcripts(meta, scenarios, records));
  writeFileSync(join(opt.out, "review-sheet.csv"), reviewSheet(records));
  writeFileSync(join(opt.out, "run.log"), logLines.join("\n"));
  console.log(`\nWrote ${opt.out}/{summary.md,transcripts.md,results.json,review-sheet.csv}. Spent $${proxy.spentUsd().toFixed(4)} in ${proxy.calls.length} requests.${meta.live ? "" : " (SELF-TEST: not model output)"}`);
}

function blank(s: Scenario, run: number, status: TurnRecord["status"], error: string): TurnRecord {
  return { scenario: s.id, run, profile: s.profile, mode: s.mode, status, reply: "", replies: [], tools: [], proposal: null, error, models: [], checks: [], judge: null, ms: 0, firstTextMs: null, calls: [], costUsd: 0 };
}

// ------------------------------------------------------------------------------------------------------ reports

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = [...a].filter((x) => b.has(x)).length;
  return a.size + b.size - inter ? inter / (a.size + b.size - inter) : 1;
}

export function consistency(records: TurnRecord[]) {
  const out: string[] = [];
  for (const id of CONSISTENCY_SCENARIOS) {
    const plans = records.filter((r) => r.scenario === id && r.proposal && Array.isArray((r.proposal as { days?: unknown }).days));
    if (plans.length < 2) {
      out.push(`| ${id} | ${plans.length} valid plan(s) of ${records.filter((r) => r.scenario === id).length} | – | – | – |`);
      continue;
    }
    const days = plans.map((p) => (p.proposal as { days: unknown[] }).days.length);
    const sets = plans.map((p) => new Set((p.proposal as { days: { exercises: { exercise_slug: string }[] }[] }).days.flatMap((d) => d.exercises.map((e) => e.exercise_slug))));
    const volume = plans.map((p) => (p.proposal as { days: { exercises: { sets: number }[] }[] }).days.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.sets, 0), 0));
    const pairs: number[] = [];
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) pairs.push(jaccard(sets[i]!, sets[j]!));
    out.push(`| ${id} | ${plans.length} | days ${days.join(" / ")} | exercise overlap (Jaccard) ${pairs.map((x) => x.toFixed(2)).join(", ")} | weekly sets ${volume.join(" / ")} |`);
  }
  // Chat scenarios: do the three runs agree on every critical check?
  const byScenario = new Map<string, TurnRecord[]>();
  for (const r of records) byScenario.set(r.scenario, [...(byScenario.get(r.scenario) ?? []), r]);
  let agree = 0;
  let total = 0;
  for (const rs of byScenario.values()) {
    const done = rs.filter((r) => r.status === "done");
    if (done.length < 2) continue;
    total++;
    const sig = (r: TurnRecord) => r.checks.map((c) => `${c.id}:${c.verdict}`).join(",");
    if (done.every((r) => sig(r) === sig(done[0]!))) agree++;
  }
  return { planRows: out, agree, total };
}

function summarize(meta: Record<string, unknown>, scenarios: Scenario[], records: TurnRecord[]): string {
  const done = records.filter((r) => r.status === "done");
  const allChecks = done.flatMap((r) => r.checks);
  const fails = done.flatMap((r) => r.checks.filter((c) => c.verdict === "FAIL").map((c) => ({ r, c })));
  const reviews = done.flatMap((r) => r.checks.filter((c) => c.verdict === "REVIEW").map((c) => ({ r, c })));
  const judged = done.filter((r) => r.judge);
  const crit = Object.keys(CRITERIA) as Criterion[];
  const mean = (k: Criterion, rs = judged) => (rs.length ? (rs.reduce((a, r) => a + r.judge![k].score, 0) / rs.length).toFixed(2) : "–");
  const calls = records.flatMap((r) => r.calls);
  const coachCalls = calls.filter((c) => !c.tag.startsWith("judge:"));
  const cons = consistency(records);
  const lines: string[] = [
    `# AI coach evaluation — ${meta.mode === "live" ? "LIVE" : "SELF-TEST (not model output)"}`,
    "",
    `${meta.note}`,
    "",
    `Run at ${meta.at}. ${scenarios.length} scenarios × ${meta.runs} runs = ${records.length} turns; ${done.length} completed, ${records.filter((r) => r.status === "error").length} ended in an error, ${records.filter((r) => r.status === "not-run").length} not run.`,
    `Budget: $${Number(meta.spentUsd).toFixed(4)} of $${(meta.limits as { maxUsd: number }).maxUsd} in ${meta.requests} requests${meta.stopped ? ` — STOPPED: ${meta.stopped}` : ""}. Prices: ${meta.pricing}.`,
    "",
    "## Critical checks",
    "",
    `${allChecks.filter((c) => c.verdict === "PASS").length} pass, ${fails.length} fail, ${reviews.length} need a human decision (of ${allChecks.length}).`,
    "",
    "| Scenario | Title | Runs done | Checks failed | Checks to review |",
    "|---|---|---|---|---|",
    ...scenarios.map((s) => {
      const rs = records.filter((r) => r.scenario === s.id);
      const f = rs.flatMap((r) => r.checks.filter((c) => c.verdict === "FAIL").map((c) => `${c.id} (run ${r.run})`));
      const v = rs.flatMap((r) => r.checks.filter((c) => c.verdict === "REVIEW").map((c) => `${c.id} (run ${r.run})`));
      return `| ${s.id} | ${s.title} | ${rs.filter((r) => r.status === "done").length}/${rs.length} | ${f.join(", ") || "none"} | ${v.join(", ") || "none"} |`;
    }),
    "",
    ...(fails.length ? ["### Failures", "", ...fails.map(({ r, c }) => `- ${r.scenario}#${r.run} ${c.id}: ${CHECK_TITLES[c.id]} — ${c.detail}`), ""] : []),
    "## Rubric (judge model, 1–5)",
    "",
    judged.length ? `Judge: ${meta.judgeModel}; ${judged.length} turns scored. Scores are a first pass for human reviewers, not a substitute.` : "Not scored (no judge run).",
    "",
    "| Criterion | Mean |",
    "|---|---|",
    ...crit.map((k) => `| ${k} | ${mean(k)} |`),
    "",
    "## Consistency across runs",
    "",
    `Chat scenarios whose runs all reached the same check verdicts: ${cons.agree} of ${cons.total}.`,
    "",
    "| Plan scenario | Valid plans | Days | Exercise overlap | Weekly sets |",
    "|---|---|---|---|---|",
    ...cons.planRows,
    "",
    "## Latency and cost (coach requests only)",
    "",
    `Turn time: median ${(quantile(done.map((r) => r.ms), 0.5) / 1000).toFixed(1)} s, p95 ${(quantile(done.map((r) => r.ms), 0.95) / 1000).toFixed(1)} s. First text: median ${(quantile(done.map((r) => r.firstTextMs ?? 0).filter(Boolean), 0.5) / 1000).toFixed(1)} s.`,
    "",
    "| Model | Requests | Input | Cache read | Cache write | Output | Cost |",
    "|---|---|---|---|---|---|---|",
    ...[...new Set(coachCalls.map((c) => c.model))].map((m) => {
      const cs = coachCalls.filter((c) => c.model === m);
      const sum = (k: keyof MeteredCall["usage"]) => cs.reduce((a, c) => a + (c.usage[k] ?? 0), 0).toLocaleString();
      return `| ${m} | ${cs.length} | ${sum("input_tokens")} | ${sum("cache_read_input_tokens")} | ${sum("cache_creation_input_tokens")} | ${sum("output_tokens")} | $${cs.reduce((a, c) => a + c.costUsd, 0).toFixed(4)} |`;
    }),
    "",
    `Mean cost per coach turn: $${done.length ? (done.reduce((a, r) => a + r.calls.filter((c) => !c.tag.startsWith("judge:")).reduce((b, c) => b + c.costUsd, 0), 0) / done.length).toFixed(5) : "–"}. Turns that used the larger model: ${pct(done.filter((r) => r.models.some((m) => m.includes("sonnet"))).length, done.length)}.`,
  ];
  return lines.join("\n") + "\n";
}

function transcripts(meta: Record<string, unknown>, scenarios: Scenario[], records: TurnRecord[]): string {
  const out = [`# Transcripts — ${meta.live ? "LIVE" : "SELF-TEST (scripted, not model output)"}`, "", "Synthetic members only. Read with docs/ai-eval/HUMAN_REVIEW_SHEET.md.", ""];
  for (const s of scenarios) {
    out.push(`## ${s.id} — ${s.title}`, "", `Member: ${PROFILES[s.profile].label}. Mode: ${s.mode}.`, "", `What a good answer does: ${s.good}`, "");
    for (const r of records.filter((x) => x.scenario === s.id)) {
      out.push(`### Run ${r.run} (${r.status}${r.models.length ? `, ${r.models.join(" + ")}` : ""}, ${(r.ms / 1000).toFixed(1)} s)`, "");
      s.messages.forEach((m, i) => {
        out.push(`**Member:** ${m}`, "");
        if (r.replies[i] !== undefined) out.push(`**Coach:**`, "", r.replies[i]!, "");
      });
      if (r.error) out.push(`**Error:** ${r.error}`, "");
      if (r.tools.length) out.push(`Tools: ${r.tools.join(", ")}`, "");
      if (r.proposal) out.push("Suggested change card:", "", "```json", JSON.stringify(r.proposal, null, 2).slice(0, 4000), "```", "");
      out.push(`Checks: ${r.checks.map((c) => `${c.id} ${c.verdict}${c.detail ? ` (${c.detail})` : ""}`).join("; ") || "–"}`, "");
      if (r.judge) out.push(`Judge: ${(Object.keys(CRITERIA) as Criterion[]).map((k) => `${k} ${r.judge![k].score}`).join(", ")}${r.judge.critical_concerns.length ? ` — concerns: ${r.judge.critical_concerns.join("; ")}` : ""}`, "");
    }
  }
  return out.join("\n");
}

function reviewSheet(records: TurnRecord[]): string {
  const head = ["scenario", "run", "reviewer", ...Object.keys(CRITERIA), "critical_issue (yes/no)", "would_you_send_this_to_a_member (yes/no)", "comments"];
  const rows = records.filter((r) => r.status === "done").map((r) => [r.scenario, String(r.run), "", ...Object.keys(CRITERIA).map(() => ""), "", "", ""]);
  return [head, ...rows].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
}

if (process.argv[1]?.endsWith("run.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
