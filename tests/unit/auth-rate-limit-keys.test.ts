// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in and email limits can't be used to lock a member out: the tight limit counts an email together with the
 * client's address, and only a much higher ceiling counts the email alone. The limiter here counts like the real one
 * (each check in order, stopping at the first that is exceeded).
 */
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const TOO_MANY_EMAILS = "Please wait a few minutes before requesting another email.";
const state = { ip: "198.51.100.1" };
const counts = new Map<string, number>();
const seenKeys: string[] = [];

vi.mock("@/server/rate-limit", () => ({
  clientIp: vi.fn(async () => state.ip),
  hashKey: (v: string) => `h(${v.trim().toLowerCase()})`,
  rateLimitAll: vi.fn(async (checks: { key: string; limit: number; windowMs: number }[]) => {
    for (const c of checks) {
      seenKeys.push(c.key);
      const n = counts.get(c.key) ?? 0;
      if (n >= c.limit) return { ok: false, retryAfterSeconds: 60 };
      counts.set(c.key, n + 1);
    }
    return { ok: true, retryAfterSeconds: 0 };
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({
    auth: {
      signInWithPassword: async () => ({ error: { message: "Invalid login credentials", status: 400 } }),
      resetPasswordForEmail: async () => ({ error: null }),
      resend: async () => ({ error: null }),
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/flags", () => ({ isFlagEnabled: vi.fn(async () => true) }));
vi.mock("@/server/legal", () => ({ registerLegalVersions: vi.fn(async () => {}) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { signInAction, requestPasswordResetAction, resendConfirmationAction } = await import("@/server/actions/auth");
const { initialActionState } = await import("@/lib/action-state");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const signIn = async (email: string, ip: string) => {
  state.ip = ip;
  return (await signInAction(initialActionState, form({ email, password: "wrong-password-1" }))).message;
};
const reset = async (email: string, ip: string) => {
  state.ip = ip;
  return (await requestPasswordResetAction(initialActionState, form({ email }))).message;
};

beforeEach(() => {
  counts.clear();
  seenKeys.length = 0;
});

describe("sign-in limits", () => {
  it("someone hammering a member's email from one address is stopped, and the member can still sign in from theirs", async () => {
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 12; i++) results.push(await signIn("member@example.com", "203.0.113.9"));
    expect(results.slice(0, 10).every((m) => m === "Incorrect email or password.")).toBe(true);
    expect(results.slice(10)).toEqual([TOO_MANY, TOO_MANY]);
    expect(await signIn("member@example.com", "198.51.100.1")).toBe("Incorrect email or password.");
    // Attempts the tight limit refused never count towards the email-wide ceiling.
    expect(counts.get("signin:email:h(member@example.com)")).toBe(11);
  });

  it("an attack spread over many addresses still meets a ceiling on the email alone", async () => {
    for (let i = 0; i < 100; i++) expect(await signIn("member@example.com", `10.0.${Math.floor(i / 250)}.${i % 250}`)).toBe("Incorrect email or password.");
    expect(await signIn("member@example.com", "192.0.2.77")).toBe(TOO_MANY);
    expect(await signIn("someone-else@example.com", "192.0.2.77")).toBe("Incorrect email or password.");
  });

  it("no personal data in a key, and with no client address the tight limit stays on the email", async () => {
    await signIn("member@example.com", "203.0.113.9");
    expect(seenKeys).toEqual(["signin:ip:h(203.0.113.9)", "signin:email:h(member@example.com):ip:h(203.0.113.9)", "signin:email:h(member@example.com)"]);
    counts.clear();
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 11; i++) results.push(await signIn("member@example.com", "unknown"));
    expect(results.at(-1)).toBe(TOO_MANY);
    expect(results.at(-2)).toBe("Incorrect email or password.");
  });
});

describe("email (password reset, confirmation) limits", () => {
  it("a stranger asking for a member's reset emails doesn't stop the member asking for one", async () => {
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) results.push(await reset("member@example.com", "203.0.113.9"));
    expect(results.slice(0, 3).every((m) => /If an account exists/.test(m ?? ""))).toBe(true);
    expect(results[3]).toBe(TOO_MANY_EMAILS);
    expect(await reset("member@example.com", "198.51.100.1")).toMatch(/If an account exists/);
  });

  it("the confirmation email shares the same counters, and the email-wide ceiling still holds", async () => {
    state.ip = "198.51.100.1";
    expect((await resendConfirmationAction(initialActionState, form({ email: "member@example.com" }))).message).toMatch(/confirmation link/);
    expect(counts.get("email:addr:h(member@example.com):ip:h(198.51.100.1)")).toBe(1);
    counts.set("email:addr:h(member@example.com)", 30);
    expect(await reset("member@example.com", "192.0.2.5")).toBe(TOO_MANY_EMAILS);
  });
});
