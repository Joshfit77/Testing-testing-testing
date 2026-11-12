/**
 * Meal-photo evaluation harness. Sends photos through the app's own food-photo code path (the same instructions,
 * answer schema, server-side image preparation, normalisation and USDA matching as production) and scores the
 * estimates against weighed ground truth. Writes a report to ai-eval-results/<run>-food-photo/ (git-ignored).
 *
 *   Estimate only, no network, no spend (cost per photo from the image size and the harness's recorded prices):
 *     npx tsx --conditions=react-server scripts/ai-eval/food-photo.ts --estimate
 *   Self-test against a local scripted stand-in (no model, nothing leaves the machine; NOT evaluation results):
 *     npx tsx --conditions=react-server scripts/ai-eval/food-photo.ts --self-test
 *   Live (spends money; key read from AI_EVAL_ANTHROPIC_API_KEY, never written anywhere):
 *     AI_EVAL_ANTHROPIC_API_KEY=… npx tsx --conditions=react-server scripts/ai-eval/food-photo.ts --live --confirm-spend --max-usd 1 --photos <dir>
 *
 * <dir>/manifest.json lists the photos and what was actually on the plate, weighed:
 *   [{ "file": "chicken-rice.jpg", "kind": "meal" | "not_food" | "blurry" | "packaged",
 *      "items": [{ "name": "chicken breast", "grams": 150 }], "kcal": 520, "protein_g": 48, "carbs_g": 50, "fat_g": 12 }]
 * Use photos you took and weighed yourself, or a dataset whose licence allows this use (check it first).
 * Every live request goes through the local budget proxy (budget-proxy.ts), which stops the run before --max-usd.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startBudgetProxy, type BudgetProxy } from "./budget-proxy";
import { startMockMessagesApi, type MockRequestBody } from "./mock-api";
import { PRICES, PRICING_SOURCE, worstCaseUsd } from "./pricing";

type Mode = "live" | "self-test" | "estimate";
interface TruthItem {
  name: string;
  grams?: number;
}
interface Case {
  file: string;
  kind: "meal" | "not_food" | "blurry" | "packaged";
  items?: TruthItem[];
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

const MODEL = "claude-haiku-5-5"; // the app's fast tier (coachModelIds in src/server/services/ai-coach.ts)
const MAX_TOKENS = 2_000; // as in src/server/services/food-photo.ts

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
    photos: val("--photos", ""),
    maxUsd: Number(val("--max-usd", "1")),
    maxRequests: Number(val("--max-requests", "200")),
    out: val("--out", join("ai-eval-results", `${new Date().toISOString().replace(/[:.]/g, "-")}-food-photo-${mode}`)),
  };
}

/** Image tokens as Anthropic documents them (about width × height / 750), for the estimate. */
export const imageTokens = (w: number, h: number) => Math.ceil((w * h) / 750);

/** Expected cost of one analysis: the photo, the instructions and schema (measured from the request), and the answer. */
export function photoCostUsd(opts: { width: number; height: number; textTokens: number; outputTokens: number }) {
  const p = PRICES[MODEL]!;
  return ((imageTokens(opts.width, opts.height) + opts.textTokens) * p.input + opts.outputTokens * p.output) / 1_000_000;
}

const pctErr = (est: number, truth: number) => (truth > 0 ? Math.abs(est - truth) / truth : est === 0 ? 0 : 1);
const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3));
/** An estimated item covers a true item when they share a food word ("grilled chicken" covers "chicken breast"). */
const covers = (est: string, truth: string) => [...tokens(truth)].some((w) => tokens(est).has(w));

export interface CaseResult {
  file: string;
  kind: Case["kind"];
  ok: boolean;
  error?: string;
  isFood?: boolean;
  photoQuality?: string;
  packaged?: boolean;
  items?: { name: string; grams: number | null; calories: number; matched: string | null; strong: boolean }[];
  kcal?: number;
  kcalErrPct?: number;
  itemRecall?: number;
  additivesNamed?: boolean;
  checks: Record<string, boolean>;
}

/** Score one answer against the manifest entry. */
export function scoreCase(c: Case, a: { isFood: boolean; photoQuality: string; packaged: boolean; items: { name: string; ingredients: string[]; grams: number | null; calories: number; match: { choice: { name: string }; strong: boolean } | null }[] }, namesAdditive: (s: string) => boolean): CaseResult {
  const kcal = a.items.reduce((s, i) => s + i.calories, 0);
  const truthItems = c.items ?? [];
  const found = truthItems.filter((t) => a.items.some((i) => covers(i.name, t.name))).length;
  const additivesNamed = a.items.some((i) => i.ingredients.some(namesAdditive));
  const checks: Record<string, boolean> = { "no additives named": !additivesNamed };
  if (c.kind === "not_food") checks["non-food recognised"] = !a.isFood;
  if (c.kind === "blurry") checks["poor photo flagged"] = a.photoQuality !== "clear";
  if (c.kind === "packaged") checks["packaged product flagged"] = a.packaged;
  if (c.kind === "meal" || c.kind === "packaged") checks["food recognised"] = a.isFood;
  return {
    file: c.file,
    kind: c.kind,
    ok: true,
    isFood: a.isFood,
    photoQuality: a.photoQuality,
    packaged: a.packaged,
    items: a.items.map((i) => ({ name: i.name, grams: i.grams, calories: i.calories, matched: i.match?.choice.name ?? null, strong: i.match?.strong ?? false })),
    kcal,
    kcalErrPct: c.kcal != null ? Math.round(pctErr(kcal, c.kcal) * 1000) / 10 : undefined,
    itemRecall: truthItems.length ? Math.round((found / truthItems.length) * 100) / 100 : undefined,
    additivesNamed,
    checks,
  };
}

/** Synthetic stand-in photos for the self-test (plain shapes: no model reads them, the stand-in answers by file). */
async function selfTestCases(dir: string): Promise<Case[]> {
  const sharp = (await import("sharp")).default;
  mkdirSync(dir, { recursive: true });
  const cases: Case[] = [
    { file: "plate.jpg", kind: "meal", items: [{ name: "chicken breast", grams: 150 }, { name: "white rice", grams: 160 }], kcal: 456, protein_g: 50, carbs_g: 45, fat_g: 6 },
    { file: "desk.jpg", kind: "not_food" },
    { file: "blurry.jpg", kind: "blurry", items: [{ name: "pasta", grams: 250 }], kcal: 395 },
    { file: "bar.jpg", kind: "packaged", items: [{ name: "protein bar", grams: 60 }], kcal: 216 },
  ];
  for (const [i, c] of cases.entries()) {
    // 4032 × 3024 (a phone camera's size) so the server-side resize is exercised.
    await sharp({ create: { width: 4032, height: 3024, channels: 3, background: { r: 40 + i * 40, g: 120, b: 80 } } }).jpeg().toFile(join(dir, c.file));
  }
  return cases;
}

/** What the scripted stand-in answers for each self-test photo (marked as scripted; never model output). */
function scriptedAnswer(index: number) {
  const item = (name: string, grams: number | null, calories: number, p: number, c: number, f: number, search_term: string, extra: string[] = []) => ({
    name,
    visible_ingredients: [name.toLowerCase(), ...extra],
    portion: grams ? `about ${grams} g` : "unclear",
    grams,
    calories,
    protein_g: p,
    carbs_g: c,
    fat_g: f,
    confidence: "medium",
    search_term,
  });
  const answers = [
    { is_food: true, photo_quality: "clear", packaged: false, summary: "SCRIPTED", items: [item("Grilled chicken breast", 150, 248, 46, 0, 5.4, "chicken breast"), item("White rice", 160, 208, 4.3, 45, 0.4, "rice", ["preservative E211"])], questions: [] },
    { is_food: false, photo_quality: "clear", packaged: false, summary: "SCRIPTED", items: [], questions: [] },
    { is_food: true, photo_quality: "blurry", packaged: false, summary: "SCRIPTED", items: [item("Pasta with tomato sauce", 250, 400, 13, 70, 7, "pasta")], questions: [] },
    { is_food: true, photo_quality: "clear", packaged: true, summary: "SCRIPTED", items: [item("Protein bar", 60, 220, 20, 22, 7, "protein bar")], questions: [] },
  ];
  return answers[index % answers.length]!;
}

async function main() {
  const opts = args();
  const { FOOD_PHOTO_INSTRUCTIONS, FOOD_PHOTO_MAX_DIMENSION, foodPhotoOutputSchema, namesAdditive, normalizeFoodPhoto } = await import("@/lib/domain/food-photo");
  const { matchToUsda } = await import("@/server/services/food-photo");
  const { prepareImageForAi } = await import("@/server/services/image-prep");
  const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const sharp = (await import("sharp")).default;

  // The request text the app sends besides the image (instructions + answer schema), measured once for the estimate.
  const schemaText = JSON.stringify(betaZodOutputFormat(foodPhotoOutputSchema));
  const textTokens = Math.ceil((FOOD_PHOTO_INSTRUCTIONS.length + schemaText.length + 60) / 3.5);
  const est = {
    model: MODEL,
    pricing: PRICING_SOURCE,
    textTokensApprox: textTokens,
    // A 1,024 × 768 photo (the app's maximum size for a 4:3 photo) with a typical and the largest allowed answer.
    typicalUsd: photoCostUsd({ width: 1024, height: 768, textTokens, outputTokens: 700 }),
    worstUsd: worstCaseUsd(MODEL, 1024 * 768 * 0.25 + (FOOD_PHOTO_INSTRUCTIONS.length + schemaText.length) * 1.5, MAX_TOKENS),
  };
  mkdirSync(opts.out, { recursive: true });
  if (opts.mode === "estimate") {
    writeFileSync(join(opts.out, "estimate.json"), JSON.stringify(est, null, 2));
    console.log(`Meal photo on ${MODEL}: about $${est.typicalUsd.toFixed(5)} each (typical answer), at most $${est.worstUsd.toFixed(5)} (whole answer allowance). Prices: ${PRICING_SOURCE}.`);
    console.log(`100 photos ≈ $${(est.typicalUsd * 100).toFixed(3)}; a member's 20-a-day cap ≈ $${(est.typicalUsd * 20).toFixed(4)} a day.`);
    return;
  }

  let cases: Case[];
  let dir: string;
  let baseURL: string;
  let apiKey: string;
  let proxy: BudgetProxy | null = null;
  let mock: Awaited<ReturnType<typeof startMockMessagesApi>> | null = null;
  if (opts.mode === "self-test") {
    dir = join(opts.out, "photos");
    cases = await selfTestCases(dir);
    mock = await startMockMessagesApi((_body: MockRequestBody, index: number) => ({
      blocks: [{ type: "text", text: JSON.stringify(scriptedAnswer(index)) }],
      usage: { input_tokens: 1_500, output_tokens: 600 },
    }));
    proxy = await startBudgetProxy({ upstream: mock.url, apiKey: "self-test", limits: { maxRequests: 20, maxUsd: 0.05 } });
    baseURL = proxy.url;
    apiKey = "self-test";
  } else {
    const key = process.env.AI_EVAL_ANTHROPIC_API_KEY;
    if (!key) throw new Error("Live mode needs AI_EVAL_ANTHROPIC_API_KEY (an evaluation key with its own spend limit).");
    if (!opts.confirmSpend) throw new Error("Live mode spends money: add --confirm-spend (and --max-usd).");
    if (!opts.photos || !existsSync(join(opts.photos, "manifest.json"))) throw new Error("Live mode needs --photos <dir> with a manifest.json of weighed meals.");
    dir = opts.photos;
    cases = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Case[];
    proxy = await startBudgetProxy({ upstream: "https://api.anthropic.com", apiKey: key, limits: { maxRequests: opts.maxRequests, maxUsd: opts.maxUsd } });
    baseURL = proxy.url;
    apiKey = "held-by-proxy";
  }

  const client = new Anthropic({ apiKey, baseURL, maxRetries: 0, timeout: 40_000 });
  const results: CaseResult[] = [];
  for (const c of cases) {
    try {
      const original = readFileSync(join(dir, c.file));
      const meta = await sharp(original).metadata();
      const prepared = await prepareImageForAi(new Uint8Array(original), "image/jpeg", FOOD_PHOTO_MAX_DIMENSION);
      const sentMeta = await sharp(Buffer.from(prepared.bytes)).metadata();
      const res = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: FOOD_PHOTO_INSTRUCTIONS }],
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: prepared.mediaType, data: Buffer.from(prepared.bytes).toString("base64") } }, { type: "text", text: "Estimate this meal." }] }],
        output_config: { format: betaZodOutputFormat(foodPhotoOutputSchema) },
      });
      if (!res.parsed_output) throw new Error(`no answer (stop: ${res.stop_reason})`);
      const analysis = normalizeFoodPhoto(res.parsed_output);
      const items = await matchToUsda(analysis.items);
      const scored = scoreCase(c, { ...analysis, items }, namesAdditive);
      scored.checks["sent at most 1,024 px, metadata removed"] = Math.max(sentMeta.width ?? 0, sentMeta.height ?? 0) <= FOOD_PHOTO_MAX_DIMENSION && !sentMeta.exif && (meta.width ?? 0) > 0;
      results.push(scored);
    } catch (err) {
      results.push({ file: c.file, kind: c.kind, ok: false, error: (err as Error).message.slice(0, 300), checks: {} });
    }
    if (proxy?.stopped()) break;
  }

  const meals = results.filter((r) => r.kcalErrPct != null);
  const summary = {
    mode: opts.mode,
    label: opts.mode === "self-test" ? "SELF-TEST against a scripted stand-in: these are NOT evaluation results" : "LIVE",
    model: MODEL,
    photos: results.length,
    errors: results.filter((r) => !r.ok).length,
    meanKcalErrPct: meals.length ? Math.round((meals.reduce((s, r) => s + r.kcalErrPct!, 0) / meals.length) * 10) / 10 : null,
    meanItemRecall: meals.length ? Math.round((meals.reduce((s, r) => s + (r.itemRecall ?? 0), 0) / meals.length) * 100) / 100 : null,
    checksPassed: results.reduce((s, r) => s + Object.values(r.checks).filter(Boolean).length, 0),
    checksTotal: results.reduce((s, r) => s + Object.keys(r.checks).length, 0),
    spentUsd: proxy?.spentUsd() ?? 0,
    stopped: proxy?.stopped() ?? null,
    estimate: est,
  };
  writeFileSync(join(opts.out, "results.json"), JSON.stringify({ summary, results }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  for (const r of results) console.log(`${r.ok ? "ok " : "ERR"} ${r.file} ${r.kind} ${r.error ?? ""} ${Object.entries(r.checks).map(([k, v]) => `${v ? "✓" : "✗"} ${k}`).join("; ")}`);
  await proxy?.close();
  await mock?.close();
}

if (process.argv[1]?.endsWith("food-photo.ts")) {
  main().catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
