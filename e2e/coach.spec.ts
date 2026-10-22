import { createServer, type IncomingMessage, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * AI coach end to end, without a real API key and without ever calling the real API.
 *
 * With E2E_ANTHROPIC_MOCK_PORT set, the app server must be started with
 *   ANTHROPIC_API_KEY=e2e-test-key ANTHROPIC_BASE_URL=http://127.0.0.1:<port>
 * so the Anthropic SDK's standard base-URL setting points at the local mock below, which speaks the
 * Messages API streaming (SSE) format, including tool use. Without it, the test checks the honest
 * "not configured" state instead.
 */
const MOCK_PORT = Number(process.env.E2E_ANTHROPIC_MOCK_PORT ?? 0);

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
interface MockRequest {
  model: string;
  system: { type: string; text: string; cache_control?: unknown }[];
  messages: { role: string; content: string | { type: string; [k: string]: unknown }[] }[];
  tools: { name: string; strict?: boolean }[];
  stream?: boolean;
}

const requests: MockRequest[] = [];
/** While set, messages containing "flaky" get this HTTP error from the mock API (429 rate limit / 500). */
let failMode: 429 | 500 | null = null;
let mock: Server | null = null;
let seq = 0;

function sseEvents(model: string, blocks: Block[], stopReason: string) {
  const events: Record<string, unknown>[] = [
    {
      type: "message_start",
      message: { id: `msg_e2e_${++seq}`, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    },
  ];
  blocks.forEach((b, index) => {
    if (b.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      for (const chunk of b.text.match(/[\s\S]{1,24}/g) ?? []) events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: chunk } });
    } else {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
      const json = JSON.stringify(b.input);
      const mid = Math.floor(json.length / 2);
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(0, mid) } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(mid) } });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 80 } });
  events.push({ type: "message_stop" });
  return events;
}

function reply(req: MockRequest): { blocks: Block[]; stop: string; delayMs: number } {
  const last = req.messages.at(-1)!;
  const toolResult = Array.isArray(last.content) ? last.content.find((c) => c.type === "tool_result") : undefined;
  if (toolResult) {
    const prev = req.messages.at(-2)!;
    const call = (prev.content as { type: string; id?: string; name?: string }[]).find((c) => c.type === "tool_use" && c.id === toolResult.tool_use_id);
    if (call?.name === "get_exercise_history") {
      const data = JSON.parse(String(toolResult.content)) as { sessions_found?: number; error?: string };
      return {
        delayMs: 1500,
        stop: "end_turn",
        blocks: [
          {
            type: "text",
            text: `**Here's your bench plan.** I checked ${data.sessions_found ?? 0} logged bench sessions.\n\n| Week | Bench |\n|---|---|\n| 1 | 3×5 @ RPE 7 |\n| 2 | 3×3 @ RPE 8 |\n\n- Sleep 7–9 hours\n- Eat at maintenance for two weeks`,
          },
        ],
      };
    }
    return { delayMs: 0, stop: "end_turn", blocks: [{ type: "text", text: "I've put a suggested change below — tap **Confirm** if you want it." }] };
  }
  const text = String(typeof last.content === "string" ? last.content : "").toLowerCase();
  const system = req.system.map((b) => b.text).join("\n");
  if (text.includes("swap")) {
    const from = system.match(/← next: [^[]*\[([a-z0-9-]+)\]/)?.[1] ?? "back-squat";
    return {
      delayMs: 0,
      stop: "tool_use",
      blocks: [
        { type: "tool_use", id: `toolu_e2e_${++seq}`, name: "propose_exercise_swap", input: { from_exercise_slug: from, to_exercise_slug: from === "push-up" ? "goblet-squat" : "push-up", scope: "next_workout", reason: "A joint-friendly option for today." } },
      ],
    };
  }
  if (text.includes("targets")) {
    return {
      delayMs: 0,
      stop: "tool_use",
      blocks: [{ type: "tool_use", id: `toolu_e2e_${++seq}`, name: "propose_nutrition_targets", input: { calories: 2400, protein_g: 180, carbs_g: 260, fat_g: 70, reason: "Fuel your training while you build strength." } }],
    };
  }
  if (text.includes("bench")) {
    return {
      delayMs: 0,
      stop: "tool_use",
      blocks: [
        { type: "text", text: "Let me look at your bench history." },
        { type: "tool_use", id: `toolu_e2e_${++seq}`, name: "get_exercise_history", input: { exercise: "bench-press", sessions: 6 } },
      ],
    };
  }
  return { delayMs: 0, stop: "end_turn", blocks: [{ type: "text", text: "Happy to help with your training." }] };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

test.beforeAll(async () => {
  if (!MOCK_PORT) return;
  mock = createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.statusCode = 404;
      res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "mock: not found" } }));
      return;
    }
    const body = JSON.parse(await readBody(req)) as MockRequest;
    requests.push(body);
    if (failMode && JSON.stringify(body.messages).includes("flaky")) {
      const type = failMode === 429 ? "rate_limit_error" : "api_error";
      // retry-after-ms keeps the SDK's automatic retries fast.
      res.writeHead(failMode, { "Content-Type": "application/json", "retry-after-ms": "10", "request-id": `req_e2e_fail_${++seq}` });
      res.end(JSON.stringify({ type: "error", error: { type, message: `mock ${failMode}` } }));
      return;
    }
    const r = reply(body);
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "request-id": `req_e2e_${seq}` });
    const events = sseEvents(body.model, r.blocks, r.stop);
    if (r.delayMs) {
      // Send the start, wait (so the UI shows tool activity), then the rest.
      res.write(`event: message_start\ndata: ${JSON.stringify(events[0])}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, r.delayMs));
      events.shift();
    }
    for (const e of events) res.write(`event: ${e.type as string}\ndata: ${JSON.stringify(e)}\n\n`);
    res.end();
  });
  await new Promise<void>((resolve) => mock!.listen(MOCK_PORT, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (mock ? mock.close(() => resolve()) : resolve()));
});

test.describe("AI coach", () => {
  test("says honestly when the coach isn't configured", async ({ page }) => {
    test.skip(Boolean(MOCK_PORT), "the app under test was started with a (mock) AI provider");
    const email = uniqueEmail("coach-off");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/coach");
    await expect(page.getByText(/isn't configured on this server/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  test("streams a tool-using answer, persists history and applies a confirmed swap", async ({ page, context }) => {
    test.skip(!MOCK_PORT, "set E2E_ANTHROPIC_MOCK_PORT and start the app with ANTHROPIC_BASE_URL pointing at it");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const email = uniqueEmail("coach");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/coach");

    // Starter questions are built from the user's data (new user with a starter program).
    const starters = page.getByLabel("Suggested questions");
    await expect(starters.getByRole("button", { name: "Plan my deload" })).toBeVisible();
    await expect(starters.getByRole("button", { name: /What should I eat before today's .+ workout\?/ })).toBeVisible();

    // A tool-using answer: activity indicator, then markdown (table + list).
    await page.getByLabel("Message the AI coach").fill("Why did my bench stall?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByTestId("coach-activity").getByText("Checking your last 6 bench press sessions…")).toBeVisible();
    const reply = page.getByTestId("coach-reply").last();
    await expect(reply.getByRole("table")).toBeVisible({ timeout: 30_000 });
    await expect(reply.getByRole("cell", { name: "3×5 @ RPE 7" })).toBeVisible();
    await expect(reply.getByText("Here's your bench plan.")).toBeVisible();
    await expect(reply).toContainText("I checked 0 logged bench sessions.");
    await expect(page.getByText("1/60 messages this month")).toBeVisible();
    await reply.getByRole("button", { name: "Copy reply" }).click();
    await expect(reply.getByRole("button", { name: "Copied" })).toBeVisible();

    // History is persisted per user: reload the conversation.
    await page.waitForURL(/\/coach\?c=/);
    await page.reload();
    await expect(page.locator("p", { hasText: "Why did my bench stall?" })).toBeVisible();
    await expect(page.getByText("History (1)")).toBeVisible();
    await expect(page.getByTestId("coach-reply").last().getByRole("table")).toBeVisible();

    // A proposed change is NOT applied until the user confirms it.
    await page.getByLabel("Message the AI coach").fill("Please swap my first exercise today");
    await page.getByRole("button", { name: "Send message" }).click();
    const card = page.getByTestId("coach-suggestion").last();
    await expect(card.getByText("Suggested exercise swap")).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText("Next session only")).toBeVisible();
    await page.goto("/home");
    await expect(page.getByText(/^Push-Up ·/)).toHaveCount(0);
    await page.goBack();
    const card2 = page.getByTestId("coach-suggestion").last();
    await card2.getByRole("button", { name: "Confirm" }).click();
    await expect(card2.getByRole("status")).toContainText(/Swapped .+ for Push-Up in your next session\./);
    await expect(card2.getByText("applied", { exact: true })).toBeVisible();
    // Home no longer lists exercises (Stage 1 redesign): the swap shows when the next session starts.
    await page.goto("/home");
    await page.getByRole("link", { name: /Start workout/ }).click();
    await page.waitForURL(/\/train\/workout/);
    await expect(page.getByText("Push-Up", { exact: true }).first()).toBeVisible();

    // Nutrition targets: dismissing leaves targets unchanged.
    await page.goto("/coach");
    await page.getByLabel("Message the AI coach").fill("Can you set new nutrition targets?");
    await page.getByRole("button", { name: "Send message" }).click();
    const nCard = page.getByTestId("coach-suggestion").last();
    await expect(nCard.getByText("Suggested nutrition targets")).toBeVisible({ timeout: 30_000 });
    await expect(nCard.getByText("2400")).toBeVisible();
    // The chat smooth-scrolls to the newest reply; tap once the scrolling has settled.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let last = -1;
          let still = 0;
          const tick = () => {
            const y = window.scrollY;
            still = y === last ? still + 1 : 0;
            last = y;
            if (still >= 5) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    await nCard.getByRole("button", { name: "Not now" }).click();
    await expect(nCard.getByText("dismissed", { exact: true })).toBeVisible();
    await expect(nCard.getByRole("button", { name: "Confirm" })).toHaveCount(0);

    // What the server sent to the (mock) API.
    const first = requests.find((r) => JSON.stringify(r.messages).includes("Why did my bench stall?"))!;
    expect(first.model).toBe("claude-sonnet-5-5");
    expect(first.stream).toBe(true);
    expect(first.tools.map((t) => t.name)).toEqual([
      "get_recent_workouts",
      "get_exercise_history",
      "get_nutrition_summary",
      "get_program_week",
      "search_exercises",
      "get_food_nutrition",
      "calculate",
      "propose_exercise_swap",
      "propose_nutrition_targets",
      "propose_bodyweight_log",
    ]);
    expect(first.tools.every((t) => t.strict === true)).toBe(true);
    expect(first.system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(first.system[0]!.text).toContain("Narrow Gate Fitness coach");
    expect(first.system.at(-1)!.text).toContain("Athlete context");
    expect(first.system.map((s) => s.text).join("\n")).not.toContain("Galatians 6:9");
  });

  test("a rate limit or service failure keeps the unsent message, survives a reload and offers retry", async ({ page }) => {
    test.skip(!MOCK_PORT, "set E2E_ANTHROPIC_MOCK_PORT and start the app with ANTHROPIC_BASE_URL pointing at it");
    const email = uniqueEmail("coach-fail");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/coach");
    const box = page.getByLabel("Message the AI coach");
    const question = "A flaky question about squat depth";

    // 429 from the AI service: friendly error, the message goes back in the box, Try again offered.
    failMode = 429;
    await box.fill(question);
    await page.getByRole("button", { name: "Send message" }).click();
    const alert = page.getByRole("alert").filter({ hasText: /busy|try again/i });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText("Your message is still in the box below.");
    await expect(box).toHaveValue(question);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    // Reopen the app: the unsent message is still there.
    await page.waitForTimeout(600);
    await page.reload();
    await expect(box).toHaveValue(question);
    await expect(page.getByTestId("draft-restored")).toBeVisible();

    // 500 from the AI service: same graceful handling.
    failMode = 500;
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /try again/i })).toBeVisible({ timeout: 30_000 });
    await expect(box).toHaveValue(question);

    // The service recovers: Try again sends the same message once, and the draft is gone afterwards.
    failMode = null;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("coach-reply").last()).toContainText("Happy to help with your training.", { timeout: 30_000 });
    await expect(page.locator("p", { hasText: question })).toHaveCount(1);
    await expect(box).toHaveValue("");
    await page.waitForURL(/\/coach\?c=/);
    await page.reload();
    await expect(box).toHaveValue("");
    await expect(page.locator("p", { hasText: question })).toHaveCount(1);
  });
});
