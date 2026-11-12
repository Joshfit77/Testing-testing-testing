/**
 * Monthly AI cost per Pro member, modelled from the app's real prompt sizes (measured), its routing and limits
 * (src/lib/coach/routing.ts, src/lib/domain/plans.ts), and verified list prices (pricing.ts). Output-token counts and
 * tool rounds are ASSUMPTIONS until a live run measures them: pass a live run's results.json to use measured
 * per-turn costs instead.
 *
 *   npx tsx scripts/ai-eval/cost-model.ts                      (modelled)
 *   npx tsx scripts/ai-eval/cost-model.ts ai-eval-results/<run>/results.json   (measured per-turn costs)
 */
import { readFileSync } from "node:fs";
import { costUsd } from "./pricing";

const TOK = (chars: number) => Math.round(chars / 3.1); // 5.5-generation tokenizer: ~30% more tokens than 4 chars/token

/** Measured 2026-11-02 on this branch (scripts/ai-eval: estimate + a seeded synthetic member). */
export const MEASURED = {
  cachedPrefixTokens: TOK(38_292) + TOK(14_818), // static prompt + tool definitions, shared by every member
  faithBlockTokens: TOK(7_945), // cached too, for members with the faith section on
  contextTokens: { new: TOK(424), typical: TOK(3_246), rich: TOK(5_601) },
  planCatalogTokens: TOK(11_866), // plan mode: the exercise catalog, sent uncached after the member's context
};

/** Assumptions (replace with measured values after a live run). */
export const ASSUME = {
  historyTokens: 1_200, // earlier turns re-sent with a typical question (cap: 24,000 chars ≈ 7,700 tokens)
  roundsPerTurn: 1.5, // one tool round on about half of the questions
  outputPerRound: { fast: 900, smart: 1_600 }, // visible reply + adaptive thinking at effort "medium"
  planOutput: 6_000, // structured plan JSON + thinking
  toolResultTokens: 1_500,
};

type Tier = "fast" | "smart";
const MODEL: Record<Tier, string> = { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" };

/** One chat turn. `warm`: the shared prefix is already cached (steady traffic); otherwise the first round writes it. */
export function chatTurnCost(tier: Tier, warm: boolean, ctx = MEASURED.contextTokens.typical): number {
  const model = MODEL[tier];
  const out = ASSUME.outputPerRound[tier];
  const r1 = costUsd(model, {
    [warm ? "cache_read_input_tokens" : "cache_creation_input_tokens"]: MEASURED.cachedPrefixTokens,
    input_tokens: ctx + ASSUME.historyTokens + 60,
    output_tokens: out,
  });
  const r2 = costUsd(model, {
    cache_read_input_tokens: MEASURED.cachedPrefixTokens,
    input_tokens: ctx + ASSUME.historyTokens + 60 + out + ASSUME.toolResultTokens,
    output_tokens: out,
  });
  return r1 + (ASSUME.roundsPerTurn - 1) * r2;
}

export function planCost(warm: boolean, ctx = MEASURED.contextTokens.typical): number {
  return costUsd(MODEL.smart, {
    [warm ? "cache_read_input_tokens" : "cache_creation_input_tokens"]: MEASURED.cachedPrefixTokens - TOK(14_818), // no tools in plan mode
    input_tokens: ctx + MEASURED.planCatalogTokens + 400,
    output_tokens: ASSUME.planOutput,
  });
}

/** The most one request can cost within the app's own limits: 6 rounds, every one at its 12,000-token output cap. */
export function worstChatRequest(tier: Tier): number {
  let total = 0;
  for (let round = 0; round < 6; round++) {
    total += costUsd(MODEL[tier], {
      cache_read_input_tokens: MEASURED.cachedPrefixTokens,
      input_tokens: MEASURED.contextTokens.rich + 7_700 + round * (12_000 + 2_000),
      output_tokens: 12_000,
    });
  }
  return total;
}

export function monthly(usage: { fast: number; smartChat: number; plans: number }, warm: boolean, perTurn?: { fast: number; smart: number; plan: number }) {
  const f = perTurn?.fast ?? chatTurnCost("fast", warm);
  const s = perTurn?.smart ?? chatTurnCost("smart", warm);
  const p = perTurn?.plan ?? planCost(warm);
  return usage.fast * f + usage.smartChat * s + usage.plans * p;
}

const PROFILES = {
  light: { fast: 18, smartChat: 1, plans: 1 },
  typical: { fast: 54, smartChat: 4, plans: 2 },
  heavy: { fast: 135, smartChat: 10, plans: 5 }, // the Pro limits: 150 requests, 15 on the larger model, of which plans
};

function main() {
  const file = process.argv[2];
  let measured: { fast: number; smart: number; plan: number } | undefined;
  if (file) {
    const { meta, records } = JSON.parse(readFileSync(file, "utf8")) as { meta: { live: boolean }; records: { mode: string; status: string; models: string[]; calls: { tag: string; costUsd: number }[] }[] };
    if (!meta.live) throw new Error("That run is a self-test: its costs are scripted, not measured.");
    const avg = (rs: typeof records) => (rs.length ? rs.reduce((a, r) => a + r.calls.filter((c) => !c.tag.startsWith("judge:")).reduce((b, c) => b + c.costUsd, 0), 0) / rs.length : 0);
    const done = records.filter((r) => r.status === "done");
    measured = {
      fast: avg(done.filter((r) => r.mode === "chat" && !r.models.some((m) => m.includes("sonnet")))),
      smart: avg(done.filter((r) => r.mode === "chat" && r.models.some((m) => m.includes("sonnet")))),
      plan: avg(done.filter((r) => r.mode === "plan")),
    };
  }
  const $ = (n: number) => `$${n.toFixed(n < 0.01 ? 4 : 2)}`;
  console.log(`Source: ${measured ? `measured per-turn costs from ${file}` : "modelled (assumptions in scripts/ai-eval/cost-model.ts)"}\n`);
  console.log("| Per request | Cold cache | Warm cache |\n|---|---|---|");
  console.log(`| Chat, fast (Haiku 5.5) | ${$(chatTurnCost("fast", false))} | ${$(chatTurnCost("fast", true))} |`);
  console.log(`| Chat, larger (Sonnet 5.5) | ${$(chatTurnCost("smart", false))} | ${$(chatTurnCost("smart", true))} |`);
  console.log(`| Plan (Sonnet 5.5) | ${$(planCost(false))} | ${$(planCost(true))} |`);
  console.log(`\n| Member per month | Requests | Cold cache | Warm cache |\n|---|---|---|---|`);
  for (const [name, u] of Object.entries(PROFILES)) {
    console.log(`| ${name} | ${u.fast} fast + ${u.smartChat} larger + ${u.plans} plans | ${$(monthly(u, false, measured))} | ${$(monthly(u, true, measured))} |`);
  }
  const worst = PROFILES.heavy.fast * worstChatRequest("fast") + PROFILES.heavy.smartChat * worstChatRequest("smart") + PROFILES.heavy.plans * costUsd(MODEL.smart, { input_tokens: 20_000, output_tokens: 16_000 });
  console.log(`\nWorst case one member can cause within today's limits (every request at 6 rounds × 12,000 output tokens): ${$(worstChatRequest("fast"))} per fast request, ${$(worstChatRequest("smart"))} per larger-model request, ${$(worst)} per month.`);
  console.log(`Fleet: 100 typical members ≈ ${$(100 * monthly(PROFILES.typical, false, measured))}/month (cold) – ${$(100 * monthly(PROFILES.typical, true, measured))} (warm); 1,000 ≈ ${$(1000 * monthly(PROFILES.typical, false, measured))} – ${$(1000 * monthly(PROFILES.typical, true, measured))}.`);
}

if (process.argv[1]?.endsWith("cost-model.ts")) main();
