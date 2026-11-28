/**
 * Live evaluation of Biblical AI on the evaluation set (tests/biblical-ai-eval/questions.ts), with the app's own
 * retrieval, instructions and checks, and no database. It calls the AI provider, so it costs money and needs a key:
 *
 *   ANTHROPIC_API_KEY=… npx tsx --conditions=react-server scripts/eval/run-biblical-ai-eval.ts [--limit 20] [--model claude-haiku-5-5] [--topic Gospel]
 *
 * Writes docs/biblical-ai/eval-results/<date>-<model>.json and .md: for each question, the checks before and after
 * the one corrective retry, how many expected passages the answer cited, any `avoid` phrases found, and the answer for
 * a qualified human reviewer. Automatic scores never replace that review.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ANSWER_TOOL, rawAnswerSchema, validateAnswer, type ValidatedAnswer } from "@/lib/biblical-ai/answer";
import { BIBLICAL_AI_SYSTEM, buildUserMessage, correctionMessage } from "@/lib/biblical-ai/prompt";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { costMicros, tokenUsage } from "@/lib/domain/ai-economics";
import { passageText } from "@/server/bible/text";
import { retrieveScripture, verseHasStrong } from "@/server/services/biblical-ai-retrieval";
import { EVAL_QUESTIONS } from "../../tests/biblical-ai-eval/questions";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const model = arg("model") ?? "claude-haiku-5-5";
const limit = Number(arg("limit") ?? EVAL_QUESTIONS.length);
const topic = arg("topic");
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. This script calls the AI provider (it costs money); run it only with approval.");
  process.exit(1);
}
const client = new Anthropic();
const norm = (r: string) => {
  const ref = parseReference(r.replace(/^Psalms?\b/, "Psalm"));
  return ref ? formatReference(ref) : r;
};

interface Row {
  id: string;
  topic: string;
  question: string;
  firstPassFailures: string[];
  finalFailures: string[];
  expectedCited: number;
  expected: number;
  avoidHits: string[];
  limitations: string[];
  costMicros: number;
  answer: ValidatedAnswer | null;
}

async function main() {
  const set = EVAL_QUESTIONS.filter((q) => !topic || q.topic === topic).slice(0, limit);
  const rows: Row[] = [];
  for (const q of set) {
    const r = retrieveScripture(q.question, { depth: q.depth, category: q.category });
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserMessage({ question: q.question, depth: q.depth, category: q.category, passages: r.passages, crossReferences: r.crossReferences, words: r.words, documents: [] }) }];
    let first: string[] = [];
    let final: ReturnType<typeof validateAnswer> | null = null;
    let cost = 0;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const msg = await client.messages.create({ model, max_tokens: q.depth === "deep" ? 3600 : q.depth === "standard" ? 1800 : 900, system: BIBLICAL_AI_SYSTEM, tools: [ANSWER_TOOL], tool_choice: { type: "tool", name: ANSWER_TOOL.name }, messages });
      cost += costMicros(model, tokenUsage(msg.usage));
      const block = msg.content.find((b) => b.type === "tool_use");
      const raw = rawAnswerSchema.safeParse(block && block.type === "tool_use" ? block.input : null);
      if (!raw.success || !block) break;
      final = validateAnswer(raw.data, { passageText, verseHasStrong, documents: new Map(), retrieved: r.references }, q.depth);
      if (attempt === 1) first = final.failures;
      if (!final.failures.length || attempt === 2) break;
      messages.push({ role: "assistant", content: msg.content }, { role: "user", content: [{ type: "tool_result", tool_use_id: block.id, is_error: true, content: correctionMessage(final.failures) }] });
    }
    const cited = new Set(final?.answer.scripture.map((s) => s.reference) ?? []);
    const text = JSON.stringify(final?.answer ?? {}).toLowerCase();
    rows.push({
      id: q.id,
      topic: q.topic,
      question: q.question,
      firstPassFailures: first,
      finalFailures: final?.failures ?? ["no structured answer"],
      expectedCited: q.refs.filter((x) => cited.has(norm(x))).length,
      expected: q.refs.length,
      avoidHits: (q.avoid ?? []).filter((a) => text.includes(a.toLowerCase())),
      limitations: final?.answer.limitations ?? [],
      costMicros: cost,
      answer: final?.answer ?? null,
    });
    process.stdout.write(`${q.id}: first-pass failures ${first.length}, expected passages cited ${rows.at(-1)!.expectedCited}/${q.refs.length}\n`);
  }
  const summary = {
    model,
    questions: rows.length,
    passedFirstTime: rows.filter((r) => !r.firstPassFailures.length).length,
    passedAfterRetry: rows.filter((r) => !r.finalFailures.length).length,
    expectedPassageCoverage: rows.reduce((a, r) => a + r.expectedCited, 0) / Math.max(1, rows.reduce((a, r) => a + r.expected, 0)),
    avoidHits: rows.filter((r) => r.avoidHits.length).map((r) => r.id),
    costUsd: rows.reduce((a, r) => a + r.costMicros, 0) / 1e6,
  };
  const dir = path.join("docs", "biblical-ai", "eval-results");
  mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `${new Date().toISOString().slice(0, 10)}-${model}`);
  writeFileSync(`${base}.json`, JSON.stringify({ summary, rows }, null, 1));
  writeFileSync(
    `${base}.md`,
    [`# Biblical AI evaluation: ${model}`, "", "Automatic checks only; every answer still needs qualified human theological review.", "", "```json", JSON.stringify(summary, null, 1), "```", "", ...rows.map((r) => `## ${r.id}\n\n**Q:** ${r.question}\n\n${r.answer?.answer ?? "(no answer)"}\n\nPassages: ${r.answer?.scripture.map((s) => s.reference).join(", ") ?? ""}\n\nChecks: first pass ${r.firstPassFailures.length}, final ${r.finalFailures.length}; avoid hits: ${r.avoidHits.join(", ") || "none"}\n`)].join("\n"),
  );
  console.log(JSON.stringify(summary, null, 1));
}

void main();
