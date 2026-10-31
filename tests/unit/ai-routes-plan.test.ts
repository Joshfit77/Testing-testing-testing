// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The AI routes accept two kinds of session (src/server/api-auth.ts): the browser cookie, and a bearer access
 * token for native / API clients. The member's plan must be read through whichever session authenticated the
 * request. Reading it through the cookie client on a bearer request runs as an anonymous visitor, finds no
 * entitlement row (RLS) and refuses a paying member as "free".
 */

type Row = Record<string, unknown> | null;

/** A minimal Supabase client stand-in: every query on `table` resolves to the row given for it (or none). */
function stubClient(rows: Record<string, Row>) {
  const client = {
    from(table: string) {
      const result = { data: rows[table] ?? null, error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "order", "limit", "gte", "lte", "in", "update", "insert", "delete"]) chain[m] = () => chain;
      chain.maybeSingle = async () => result;
      chain.single = async () => result;
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ? [rows[table]] : [], error: null }).then(resolve);
      return chain;
    },
  };
  return client;
}

const authenticateRequest = vi.fn();
const getServerSupabase = vi.fn();
const coachTurn = vi.fn();
const analyzeFoodPhoto = vi.fn();

class AiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

// Only the authentication itself is mocked; the plan lookup under test is the real one.
vi.mock("@/server/api-auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/api-auth")>()), authenticateRequest: (...args: unknown[]) => authenticateRequest(...args) }));
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: (...args: unknown[]) => getServerSupabase(...args),
  getServiceSupabase: () => stubClient({}),
  getTokenSupabase: () => stubClient({}),
}));
vi.mock("@/server/services/ai-coach", () => ({
  AiError,
  AI_ERROR_STATUS: { not_entitled: 403, quota: 429, provider: 502, not_configured: 503 },
  coachTurn: (...args: unknown[]) => coachTurn(...args),
}));
vi.mock("@/server/services/food-photo", () => ({ analyzeFoodPhoto: (...args: unknown[]) => analyzeFoodPhoto(...args) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { POST: chat } = await import("@/app/api/ai/chat/route");
const { POST: foodPhoto } = await import("@/app/api/ai/food-photo/route");
const { NextRequest } = await import("next/server");

const turnResult = {
  conversationId: "c1",
  userMessage: { id: "m1", role: "user", content: "hi", proposal: null, proposal_status: null, created_at: "2026-10-31T00:00:00Z" },
  assistantMessage: { id: "m2", role: "assistant", content: "hello", proposal: null, proposal_status: null, created_at: "2026-10-31T00:00:01Z" },
  usage: { used: 1, limit: 150 },
};

function chatRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ conversationId: null, message: "How is my bench going?", mode: "chat" }),
  });
}

describe("AI routes read the plan through the authenticated session", () => {
  beforeEach(() => {
    authenticateRequest.mockReset();
    getServerSupabase.mockReset();
    coachTurn.mockReset();
    analyzeFoodPhoto.mockReset();
    // The cookie client of a bearer request has no session: under RLS it sees no entitlement row at all.
    getServerSupabase.mockResolvedValue(stubClient({}));
    coachTurn.mockResolvedValue(turnResult);
  });

  it("a Pro member on a bearer token is coached as Pro", async () => {
    const session = stubClient({ user_entitlements: { plan: "pro", valid_until: null } });
    authenticateRequest.mockResolvedValue({ user: { id: "u-pro" }, supabase: session, via: "bearer" });
    const res = await chat(chatRequest({ authorization: "Bearer token" }));
    expect(res.status).toBe(200);
    expect(coachTurn).toHaveBeenCalledTimes(1);
    expect(coachTurn.mock.calls[0]![0]).toMatchObject({ userId: "u-pro", plan: "pro", supabase: session });
  });

  it("a cookie session is read the same way, and a lapsed entitlement counts as Free", async () => {
    const session = stubClient({ user_entitlements: { plan: "pro", valid_until: "2026-01-01T00:00:00Z" } });
    authenticateRequest.mockResolvedValue({ user: { id: "u-lapsed" }, supabase: session, via: "cookie" });
    const res = await chat(chatRequest({ origin: "http://localhost" }));
    expect(res.status).toBe(200);
    expect(coachTurn.mock.calls[0]![0]).toMatchObject({ userId: "u-lapsed", plan: "free" });
  });

  it("the food-photo route uses the same session for the plan", async () => {
    const session = stubClient({ user_entitlements: { plan: "pro", valid_until: null } });
    authenticateRequest.mockResolvedValue({ user: { id: "u-photo" }, supabase: session, via: "bearer" });
    analyzeFoodPhoto.mockResolvedValue({ is_food: true, items: [], summary: "ok", questions: [] });
    // A hand-built multipart body (the jsdom FormData isn't the one the request parser expects). A PNG header is
    // enough for the image sniff; the analysis itself is mocked.
    const boundary = "----ngf-test-boundary";
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const head = new TextEncoder().encode(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="meal.png"\r\nContent-Type: image/png\r\n\r\n`);
    const tail = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
    const body = new Uint8Array([...head, ...png, ...tail]);
    const res = await foodPhoto(
      new NextRequest("http://localhost/api/ai/food-photo", {
        method: "POST",
        headers: { authorization: "Bearer token", "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.length) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(analyzeFoodPhoto).toHaveBeenCalledTimes(1);
    // (supabase, userId, plan, photo, notes)
    expect(analyzeFoodPhoto.mock.calls[0]![0]).toBe(session);
    expect(analyzeFoodPhoto.mock.calls[0]![1]).toBe("u-photo");
    expect(analyzeFoodPhoto.mock.calls[0]![2]).toBe("pro");
  });
});
