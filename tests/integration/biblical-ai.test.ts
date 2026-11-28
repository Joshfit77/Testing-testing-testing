import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, grantPlan, makeAdmin, serviceClient, snapshotAiBudgets, stackAvailable, type TestUser } from "./helpers";

/**
 * Narrow Gate Biblical AI against the real database, with a local stand-in for the AI API: the flag and consent gates,
 * the full answer path (retrieval, forced tool call, checks, one corrective retry, saving, metering), idempotent
 * retries, Free and Pro limits, conversation ownership, study plans, and the database's own protections (RLS, admin
 * and founder checks).
 */
const available = await stackAvailable();
const svc = serviceClient();
let mock: Server;
type Req = { model: string; system: { text: string; cache_control?: unknown }[]; tools: { name: string }[]; tool_choice: { type: string; name: string }; messages: { role: string; content: unknown }[] };
const requests: Req[] = [];
/** Tool inputs the stand-in returns, in order (the last one repeats). */
let queue: Record<string, unknown>[] = [];

const GOOD = { title: "God's love", answer: "God loved the world and gave His Son (John 3:16).", scripture: [{ reference: "John 3:16", quote: "For God so loved the world" }], application: "Trust Him." };

function reply(tool: string, input: Record<string, unknown>) {
  return {
    id: `msg_${requests.length}`,
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "tool_use", id: `toolu_${requests.length}`, name: tool, input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 1500, output_tokens: 300 },
  };
}

async function setFlag(on: boolean) {
  await svc.from("feature_flags").update({ enabled: on }).eq("key", "biblical_ai");
}

describe.skipIf(!available)("Narrow Gate Biblical AI (server path)", () => {
  let pro: TestUser;
  let free: TestUser;
  let other: TestUser;
  let svcMod: typeof import("@/server/services/biblical-ai");
  let restoreBudgets: () => Promise<void>;

  beforeAll(async () => {
    restoreBudgets = await snapshotAiBudgets();
    mock = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body) as Req;
        requests.push(parsed);
        const input = queue.length > 1 ? queue.shift()! : (queue[0] ?? GOOD);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(reply(parsed.tool_choice?.name ?? "submit_study", input)));
      });
    });
    await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));
    // Many questions run within a minute here; the per-minute limits have their own test below.
    process.env.BIBLICAL_AI_PRO_PER_MINUTE = "100";
    process.env.BIBLICAL_AI_FREE_PER_MINUTE = "100";
    process.env.AI_RATE_LIMIT_PER_MINUTE = "100";
    process.env.ANTHROPIC_API_KEY = "integration-test-key";
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;
    svcMod = await import("@/server/services/biblical-ai");
    [pro, free, other] = await Promise.all([createTestUser("bai-pro"), createTestUser("bai-free"), createTestUser("bai-other")]);
    await grantPlan(pro, "pro");
    const now = new Date().toISOString();
    await svc.from("profiles").update({ ai_data_consent_at: now }).in("id", [pro.id, free.id]);
  });
  afterAll(async () => {
    await setFlag(false);
    await Promise.all([deleteTestUser(pro), deleteTestUser(free), deleteTestUser(other)]);
    await restoreBudgets();
    await new Promise((r) => mock.close(r));
  });
  beforeEach(() => {
    queue = [GOOD];
  });

  const ask = (user: TestUser, plan: "free" | "pro", over: Partial<Parameters<typeof svcMod.askBiblicalAi>[0]> = {}) =>
    svcMod.askBiblicalAi({ userId: user.id, plan, question: "What does John 3:16 mean?", depth: "standard", category: "scripture", requestId: crypto.randomUUID(), ...over });

  it("is off by default: the flag row exists and is false, and nothing is sent", async () => {
    const { data } = await svc.from("feature_flags").select("enabled").eq("key", "biblical_ai").single();
    expect(data!.enabled).toBe(false);
    const before = requests.length;
    expect(await ask(pro, "pro")).toMatchObject({ ok: false, code: "unavailable" });
    expect(requests.length).toBe(before);
  });

  it("waits for the member's AI data-sharing consent", async () => {
    await setFlag(true);
    expect(await ask(other, "free")).toMatchObject({ ok: false, code: "consent_required" });
  });

  it("answers from retrieved BSB passages through a forced tool call, checks it, saves both turns and meters it", async () => {
    await setFlag(true);
    const requestId = crypto.randomUUID();
    const r = await ask(pro, "pro", { requestId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sent = requests.at(-1)!;
    expect(sent.tool_choice).toEqual({ type: "tool", name: "submit_study" });
    expect(sent.system[0]!.text).toMatch(/Scripture is the final authority/);
    expect(sent.system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(JSON.stringify(sent.messages.at(-1)!.content)).toContain("John 3:16: For God so loved the world");
    expect(r.answer.scripture).toEqual([{ reference: "John 3:16", quote: "For God so loved the world", note: null }]);
    expect(r.passages[0]!.text).toMatch(/^For God so loved the world/);
    expect(r.answer.limitations).toEqual([]);
    const { data: msgs } = await svc.from("biblical_ai_messages").select("role, content, request_id, depth").eq("conversation_id", r.conversationId).order("created_at");
    expect(msgs!.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs![0]).toMatchObject({ content: "What does John 3:16 mean?", request_id: requestId, depth: "standard" });
    const { data: convo } = await svc.from("biblical_ai_conversations").select("title, category, user_id").eq("id", r.conversationId).single();
    expect(convo).toEqual({ title: "God's love", category: "scripture", user_id: pro.id });
    const { data: usage } = await svc.from("bible_ai_usage").select("status, feature, depth, validation_failures, latency_ms").eq("user_id", pro.id).order("created_at", { ascending: false }).limit(1).single();
    expect(usage).toMatchObject({ status: "done", feature: "biblical_ai", depth: "standard", validation_failures: 0 });
    const { data: event } = await svc.from("ai_usage_events").select("kind, cost_micros").eq("user_id", pro.id).order("created_at", { ascending: false }).limit(1).single();
    expect(event!.kind).toBe("bible_study");
    expect(Number(event!.cost_micros)).toBeGreaterThan(0);
  });

  it("a retried request id returns the saved answer: nothing is asked or counted twice", async () => {
    await setFlag(true);
    const requestId = crypto.randomUUID();
    const first = await ask(pro, "pro", { requestId });
    expect(first.ok).toBe(true);
    const calls = requests.length;
    const { count: before } = await svc.from("bible_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    const again = await ask(pro, "pro", { requestId });
    expect(again).toMatchObject({ ok: true, replayed: true, messageId: first.ok ? first.messageId : "" });
    expect(requests.length).toBe(calls);
    const { count: after } = await svc.from("bible_ai_usage").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    expect(after).toBe(before);
  });

  it("asks once more with the failures listed, and keeps the corrected answer", async () => {
    await setFlag(true);
    queue = [{ ...GOOD, scripture: [{ reference: "John 3:16", quote: "For God so loved the world, that he gave his only begotten Son" }] }, GOOD];
    const calls = requests.length;
    const r = await ask(pro, "pro");
    expect(r.ok).toBe(true);
    expect(requests.length).toBe(calls + 2);
    const retry = requests.at(-1)!.messages;
    expect(retry.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(JSON.stringify(retry.at(-1)!.content)).toMatch(/is not the BSB wording of John 3:16/);
    if (r.ok) expect(r.answer.limitations).toEqual([]);
    const { data: usage } = await svc.from("bible_ai_usage").select("validation_failures").eq("user_id", pro.id).order("created_at", { ascending: false }).limit(1).single();
    expect(usage!.validation_failures).toBeGreaterThanOrEqual(1);
  });

  it("when the retry still fails, removes what failed and says so (never shows an unverified quotation or attribution)", async () => {
    await setFlag(true);
    const bad = { ...GOOD, answer: 'John MacArthur teaches that "God helps those who help themselves." See John 3:16 and Hezekiah 3:5.', scripture: [{ reference: "John 3:16", quote: "whosoever believeth in him" }] };
    queue = [bad, bad];
    const r = await ask(pro, "pro");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answer.answer).not.toMatch(/MacArthur/);
    expect(r.answer.answer).not.toMatch(/God helps those who help themselves/);
    expect(r.answer.answer).toContain("Hezekiah 3:5 [reference not found in the BSB]");
    expect(r.answer.scripture[0]!.quote).toBeNull();
    expect(r.answer.limitations.length).toBeGreaterThan(0);
  });

  it("falls back to verified passages when no answer passes, instead of showing an unchecked one", async () => {
    await setFlag(true);
    queue = [{ answer: "No idea.", scripture: [{ reference: "Opinions 1:1" }] }];
    const r = await ask(pro, "pro", { question: "What does the Bible say about forgiveness?" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answer.limitations.join(" ")).toMatch(/didn't pass the accuracy checks/);
    expect(r.answer.scripture.length).toBeGreaterThan(0);
    expect(r.passages.every((p) => p.text.length > 0)).toBe(true);
  });

  it("continues a conversation with its history; another member's conversation can't be continued", async () => {
    await setFlag(true);
    const first = await ask(pro, "pro");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await ask(pro, "pro", { conversationId: first.conversationId, question: "And verse 17?" });
    expect(second).toMatchObject({ ok: true, conversationId: first.conversationId });
    expect(requests.at(-1)!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(await ask(free, "free", { conversationId: first.conversationId })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("Free: quick and standard only, three questions a day; legacy Plus gets the Free allowance", async () => {
    await setFlag(true);
    expect(await ask(free, "free", { depth: "deep" })).toMatchObject({ ok: false, code: "not_entitled" });
    expect(await ask(free, "plus", { depth: "deep" })).toMatchObject({ ok: false, code: "not_entitled" });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await ask(free, "free", { question: `Free question ${i}: what does John 3:16 mean?` }));
    expect(results.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(results[3]).toMatchObject({ ok: false, code: "quota" });
    // Free requests go on the fast model.
    expect(requests.at(-1)!.model).toMatch(/haiku/);
  });

  it("the per-minute limit stops a burst with a clear message", async () => {
    await setFlag(true);
    process.env.BIBLICAL_AI_PRO_PER_MINUTE = "2";
    const burst = await createTestUser("bai-burst");
    try {
      await grantPlan(burst, "pro");
      await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString() }).eq("id", burst.id);
      const results = [];
      for (let i = 0; i < 3; i++) results.push(await ask(burst, "pro", { question: `Burst ${i}: what does John 3:16 mean?` }));
      expect(results.slice(0, 2).every((r) => r.ok)).toBe(true);
      expect(results[2]).toMatchObject({ ok: false, code: "rate_limited" });
    } finally {
      process.env.BIBLICAL_AI_PRO_PER_MINUTE = "100";
      await deleteTestUser(burst);
    }
  });

  it("refuses invalid input before anything is counted", async () => {
    await setFlag(true);
    expect(await ask(pro, "pro", { question: "?" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await ask(pro, "pro", { passage: "Hezekiah 3:5" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await ask(pro, "pro", { category: "astrology" as never })).toMatchObject({ ok: false, code: "invalid" });
  });

  it("generates, checks and saves a personalized study (Pro), and refuses it on Free", async () => {
    await setFlag(true);
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: d, title: `Day ${d}`, readings: [d % 2 ? "Romans 3:21-26" : "Ephesians 2:1-10"], explanation: "Grace explained.", questions: ["What is grace?"] }));
    queue = [{ title: "Grace", objective: "Understand grace.", days: days.slice(0, 5) }, { title: "Grace", objective: "Understand grace.", days }];
    const requestId = crypto.randomUUID();
    const r = await svcMod.generateStudyPlan({ userId: pro.id, plan: "pro", topic: "Understanding the Gospel", days: 7, requestId });
    expect(r).toMatchObject({ ok: true, replayed: false });
    if (!r.ok) return;
    expect(r.study.days).toHaveLength(7);
    expect(JSON.stringify(requests.at(-1)!.messages.at(-1)!.content)).toMatch(/has 5 days; it must have exactly 7/);
    expect(await svcMod.generateStudyPlan({ userId: pro.id, plan: "pro", topic: "Understanding the Gospel", days: 7, requestId })).toMatchObject({ ok: true, replayed: true, studyId: r.studyId });
    expect(await svcMod.generateStudyPlan({ userId: free.id, plan: "free", topic: "Prayer", days: 7, requestId: crypto.randomUUID() })).toMatchObject({ ok: false, code: "not_entitled" });
    expect(await svcMod.generateStudyPlan({ userId: pro.id, plan: "pro", topic: "Prayer", days: 8, requestId: crypto.randomUUID() })).toMatchObject({ ok: false, code: "invalid" });
  });

  it("RLS: members read and delete only their own rows and can't write any directly", async () => {
    await setFlag(true);
    const mine = await ask(pro, "pro");
    expect(mine.ok).toBe(true);
    if (!mine.ok) return;
    // Another member sees none of it.
    for (const t of ["biblical_ai_conversations", "biblical_ai_messages", "biblical_ai_saved_studies", "biblical_ai_feedback"]) {
      const { data } = await other.client.from(t).select("*").eq("user_id", pro.id);
      expect(data ?? [], t).toEqual([]);
    }
    // Nobody writes directly, not even their own rows.
    const ins = await pro.client.from("biblical_ai_conversations").insert({ user_id: pro.id, title: "x", category: "scripture" });
    expect(ins.error).not.toBeNull();
    const upd = await pro.client.from("biblical_ai_messages").update({ content: "tampered" }).eq("conversation_id", mine.conversationId).select("id");
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const fb = await pro.client.from("biblical_ai_feedback").insert({ user_id: pro.id, kind: "helpful" });
    expect(fb.error).not.toBeNull();
    // Another member's delete does nothing; the owner's delete removes the conversation and its messages.
    await other.client.from("biblical_ai_conversations").delete().eq("id", mine.conversationId);
    expect((await svc.from("biblical_ai_conversations").select("id").eq("id", mine.conversationId)).data).toHaveLength(1);
    await pro.client.from("biblical_ai_conversations").delete().eq("id", mine.conversationId);
    expect((await svc.from("biblical_ai_messages").select("id").eq("conversation_id", mine.conversationId)).data).toEqual([]);
    // Anonymous visitors see nothing; members can't read the source inventory, documents or audit trail.
    expect((await anonClient().from("biblical_ai_messages").select("id")).data ?? []).toEqual([]);
    for (const t of ["biblical_ai_sources", "biblical_ai_source_documents", "biblical_ai_source_audit"]) {
      const { data, error } = await pro.client.from(t).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, t).toBe(true);
    }
  });

  it("admin metrics are for administrators only; source status changes are server-only and teacher approval needs a founder", async () => {
    expect((await pro.client.rpc("biblical_ai_admin_metrics", { p_days: 30 })).error).not.toBeNull();
    expect((await pro.client.rpc("biblical_ai_set_source_status", { p_slug: "bsb", p_status: "disabled", p_reason: "x", p_founder: true, p_actor: pro.id })).error).not.toBeNull();
    const admin = await createTestUser("bai-admin");
    try {
      await makeAdmin(admin);
      const m = await admin.client.rpc("biblical_ai_admin_metrics", { p_days: 30 });
      expect(m.error).toBeNull();
      expect(m.data).toMatchObject({ questions: expect.any(Number), reports_open: expect.any(Number) });
      expect(JSON.stringify(m.data)).not.toMatch(/John 3:16|user_id|@example/);
      const refused = await svc.rpc("biblical_ai_set_source_status", { p_slug: "john-piper", p_status: "approved", p_reason: "test", p_founder: false, p_actor: admin.id });
      expect(refused.error?.message).toMatch(/founder approval required/);
      const ok = await svc.rpc("biblical_ai_set_source_status", { p_slug: "john-piper", p_status: "approved", p_reason: "test", p_founder: true, p_actor: admin.id });
      expect(ok.error).toBeNull();
      const { data: audit } = await svc.from("biblical_ai_source_audit").select("old_status, new_status, changed_by").eq("source_slug", "john-piper").order("changed_at", { ascending: false }).limit(1).single();
      expect(audit).toEqual({ old_status: "pending_review", new_status: "approved", changed_by: admin.id });
    } finally {
      await svc.from("biblical_ai_sources").update({ status: "pending_review" }).eq("slug", "john-piper");
      await deleteTestUser(admin);
    }
  });

  it("the source inventory holds exactly the eleven approved teachers, all pending review, with no documents loaded", async () => {
    const { data } = await svc.from("biblical_ai_sources").select("slug, status").eq("kind", "teacher").order("slug");
    expect(data!.map((s) => s.slug)).toEqual(["alistair-begg", "billy-graham", "frank-turk", "jeff-durbin", "john-macarthur", "john-piper", "mark-spence", "paul-washer", "ray-comfort", "tim-conway", "voddie-baucham"]);
    expect(data!.every((s) => s.status === "pending_review")).toBe(true);
    const { count } = await svc.from("biblical_ai_source_documents").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("deleting the account deletes every Biblical AI row", async () => {
    await setFlag(true);
    const temp = await createTestUser("bai-temp");
    await grantPlan(temp, "pro");
    await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString() }).eq("id", temp.id);
    const r = await ask(temp, "pro");
    expect(r.ok).toBe(true);
    await deleteTestUser(temp);
    for (const t of ["biblical_ai_conversations", "biblical_ai_messages", "biblical_ai_saved_studies", "biblical_ai_feedback", "bible_ai_usage"]) {
      const { data } = await svc.from(t).select("user_id").eq("user_id", temp.id);
      expect(data ?? [], t).toEqual([]);
    }
  });
});
