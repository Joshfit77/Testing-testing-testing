// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSecurityPolicy } from "@/lib/security-headers";

/**
 * F-7: the bot check's token reaches Supabase on sign-up, sign-in and both email requests (Supabase verifies it on its
 * servers when CAPTCHA protection is on, so it can't be skipped by calling Supabase directly). A failed check gets a
 * clear message, and the page allows the check's frame only when a site key is configured.
 */
const calls: { fn: string; args: unknown[] }[] = [];
const result = { error: null as null | { code?: string; message: string; status?: number } };
const record = (fn: string) => async (...args: unknown[]) => {
  calls.push({ fn, args });
  return { data: { user: null, session: null }, error: result.error };
};
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({
    auth: {
      signUp: record("signUp"),
      signInWithPassword: record("signInWithPassword"),
      resend: record("resend"),
      resetPasswordForEmail: record("resetPasswordForEmail"),
      getUser: async () => ({ data: { user: null } }),
    },
  }),
}));
vi.mock("@/server/rate-limit", () => ({ clientIp: vi.fn(async () => "198.51.100.7"), hashKey: (v: string) => v, rateLimitAll: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/flags", () => ({ isFlagEnabled: vi.fn(async () => true) }));
vi.mock("@/server/legal", () => ({ registerLegalVersions: vi.fn(async () => {}) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { signInAction, signUpAction, resendConfirmationAction, requestPasswordResetAction } = await import("@/server/actions/auth");
const { initialActionState } = await import("@/lib/action-state");
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const member = { email: "member@example.com", password: "Gate-Strong-2026", captchaToken: "turnstile-token-123" };

beforeEach(() => {
  calls.length = 0;
  result.error = null;
});

describe("the bot check's token reaches Supabase", () => {
  it("on sign-in, sign-up, resend and password reset", async () => {
    await signInAction(initialActionState, form(member));
    await signUpAction(initialActionState, form({ ...member, displayName: "Member", ageConfirmed: "on", termsAccepted: "on", riskAcknowledged: "on" }));
    await resendConfirmationAction(initialActionState, form(member));
    await requestPasswordResetAction(initialActionState, form(member));
    const token = (fn: string) => {
      const c = calls.find((x) => x.fn === fn);
      if (!c) return `no call to ${fn}`;
      const [a, b] = c.args as [Record<string, unknown> | string, Record<string, unknown> | undefined];
      return fn === "resetPasswordForEmail" ? b?.captchaToken : ((a as Record<string, unknown>).options as Record<string, unknown>)?.captchaToken;
    };
    expect(token("signInWithPassword")).toBe("turnstile-token-123");
    expect(token("resend")).toBe("turnstile-token-123");
    expect(token("resetPasswordForEmail")).toBe("turnstile-token-123");
    expect(token("signUp")).toBe("turnstile-token-123");
  });

  it("without a check on the form, no token is sent", async () => {
    await signInAction(initialActionState, form({ email: member.email, password: member.password }));
    expect(((calls[0]!.args[0] as { options: { captchaToken?: string } }).options).captchaToken).toBeUndefined();
  });

  it("a failed check says so (not 'incorrect password')", async () => {
    result.error = { code: "captcha_failed", message: "captcha protection: request disallowed (timeout-or-duplicate)", status: 400 };
    const r = await signInAction(initialActionState, form(member));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/security check/);
  });
});

describe("the page allows the check's frame only when it's configured", () => {
  const base = { supabaseUrl: "https://x.supabase.co", production: true, https: true, nonce: "n" };
  it("frame-src", () => {
    expect(contentSecurityPolicy(base)).not.toContain("challenges.cloudflare.com");
    expect(contentSecurityPolicy({ ...base, captcha: true })).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  });
});
