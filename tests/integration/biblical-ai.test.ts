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

/** A queued input may carry `__stop` (the stop reason to return) and `__delay` (ms before answering). */
function reply(tool: string, queued: Record<string, unknown>) {
  const { __stop, __delay: _delay, ...input } = queued;
  return {
    id: `msg_${requests.length}`,
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "tool_use", id: `toolu_${requests.length}`, name: tool, input }],
    stop_reason: (__stop as string | undefined) ?? "tool_use",
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
        const input: Record<string, unknown> = queue.length > 1 ? queue.shift()! : (queue[0] ?? GOOD);
        const send = () => {
          if (res.destroyed) return;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(reply(parsed.tool_choice?.name ?? "submit_study", input)));
        };
        const delay = Number(input.__delay ?? 0);
        if (delay) setTimeout(send, delay);
        else send();
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

  const ask = (user: TestUser, plan: "free" | "plus" | "pro", over: Partial<Parameters<typeof svcMod.askBiblicalAi>[0]> = {}) =>
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

  it("the passages-only fallback isn't counted against the member's questions", async () => {
    await setFlag(true);
    queue = [{ answer: "No idea.", scripture: [{ reference: "Opinions 1:1" }] }];
    const r = await ask(pro, "pro", { question: "What does the Bible say about patience?" });
    expect(r.ok).toBe(true);
    const { data: usage } = await svc.from("bible_ai_usage").select("status").eq("user_id", pro.id).order("created_at", { ascending: false }).limit(1).single();
    expect(usage!.status).toBe("failed");
  });

  it("an answer cut off at the output limit is asked again with more room", async () => {
    await setFlag(true);
    queue = [{ ...GOOD, __stop: "max_tokens" }, GOOD];
    const before = requests.length;
    const r = await ask(pro, "pro");
    expect(r).toMatchObject({ ok: true });
    const sent = requests.slice(before) as (Req & { max_tokens: number })[];
    expect(sent).toHaveLength(2);
    expect(sent[1]!.max_tokens).toBeGreaterThan(sent[0]!.max_tokens);
    // The cut-off reply isn't sent back as if it were complete.
    expect(sent[1]!.messages).toHaveLength(sent[0]!.messages.length);
  });

  it("keeps the first checked answer when the corrective attempt is refused or worse", async () => {
    await setFlag(true);
    const oneFailure = { ...GOOD, answer: 'God loved the world (John 3:16). "God helps those who help themselves."' };
    queue = [oneFailure, { ...GOOD, __stop: "refusal" }];
    const refused = await ask(pro, "pro");
    expect(refused).toMatchObject({ ok: true });
    if (refused.ok) expect(refused.answer.answer).toMatch(/God loved the world/);
    queue = [oneFailure, { answer: "Read Hezekiah 3:5 and Opinions 2:2.", scripture: [{ reference: "Opinions 2:2" }, { reference: "John 3:16" }] }];
    const worse = await ask(pro, "pro");
    expect(worse).toMatchObject({ ok: true });
    if (worse.ok) {
      expect(worse.answer.answer).toMatch(/God loved the world/);
      expect(worse.answer.answer).not.toMatch(/Hezekiah/);
    }
  });

  it("cancelling stops the provider call, counts the question, and frees the request id for a retry", async () => {
    await setFlag(true);
    queue = [{ ...GOOD, __delay: 1500 }];
    const requestId = crypto.randomUUID();
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 300);
    const r = await ask(pro, "pro", { requestId, signal: ctrl.signal });
    expect(r).toMatchObject({ ok: false, code: "cancelled" });
    if (!r.ok) expect(r.error).toMatch(/still counts/);
    const { data: usage } = await svc.from("bible_ai_usage").select("status").eq("user_id", pro.id).order("created_at", { ascending: false }).limit(1).single();
    expect(usage!.status).toBe("cancelled");
    const { count } = await svc.from("biblical_ai_messages").select("id", { count: "exact", head: true }).eq("user_id", pro.id).eq("request_id", requestId);
    expect(count).toBe(0);
    queue = [GOOD];
    expect(await ask(pro, "pro", { requestId })).toMatchObject({ ok: true, replayed: false });
  });

  it("running out of time is reported as a time-out and isn't counted", async () => {
    await setFlag(true);
    queue = [{ ...GOOD, __delay: 1500 }];
    const r = await ask(pro, "pro", { signal: AbortSignal.timeout(300) });
    expect(r).toMatchObject({ ok: false, code: "timeout" });
    const { data: usage } = await svc.from("bible_ai_usage").select("status").eq("user_id", pro.id).order("created_at", { ascending: false }).limit(1).single();
    expect(usage!.status).toBe("failed");
  });

  it("the same request id sent twice at once is answered (and paid for) once", async () => {
    await setFlag(true);
    queue = [{ ...GOOD, __delay: 600 }];
    const requestId = crypto.randomUUID();
    const before = requests.length;
    const [a, b] = await Promise.all([ask(pro, "pro", { requestId }), ask(pro, "pro", { requestId })]);
    expect(requests.length - before).toBe(1);
    const results = [a, b];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "rate_limited", error: expect.stringMatching(/already being answered/) });
    expect(await ask(pro, "pro", { requestId })).toMatchObject({ ok: true, replayed: true });
  });

  it("a question about suicide or harm always gets the fixed crisis guidance", async () => {
    await setFlag(true);
    queue = [GOOD];
    const r = await ask(pro, "pro", { question: "I want to end my life. Does God still love me?" });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.answer.safety).toMatch(/988/);
  });

  it("a reservation left behind by a request that died stops counting after ten minutes", async () => {
    await setFlag(true);
    const stale = await createTestUser("bai-stale");
    try {
      await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString() }).eq("id", stale.id);
      const old = new Date(Date.now() - 15 * 60_000).toISOString();
      await svc.from("bible_ai_usage").insert([0, 1, 2].map(() => ({ user_id: stale.id, status: "reserved", created_at: old })));
      expect(await ask(stale, "free")).toMatchObject({ ok: true });
    } finally {
      await deleteTestUser(stale);
    }
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
    const { data: savedPlan } = await svc.from("biblical_ai_saved_studies").select("request_id, kind").eq("id", r.studyId).single();
    expect(savedPlan).toEqual({ request_id: requestId, kind: "plan" });
    // Plan prose gets the answer checks: an invented book in an explanation is marked.
    queue = [{ title: "Grace", objective: "Understand grace.", days: days.map((d) => ({ ...d, explanation: "Compare Hezekiah 3:5." })) }];
    const marked = await svcMod.generateStudyPlan({ userId: pro.id, plan: "pro", topic: "Grace again", days: 7, requestId: crypto.randomUUID() });
    expect(marked).toMatchObject({ ok: true });
    if (marked.ok) expect(marked.study.days[0]!.explanation).toContain("[reference not found in the BSB]");
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

  it("members can't read the source inventory, documents or audit trail (teachers are internal to the admin backend)", async () => {
    for (const table of ["biblical_ai_sources", "biblical_ai_source_documents", "biblical_ai_source_audit"]) {
      const { data } = await pro.client.from(table).select("*").limit(5);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("an approved teacher's material informs the answer without the teacher being named; a required credit is shown", async () => {
    await setFlag(true);
    const admin = await createTestUser("bai-admin2");
    try {
      await makeAdmin(admin);
      // A licence that requires a credit can't be approved until the credit text is recorded.
      await svc.from("biblical_ai_sources").update({ attribution_required: true, attribution: null }).eq("slug", "alistair-begg");
      const missing = await svc.rpc("biblical_ai_set_source_status", { p_slug: "alistair-begg", p_status: "approved", p_reason: "test", p_founder: true, p_actor: admin.id });
      expect(missing.error?.message).toMatch(/attribution text required/);
      await svc.from("biblical_ai_sources").update({ attribution: "Some material used with permission of Truth For Life." }).eq("slug", "alistair-begg");
      expect((await svc.rpc("biblical_ai_set_source_status", { p_slug: "alistair-begg", p_status: "approved", p_reason: "test", p_founder: true, p_actor: admin.id })).error).toBeNull();
      const { data: doc } = await svc
        .from("biblical_ai_source_documents")
        .insert({ source_slug: "alistair-begg", author: "Alistair Begg", title: "Forgiveness and the cross", url: "https://www.truthforlife.org/test", body: "Forgiveness flows from the cross, where God forgave our debts in Christ." })
        .select("id")
        .single();
      queue = [{ ...GOOD, answer: "Alistair Begg teaches that forgiveness flows from the cross. God loved the world (John 3:16).", knowledge_used: [doc!.id] }];
      const before = requests.length;
      const r = await ask(pro, "pro", { question: "Why should I forgive others?" });
      expect(r).toMatchObject({ ok: true });
      if (!r.ok) return;
      // The model received the material as knowledge; naming the teacher was sent back for correction.
      const sent = JSON.stringify(requests[before]!.messages.at(-1)!.content);
      expect(JSON.stringify(requests.at(-1)!.messages.at(-1)!.content)).toMatch(/names a teacher/);
      expect(sent).toContain("<knowledge>");
      expect(sent).toContain("Forgiveness flows from the cross");
      // The member sees no teacher's name, only the credit the licence requires.
      expect(r.answer.answer).not.toMatch(/Begg/);
      expect(r.answer.sources).toEqual([{ attribution: "Some material used with permission of Truth For Life.", url: "https://www.truthforlife.org/test" }]);
      expect(JSON.stringify(r.answer)).not.toMatch(/Alistair|Forgiveness and the cross/);
    } finally {
      await svc.from("biblical_ai_source_documents").delete().eq("source_slug", "alistair-begg");
      await svc.from("biblical_ai_sources").update({ status: "pending_review", attribution_required: false, attribution: null }).eq("slug", "alistair-begg");
      await deleteTestUser(admin);
    }
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
