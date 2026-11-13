// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Bible study helper's gates and stop reasons, with the database and the AI provider mocked: nothing is reserved
 * or sent without the member's AI data-sharing consent or while the AI kill switch is off, a refusal gives the
 * reserved question back, and an answer that ran out of room is shown as cut short.
 */
const state = {
  flag: true,
  consentAt: "2026-11-01T00:00:00Z" as string | null,
  consentError: null as { message: string } | null,
};
const rpc = vi.fn();
const create = vi.fn();
const usageUpdates: Record<string, unknown>[] = [];
const inserts: unknown[] = [];

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "gte", "order", "limit"]) c[m] = () => c;
  c.maybeSingle = async () => result;
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return c;
}
const service = {
  rpc: (...args: unknown[]) => rpc(...args),
  from(table: string) {
    if (table === "profiles") return chain({ data: state.consentError ? null : { ai_data_consent_at: state.consentAt }, error: state.consentError });
    if (table === "bible_ai_usage")
      return {
        ...chain({ data: [], error: null, count: 0 }),
        update: (values: Record<string, unknown>) => {
          usageUpdates.push(values);
          return chain({ error: null });
        },
      };
    return {
      ...chain({ data: [], error: null }),
      insert: (rows: unknown) => {
        inserts.push(rows);
        return chain({ error: null });
      },
    };
  },
};

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: (...args: unknown[]) => create(...args) };
  },
}));
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: () => service }));
vi.mock("@/server/flags", () => ({ isFlagEnabled: vi.fn(async (key: string) => (key === "ai_coach" ? state.flag : true)) }));
vi.mock("@/server/env", () => ({ isAiConfigured: () => true, serverEnv: { anthropicApiKey: "test-key" } }));
vi.mock("@/server/demo", () => ({ isDemoMode: () => false }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
// The shared AI request pipeline (allowance, money budgets, consent) is tested in ai-access / ai-budget integration
// tests; here it runs the helper's own call with the mocked provider and records what it was asked to meter.
const metered: { kind: string; costMicros?: number }[] = [];
vi.mock("@/server/services/ai-coach", () => {
  class AiError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    AiError,
    withAiRequest: async (params: { kind: string }, run: (ctx: { client: unknown; model: string }) => Promise<{ value: unknown; costMicros?: number }>) => {
      const r = await run({ client: { messages: { create: (...args: unknown[]) => create(...args) } }, model: "claude-haiku-5-5" });
      metered.push({ kind: params.kind, costMicros: r.costMicros });
      return r.value;
    },
  };
});

const { askBible } = await import("@/server/services/bible-ai");
const { BIBLE_AI_CUT_SHORT_NOTE, BIBLE_AI_MAX_TOKENS, BIBLE_AI_REFUSAL } = await import("@/lib/bible/ai");

const THREAD = "3f2b8c1e-9a4d-4e2b-8f6a-1c2d3e4f5a6b";
const reply = (stop_reason: string, text = "John 3:16 speaks of God's love.") => ({
  content: text ? [{ type: "text", text }] : [],
  stop_reason,
  usage: { input_tokens: 800, output_tokens: 40 },
});

beforeEach(() => {
  state.flag = true;
  state.consentAt = "2026-11-01T00:00:00Z";
  state.consentError = null;
  rpc.mockReset().mockResolvedValue({ data: 7, error: null });
  create.mockReset().mockResolvedValue(reply("end_turn"));
  usageUpdates.length = 0;
  inserts.length = 0;
  metered.length = 0;
});

describe("Bible study helper: consent and the AI kill switch", () => {
  it("without AI data-sharing consent nothing is reserved or sent, and the member is told how to allow it", async () => {
    state.consentAt = null;
    const r = await askBible("u1", "free", "What does John 3:16 mean?", THREAD);
    expect(r).toMatchObject({ ok: false, code: "consent_required" });
    expect(r.ok ? "" : r.error).toMatch(/Allow AI data sharing/);
    expect(r.ok ? "" : r.error).toMatch(/Profile & Settings/);
    expect(rpc).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("consent that can't be read is not consent", async () => {
    state.consentError = { message: "connection refused" };
    expect(await askBible("u1", "free", "What does John 3:16 mean?", THREAD)).toMatchObject({ ok: false, code: "error" });
    expect(rpc).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("with the ai_coach flag off the helper is unavailable, for a consenting Pro member too", async () => {
    state.flag = false;
    const r = await askBible("u1", "pro", "What does John 3:16 mean?", THREAD);
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    expect(r.ok ? "" : r.error).toMatch(/temporarily unavailable/);
    expect(rpc).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("Free has no AI: the helper is Pro, and nothing is reserved or sent for a Free member", async () => {
    const r = await askBible("u1", "free", "What does John 3:16 mean?", THREAD);
    expect(r).toMatchObject({ ok: false, code: "not_entitled" });
    expect(r.ok ? "" : r.error).toMatch(/Pro All Access/);
    expect(rpc).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(metered).toEqual([]);
  });

  it("with consent and the flag on, a Pro question is reserved, answered, saved and metered as a Bible study request", async () => {
    const r = await askBible("u1", "pro", "What does John 3:16 mean?", THREAD);
    expect(r).toMatchObject({ ok: true, answer: "John 3:16 speaks of God's love." });
    expect(rpc).toHaveBeenCalledWith("reserve_bible_ai_usage", expect.objectContaining({ p_user_id: "u1" }));
    expect(create.mock.calls[0]![0]).toMatchObject({ max_tokens: BIBLE_AI_MAX_TOKENS });
    expect(BIBLE_AI_MAX_TOKENS).toBeGreaterThanOrEqual(2000);
    expect(usageUpdates).toEqual([expect.objectContaining({ status: "done", output_tokens: 40 })]);
    expect(inserts).toHaveLength(1);
    expect(metered).toEqual([{ kind: "bible_study", costMicros: Math.ceil(800 * 0.1 + 40 * 0.5) }]);
  });
});

describe("Bible study helper: stop reasons", () => {
  it("max_tokens: the partial answer is shown with a note that it was cut short", async () => {
    create.mockResolvedValue(reply("max_tokens", "Romans 8:28 says that God works all things"));
    const r = await askBible("u1", "pro", "What does Romans 8:28 mean?", THREAD);
    expect(r).toMatchObject({ ok: true, answer: `Romans 8:28 says that God works all things\n\n${BIBLE_AI_CUT_SHORT_NOTE}` });
    expect(r.ok && r.citations.map((c) => c.reference)).toEqual(["Romans 8:28"]);
    expect(usageUpdates).toEqual([expect.objectContaining({ status: "done" })]);
  });

  it("refusal: a friendly message, nothing saved, and the reserved question given back", async () => {
    create.mockResolvedValue(reply("refusal", ""));
    const r = await askBible("u1", "pro", "What does John 3:16 mean?", THREAD);
    expect(r).toEqual({ ok: false, code: "refused", error: BIBLE_AI_REFUSAL });
    expect(usageUpdates).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(inserts).toHaveLength(0);
  });
});
