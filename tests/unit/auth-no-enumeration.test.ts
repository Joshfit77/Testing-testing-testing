// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Password-reset and confirmation-email requests give the same reply whether or not the address has an account.
 * Supabase limits these emails per address (one a minute) only for addresses that exist (reset) or exist unconfirmed
 * (resend), so its "too many requests" (429) answered a second request within a minute differently for registered
 * addresses: anyone could test whether someone has an account. A 429 now gets the generic reply too.
 */
const supabaseError = { current: null as null | { status: number; message: string } };
vi.mock("@/server/rate-limit", () => ({
  clientIp: vi.fn(async () => "198.51.100.7"),
  hashKey: (v: string) => v,
  rateLimitAll: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({
    auth: {
      resetPasswordForEmail: async () => ({ error: supabaseError.current }),
      resend: async () => ({ error: supabaseError.current }),
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/flags", () => ({ isFlagEnabled: vi.fn(async () => true) }));
vi.mock("@/server/legal", () => ({ registerLegalVersions: vi.fn(async () => {}) }));
const logError = vi.fn();
vi.mock("@/server/log", () => ({ logError: (...a: unknown[]) => logError(...a), logInfo: vi.fn() }));

const { requestPasswordResetAction, resendConfirmationAction } = await import("@/server/actions/auth");
const { initialActionState } = await import("@/lib/action-state");
const form = (email: string) => {
  const f = new FormData();
  f.set("email", email);
  return f;
};

beforeEach(() => {
  supabaseError.current = null;
  logError.mockReset();
});

describe("no account enumeration through the email requests", () => {
  for (const [name, call] of [
    ["password reset", (e: string) => requestPasswordResetAction(initialActionState, form(e))],
    ["confirmation resend", (e: string) => resendConfirmationAction(initialActionState, form(e))],
  ] as const) {
    it(`${name}: Supabase's per-address throttle (only for registered addresses) gets the same reply as an unknown address`, async () => {
      const unknown = await call("nobody@example.com");
      supabaseError.current = { status: 429, message: "For security purposes, you can only request this after 52 seconds." };
      const registered = await call("member@example.com");
      expect(registered.ok).toBe(true);
      expect(unknown.ok).toBe(true);
      expect(registered.message).toBe(unknown.message);
      // Operators still see it.
      expect(logError).toHaveBeenCalledTimes(1);
    });
  }
});
