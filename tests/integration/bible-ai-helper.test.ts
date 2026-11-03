import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The Bible study helper's whole server path against the real database, with a local stand-in for the AI API:
 * quota reserved, passages retrieved, answer checked, history saved (both turns), usage metered, limits enforced.
 */
const available = await stackAvailable();
const svc = serviceClient();
let mock: Server;
const requests: { system: string; messages: { role: string; content: string }[] }[] = [];

describe.skipIf(!available)("Bible study helper (server path)", () => {
  let user: TestUser;
  let askBible: typeof import("@/server/services/bible-ai").askBible;
  beforeAll(async () => {
    mock = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        requests.push(JSON.parse(body));
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            id: "msg_it",
            type: "message",
            role: "assistant",
            model: "claude-haiku-5-5",
            content: [{ type: "text", text: "John 3:16 speaks of God's love. See also Psalm 151:2." }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 800, output_tokens: 40 },
          }),
        );
      });
    });
    await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));
    const port = (mock.address() as { port: number }).port;
    process.env.ANTHROPIC_API_KEY = "integration-test-key";
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
    ({ askBible } = await import("@/server/services/bible-ai"));
    user = await createTestUser("bible-ai");
  });
  afterAll(async () => {
    await deleteTestUser(user);
    await new Promise((r) => mock.close(r));
  });

  it("answers from retrieved BSB passages, marks references that don't exist, and saves both turns", async () => {
    const thread = crypto.randomUUID();
    const r = await askBible(user.id, "free", "What does John 3:16 mean?", thread);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answer).toBe("John 3:16 speaks of God's love. See also Psalm 151:2 [reference not found in the BSB].");
    expect(r.citations.map((c) => c.reference)).toEqual(["John 3:16"]);
    expect(r.citations[0]!.text).toMatch(/^For God so loved the world/);
    expect(requests.at(-1)!.messages.at(-1)!.content).toContain("John 3:16: For God so loved the world");
    const { data: rows } = await svc.from("bible_ai_messages").select("role, content, citations").eq("thread_id", thread).order("created_at");
    expect(rows).toEqual([
      { role: "user", content: "What does John 3:16 mean?", citations: [] },
      { role: "assistant", content: r.answer, citations: ["John 3:16"] },
    ]);
    const { data: usage } = await svc.from("bible_ai_usage").select("status, input_tokens, output_tokens").eq("user_id", user.id);
    expect(usage).toEqual([{ status: "done", input_tokens: 800, output_tokens: 40 }]);
  });

  it("sends the conversation so far, and stops at the per-minute limit with a clear message", async () => {
    const thread = crypto.randomUUID();
    expect((await askBible(user.id, "free", "Who wrote Romans?", thread)).ok).toBe(true);
    expect((await askBible(user.id, "free", "And to whom?", thread)).ok).toBe(true);
    // The second question went with the first turn as history.
    expect(requests.at(-1)!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    // Three in the last minute (free plan's per-minute limit).
    const limited = await askBible(user.id, "free", "One more?", thread);
    expect(limited).toMatchObject({ ok: false, code: "rate_limited" });
  });
});
