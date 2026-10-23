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
    if (call?.name === "get_training_review") {
      const data = JSON.parse(String(toolResult.content)) as { consistency?: { sessionsLast28: number }; data_gaps?: string[] };
      // Held back like a real model's thinking time, so the "Reviewing…" activity line can be seen.
      return { delayMs: 1500, stop: "end_turn", blocks: [{ type: "text", text: `Review: ${data.consistency?.sessionsLast28 ?? "?"} sessions in 4 weeks. Gaps: ${data.data_gaps?.length ?? 0}.` }] };
    }
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
  if (text.includes("review my training")) {
    return { delayMs: 0, stop: "tool_use", blocks: [{ type: "tool_use", id: `toolu_e2e_${++seq}`, name: "get_training_review", input: {} }] };
  }
  if (text.includes("recovery week")) {
    return {
      delayMs: 0,
      stop: "tool_use",
      blocks: [{ type: "tool_use", id: `toolu_e2e_${++seq}`, name: "propose_deload_week", input: { keep_percent_of_sets: 60, rpe_cap: 7, reason: "You asked for a lighter week." } }],
    };
  }
  if (text.includes("remember")) {
    return {
      delayMs: 0,
      stop: "tool_use",
      blocks: [{ type: "tool_use", id: `toolu_e2e_${++seq}`, name: "propose_memory", input: { category: "schedule", content: text.includes("rowing") ? "Likes rowing for cardio." : "Trains at 6 am before work." } }],
    };
  }
  if (text.includes("forget")) {
    const ref = system.match(/\[(m-[0-9a-f]{8})\] Schedule:/)?.[1] ?? "m-00000000";
    return { delayMs: 0, stop: "tool_use", blocks: [{ type: "tool_use", id: `toolu_e2e_${++seq}`, name: "propose_forget_memory", input: { memory_ref: ref } }] };
  }
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

/** Non-streaming structured replies (messages.parse): an AI meal plan from the dish list the app sent. */
function structuredReply(req: MockRequest): Record<string, unknown> | null {
  const system = req.system.map((b) => b.text).join("\n");
  const user = String(typeof req.messages[0]?.content === "string" ? req.messages[0].content : "");
  if (system.includes("You explain a packaged food")) {
    return {
      summary: "At 160 kcal and 3 g protein per 40 g serving, this fits as a small pre-workout carb snack rather than a protein source.",
      fits: ["Quick carbohydrates (31 g per serving) before training"],
      watch_outs: ["12 g sugars per serving, a large share of the sugars in your day"],
      uncertainties: ["Added sugars aren't listed separately (not available)"],
    };
  }
  if (system.includes("You estimate the nutrition of a meal from one photo")) {
    const it = (name: string, portion: string, grams: number | null, calories: number, p: number, c: number, f: number, confidence: string, search_term: string) => ({
      name,
      visible_ingredients: [name.toLowerCase()],
      portion,
      grams,
      calories,
      protein_g: p,
      carbs_g: c,
      fat_g: f,
      confidence,
      search_term,
    });
    return {
      is_food: true,
      summary: "Grilled chicken with white rice and broccoli.",
      items: [
        it("Grilled chicken breast", "a palm-sized fillet", 150, 248, 46, 0, 5.4, "medium", "chicken breast"),
        it("White rice", "about 1 cup", 160, 208, 4.3, 45, 0.4, "medium", "rice"),
        // Calories that don't match the macros: the app must flag them for the member to check.
        it("Broccoli", "a handful", null, 600, 2.5, 6, 0.4, "low", "broccoli"),
      ],
      questions: [{ topic: "sauce", question: "Was there any sauce on the chicken?" }],
    };
  }
  if (!system.includes("You arrange meal plans")) return null;
  const days = Number(user.match(/Plan (\d+) day/)?.[1] ?? 1);
  const slots = [...user.matchAll(/(\d+): [^(;]+\((breakfast|lunch|dinner|snack),/g)].map((m) => ({ index: Number(m[1]), slot: m[2]! }));
  const dishes = user
    .split("\n")
    .filter((l) => /^(app|recipe|meal):/.test(l))
    .map((l) => {
      const [key, , meals] = l.split(" | ");
      return { key: key!, meals: (meals ?? "").split("/") };
    });
  const plan = Array.from({ length: days }, (_, day) => {
    const used = new Set<string>();
    return {
      day_index: day,
      meals: slots.map((s, i) => {
        // The first day's last meal names a dish that doesn't exist: the app must refill it.
        if (day === 0 && i === slots.length - 1) return { slot_index: s.index, dish_key: "app:not-a-real-dish", portion: 1 };
        const options = dishes.filter((d) => d.meals.includes(s.slot) && !used.has(d.key));
        const pick = options[day % Math.max(1, options.length)] ?? options[0];
        if (pick) used.add(pick.key);
        return { slot_index: s.index, dish_key: pick?.key ?? "app:none", portion: 1 };
      }),
    };
  });
  return { summary: "High-protein days built from your dishes.", days: plan, assumptions: ["Quick breakfasts means under ten minutes."] };
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
    if (!body.stream) {
      const structured = structuredReply(body);
      if (structured) {
        res.writeHead(200, { "Content-Type": "application/json", "request-id": `req_e2e_${++seq}` });
        res.end(
          JSON.stringify({
            id: `msg_e2e_${seq}`,
            type: "message",
            role: "assistant",
            model: body.model,
            content: [{ type: "text", text: JSON.stringify(structured) }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 900, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          }),
        );
        return;
      }
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
    await grantPlan(email, "pro");
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
    await grantPlan(email, "pro");
    await page.goto("/coach");

    // Nothing is sent to the AI provider until the user allows it.
    await expect(page.getByRole("heading", { name: /your data and the AI Coach/ })).toBeVisible();
    await expect(page.getByLabel("Message the AI coach")).toHaveCount(0);
    await page.getByRole("button", { name: "Allow and continue" }).click();

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
    await expect(page.getByText("1/150 messages this month")).toBeVisible();
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
    // Task-based routing: a "why has it stalled" review goes to the larger model, a simple swap to the fast one.
    const first = requests.find((r) => JSON.stringify(r.messages).includes("Why did my bench stall?"))!;
    expect(first.model).toBe("claude-sonnet-5-5");
    const swap = requests.find((r) => JSON.stringify(r.messages.at(-1)).includes("Please swap my first exercise today"))!;
    expect(swap.model).toBe("claude-haiku-5-5");
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
      "get_training_review",
      "propose_target_load",
      "propose_deload_week",
      "propose_volume_change",
      "propose_memory",
      "propose_forget_memory",
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
    await grantPlan(email, "pro");
    await page.goto("/coach");
    await page.getByRole("button", { name: "Allow and continue" }).click();
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

  test("coaching memory: off until turned on, saved only when approved, used in later chats, and forgettable", async ({ page }) => {
    test.skip(!MOCK_PORT, "set E2E_ANTHROPIC_MOCK_PORT and start the app with ANTHROPIC_BASE_URL pointing at it");
    const email = uniqueEmail("coach-memory");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    await page.goto("/coach");
    await page.getByRole("button", { name: "Allow and continue" }).click();
    const box = page.getByLabel("Message the AI coach");
    const systemOf = (needle: string) => requests.filter((r) => JSON.stringify(r.messages).includes(needle)).at(-1)!.system.map((b) => b.text).join("\n");
    // The box restores drafts as the page hydrates, which can clear text typed a moment too early: retype until it sticks.
    const sendMessage = async (text: string) => {
      await expect(async () => {
        await box.fill(text);
        await page.waitForTimeout(250);
        await expect(box).toHaveValue(text, { timeout: 500 });
      }).toPass({ timeout: 15_000 });
      await page.getByRole("button", { name: "Send message" }).click();
    };

    // Memory is off by default: the coach is told not to offer, and there's no per-chat switch.
    await sendMessage("Hello coach, memory check one");
    await expect(page.getByTestId("coach-reply").last()).toContainText("Happy to help", { timeout: 30_000 });
    expect(systemOf("memory check one")).toContain("Coaching memory: switched off by the athlete");
    await expect(page.getByLabel("Coach may suggest things to remember from this chat")).toHaveCount(0);

    // Turn it on and add a note by hand.
    await page.getByRole("link", { name: "Memory" }).first().click();
    await expect(page.getByRole("heading", { name: "Memory is off" })).toBeVisible();
    await page.getByRole("button", { name: "Turn memory on" }).click();
    await expect(page.getByRole("heading", { name: "Memory is on" })).toBeVisible();
    await page.getByLabel("Type").selectOption("coaching_style");
    await page.getByLabel("What should the coach remember?").fill("Wants short, direct answers.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("coach-memory").filter({ hasText: "Wants short, direct answers." })).toBeVisible();

    // The coach suggests a memory; the member edits it before saving.
    await page.goto("/coach");
    await expect(page.getByLabel("Coach may suggest things to remember from this chat")).toBeChecked();
    await sendMessage("Please remember I train at 6 am");
    const card = page.getByTestId("coach-suggestion").last();
    await expect(card.getByText("Remember this?")).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText("Trains at 6 am before work.")).toBeVisible();
    await card.getByRole("button", { name: "Edit" }).click();
    await card.getByLabel("Note").fill("Trains at 6:30 am before work.");
    await card.getByRole("button", { name: "Save to memory" }).click();
    await expect(card.getByRole("status")).toHaveText("Saved to your coaching memory.");
    await expect(card.getByText("saved", { exact: true })).toBeVisible();

    // Both notes reach the coach in a new conversation (another device would see the same).
    await page.goto("/coach");
    await sendMessage("Hello again, memory check two");
    await expect(page.getByTestId("coach-reply").last()).toContainText("Happy to help", { timeout: 30_000 });
    const sys = systemOf("memory check two");
    expect(sys).toContain("Trains at 6:30 am before work.");
    expect(sys).toContain("Wants short, direct answers.");
    expect(sys).not.toContain("Trains at 6 am before work.");

    // Asking the coach to forget something.
    await sendMessage("Please forget my training time");
    const forget = page.getByTestId("coach-suggestion").last();
    await expect(forget.getByText("Forget this memory?")).toBeVisible({ timeout: 30_000 });
    await forget.getByRole("button", { name: "Forget" }).click();
    await expect(forget.getByRole("status")).toHaveText("Forgotten.");
    await page.goto("/coach/memory");
    await expect(page.getByTestId("coach-memory")).toHaveCount(1);
    await expect(page.getByText("Trains at 6:30 am before work.")).toHaveCount(0);

    // A change the member confirms is noted (with memory on), so the coach knows later what changed and why.
    await page.goto("/coach");
    await sendMessage("Please swap my first exercise today");
    const swap = page.getByTestId("coach-suggestion").last();
    await expect(swap.getByText("Suggested exercise swap")).toBeVisible({ timeout: 30_000 });
    await swap.getByRole("button", { name: "Confirm" }).click();
    await expect(swap.getByRole("status")).toContainText("Swapped");
    await page.goto("/coach/memory");
    await expect(page.getByTestId("coach-memory").filter({ hasText: /approved swapping .+ for .+ \(next session\)/ })).toContainText("a change you confirmed");

    // "Don't remember anything from this chat": the coach's suggestion is refused on the server, so no card.
    await page.goto("/coach");
    const chatMemory = page.getByLabel("Coach may suggest things to remember from this chat");
    await expect(async () => {
      await chatMemory.uncheck();
      await page.waitForTimeout(250);
      await expect(chatMemory).not.toBeChecked({ timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await sendMessage("Please remember I like rowing");
    await expect(page.getByTestId("coach-reply").last()).toContainText("suggested change", { timeout: 30_000 });
    await expect(page.getByText("Remember this?")).toHaveCount(0);
    expect(systemOf("Please remember I like rowing")).toContain("not to remember anything from THIS chat");
    await page.waitForURL(/\/coach\?c=/);
    await page.reload();
    await expect(page.getByLabel("Coach may suggest things to remember from this chat")).not.toBeChecked();

    // Delete one, then the rest, and switch memory off.
    await page.goto("/coach/memory");
    await page.getByRole("button", { name: /^Delete memory: Wants short/ }).click();
    await expect(page.getByTestId("coach-memory")).toHaveCount(1);
    await page.getByRole("button", { name: "Delete all" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete all" }).click();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
    await page.getByRole("button", { name: "Turn memory off" }).click();
    await expect(page.getByRole("heading", { name: "Memory is off" })).toBeVisible();
  });

  test("adaptive coaching: reads the training review and applies an approved recovery week that can be undone", async ({ page }) => {
    test.skip(!MOCK_PORT, "set E2E_ANTHROPIC_MOCK_PORT and start the app with ANTHROPIC_BASE_URL pointing at it");
    const email = uniqueEmail("coach-adaptive");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    await page.goto("/coach");
    await page.getByRole("button", { name: "Allow and continue" }).click();
    const box = page.getByLabel("Message the AI coach");
    const sendMessage = async (text: string) => {
      await expect(async () => {
        await box.fill(text);
        await page.waitForTimeout(250);
        await expect(box).toHaveValue(text, { timeout: 500 });
      }).toPass({ timeout: 15_000 });
      await page.getByRole("button", { name: "Send message" }).click();
    };

    await sendMessage("Can you review my training?");
    await expect(page.getByTestId("coach-activity").getByText("Reviewing your recent training…")).toBeVisible();
    await expect(page.getByTestId("coach-reply").last()).toContainText("Review: 0 sessions in 4 weeks.", { timeout: 30_000 });

    await sendMessage("I'd like a recovery week please");
    const card = page.getByTestId("coach-suggestion").last();
    await expect(card.getByText("Suggested training change")).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText(/as a recovery week: 60% of the sets, up to RPE 7/)).toBeVisible();
    await card.getByRole("button", { name: "Modify" }).click();
    await card.getByLabel("Keep % of sets").fill("50");
    await card.getByRole("button", { name: "Apply my version" }).click();
    await expect(card.getByRole("status")).toContainText("is now a recovery week: 50% of the sets");
    await page.goto("/train/review");
    const change = page.getByTestId("training-adjustment").first();
    await expect(change).toContainText("recovery week");
    await expect(change).toContainText("from the AI coach");
    await change.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("status")).toContainText("Undone:");
  });

  test("AI meal plan: drafts from the member's dishes, the app computes the numbers, nothing saved until approved; ingredients can be replaced", async ({ page }) => {
    test.skip(!MOCK_PORT, "set E2E_ANTHROPIC_MOCK_PORT and start the app with ANTHROPIC_BASE_URL pointing at it");
    const email = uniqueEmail("ai-meals");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    await page.goto("/coach");
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await expect(page.getByLabel("Message the AI coach")).toBeVisible();

    await page.goto("/nutrition/planner");
    const panel = page.getByRole("region", { name: "AI meal plan" });
    await panel.getByLabel("Days").selectOption("3");
    await panel.getByLabel("Focus").selectOption("high_protein");
    await panel.getByLabel("Notes (optional)").fill("quick breakfasts");
    await panel.getByRole("button", { name: "Draft my plan" }).click();
    await expect(panel.getByRole("status")).toContainText("Draft ready. 1 meal was filled or adjusted by the regular planner.", { timeout: 30_000 });
    const draft = panel.getByTestId("ai-plan-draft");
    await expect(draft.getByTestId("ai-plan-day")).toHaveCount(3);
    await expect(draft.getByText("(filled by the planner)")).toHaveCount(1);
    await expect(draft.getByText(/g per kg of bodyweight/)).toBeVisible();
    await expect(draft.getByText("Assumed: Quick breakfasts means under ten minutes.")).toBeVisible();
    await expect(draft.getByText("Not saved yet")).toBeVisible();
    // Nothing is a plan yet.
    await expect(page.getByTestId("plan-day")).toHaveCount(0);

    // What went to the (mock) AI: the dish list and targets, on the fast model, as one structured request.
    const sent = requests.find((r) => r.system.some((b) => b.text.includes("You arrange meal plans")))!;
    expect(sent.model).toBe("claude-haiku-5-5");
    const userText = String(sent.messages[0]!.content);
    expect(userText).toContain("Focus: High protein.");
    expect(userText).toContain("Member's notes: quick breakfasts");
    expect(userText).toMatch(/app:[a-z0-9-]+ \| .+ \| (breakfast|lunch|dinner|snack)/);

    await draft.getByRole("button", { name: "Approve & save plan" }).click();
    await expect(page.getByTestId("plan-day")).toHaveCount(3, { timeout: 30_000 });
    await expect(page.getByTestId("ai-plan-draft")).toHaveCount(0);

    // Replace an ingredient in the first planned meal with a food from the database.
    const meal = page.getByTestId("plan-meal").first();
    const before = await meal.getByTestId("plan-meal-name").innerText();
    await meal.getByRole("button", { name: /^Replace an ingredient in/ }).click();
    await page.getByRole("dialog").getByRole("button").first().click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("e.g. chicken, rice, olive oil").fill("banana");
    await picker.getByRole("region", { name: "Food database results" }).getByRole("button").first().click();
    await picker.getByRole("button", { name: "Use this instead" }).click();
    await expect(meal.getByRole("status")).toContainText(/Replaced .+ with .+\. Saved as your recipe/, { timeout: 30_000 });
    await expect(page.getByTestId("plan-meal").first().getByTestId("plan-meal-name")).not.toHaveText(before);
    await expect(page.getByTestId("plan-meal").first()).toContainText("Your recipe");
  });
  test("meal photos: Pro only, separate consent, an estimate to correct and confirm, then the diary", async ({ page }) => {
    test.skip(!MOCK_PORT, "set E2E_ANTHROPIC_MOCK_PORT and start the app with ANTHROPIC_BASE_URL pointing at it");
    test.setTimeout(150_000);
    const email = uniqueEmail("meal-photo");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/nutrition");
    await page.getByRole("navigation", { name: "Food tools" }).getByRole("link", { name: "Meal photo" }).click();
    await expect(page.getByText("Included with Pro")).toBeVisible();

    await grantPlan(email, "pro");
    await page.reload();
    // The general AI consent first, then a separate one for photos.
    await page.getByRole("button", { name: "Allow and continue" }).click();
    const consent = page.getByTestId("food-photo-consent");
    await expect(consent).toContainText("doesn't store the photo");
    await expect(consent.getByRole("button", { name: "Agree and continue" })).toBeDisabled();
    await consent.getByRole("checkbox").check();
    await consent.getByRole("button", { name: "Agree and continue" }).click();

    await page.getByLabel("Choose a meal photo").setInputFiles("public/icons/icon-512.png");
    await expect(page.getByTestId("food-photo-preview")).toBeVisible();
    await page.getByLabel("Meal", { exact: true }).selectOption("lunch");
    await page.getByLabel(/Anything the photo can't show/).fill("no dressing");
    await page.getByTestId("food-photo-analyze").click();
    await expect(page.getByTestId("food-photo-estimate-note")).toContainText("Estimated from a photo, not measured", { timeout: 30_000 });

    // What went to the (mock) AI: one image, on the fast model, with the member's note.
    const sent = requests.filter((r) => r.system.some((b) => b.text.includes("You estimate the nutrition of a meal from one photo"))).at(-1)!;
    expect(sent.model).toBe("claude-haiku-5-5");
    const content = sent.messages[0]!.content as { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[];
    expect(content[0]!).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg" } });
    expect(content[0]!.source!.data.length).toBeGreaterThan(1000);
    expect(content[1]!.text).toContain("no dressing");

    // Questions about what a photo can't show, including oil and portions the app always adds.
    const questions = page.getByTestId("food-photo-questions");
    await expect(questions).toContainText("Was there any sauce on the chicken?");
    await expect(questions).toContainText("cooked in oil or butter");
    await expect(questions).toContainText("hard to judge");

    const items = page.getByTestId("food-photo-item");
    await expect(items).toHaveCount(3);
    const broccoli = items.nth(2);
    await expect(broccoli).toContainText("Low confidence");
    await expect(broccoli.getByRole("note")).toContainText("don't match the macros");
    await broccoli.getByLabel("kcal").fill("35");
    await expect(broccoli.getByRole("note")).toHaveCount(0);

    // Add the oil it was cooked in, from the food database.
    await questions.getByRole("button", { name: "Olive oil, 1 tbsp" }).click();
    await expect(items).toHaveCount(4);
    await expect(items.nth(3)).toContainText("Database values");
    await expect(items.nth(3)).toContainText("119 kcal");

    // Swap the rice estimate for a database food.
    await items.nth(1).getByRole("button", { name: "Use a database food instead" }).click();
    const picker = page.getByRole("dialog");
    await expect(picker.getByPlaceholder("e.g. chicken, rice, olive oil")).toHaveValue("rice");
    await picker.getByRole("region", { name: "Food database results" }).getByRole("button").first().click();
    await picker.getByRole("button", { name: "Use this food" }).click();
    await expect(items.nth(1)).toContainText("Database values");
    await expect(items.nth(1).getByRole("button", { name: "Back to the photo estimate for White rice" })).toBeVisible();

    await page.getByTestId("food-photo-confirm").click();
    await expect(page.getByTestId("food-photo-done")).toContainText("Added 4 items to lunch.");
    await page.getByRole("link", { name: "Go to my diary" }).click();
    // Photo estimates are marked as estimates; the matched foods keep their database values.
    await expect(page.getByRole("button", { name: "Edit Grilled chicken breast" })).toContainText("a palm-sized fillet (estimated from a photo) · 248 kcal");
    await expect(page.getByRole("button", { name: "Edit Broccoli" })).toContainText("35 kcal");
    await expect(page.getByRole("button", { name: "Edit Olive oil" })).toContainText("13.5 g · 119 kcal");
    await expect(page.getByRole("button", { name: /^Edit White rice/ })).toContainText("USDA");
    await expect(page.getByText("Includes estimated entries")).toBeVisible();
  });
  test("food quality: Pro gets an AI explanation for their goals from the product's known data only", async ({ page }) => {
    test.skip(!MOCK_PORT || !process.env.E2E_OFF_MOCK_PORT, "needs the mock Anthropic and Open Food Facts servers");
    const email = uniqueEmail("quality-pro");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    await page.goto("/coach");
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await expect(page.getByLabel("Message the AI coach")).toBeVisible();

    await page.goto("/nutrition/product/5000000000012");
    const explain = page.getByTestId("product-explain");
    await explain.getByRole("button", { name: "Explain for my goals" }).click();
    const out = page.getByTestId("product-explanation");
    await expect(out).toContainText("based only on the data shown", { timeout: 30_000 });
    await expect(out).toContainText("fits as a small pre-workout carb snack");
    await expect(out).toContainText("Added sugars aren't listed separately");

    const sent = requests.filter((r) => r.system.some((b) => b.text.includes("You explain a packaged food"))).at(-1)!;
    expect(sent.model).toBe("claude-haiku-5-5");
    const text = String(sent.messages[0]!.content);
    expect(text).toContain("Product: Honey Crunch (Morning Co)");
    expect(text).toContain("Nutri-Score: D");
    expect(text).toContain("added sugars (g): not available");
    expect(text).toContain("Daily targets:");
  });
});
