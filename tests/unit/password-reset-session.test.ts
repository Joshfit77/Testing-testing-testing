// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_LINK_WINDOW_SECONDS, openedByRecentEmailLink } from "@/lib/auth/password-reset-session";

/**
 * A new password can be set only from a session that a reset email's link opened in the last 30 minutes. An ordinary
 * signed-in session (someone picking up an unlocked phone) gets a refusal and no form, so it can't lock the member out
 * of their account. Supabase marks a link sign-in `otp` and a password sign-in `password` in the token's `amr`
 * (checked against the local auth server: reset, magic link and sign-up confirmation links all give `otp`).
 */
const NOW = 1_800_000_000;

describe("openedByRecentEmailLink", () => {
  it("accepts a link sign-in from just now up to 30 minutes ago", () => {
    expect(openedByRecentEmailLink([{ method: "otp", timestamp: NOW }], NOW)).toBe(true);
    expect(openedByRecentEmailLink([{ method: "otp", timestamp: NOW - EMAIL_LINK_WINDOW_SECONDS }], NOW)).toBe(true);
    expect(openedByRecentEmailLink([{ method: "recovery", timestamp: NOW - 60 }], NOW)).toBe(true);
    expect(openedByRecentEmailLink([{ method: "password", timestamp: NOW - 9_000 }, { method: "otp", timestamp: NOW - 10 }], NOW)).toBe(true);
  });

  it("refuses a password sign-in, an old link, a future timestamp and anything malformed", () => {
    expect(openedByRecentEmailLink([{ method: "password", timestamp: NOW }], NOW)).toBe(false);
    expect(openedByRecentEmailLink([{ method: "otp", timestamp: NOW - EMAIL_LINK_WINDOW_SECONDS - 1 }], NOW)).toBe(false);
    expect(openedByRecentEmailLink([{ method: "otp", timestamp: NOW + 3_600 }], NOW)).toBe(false);
    expect(openedByRecentEmailLink([{ method: "oauth", timestamp: NOW }], NOW)).toBe(false);
    for (const bad of [undefined, null, "otp", {}, [null], [{ method: "otp" }], [{ method: "otp", timestamp: String(NOW) }]]) {
      expect(openedByRecentEmailLink(bad, NOW), JSON.stringify(bad)).toBe(false);
    }
  });
});

const session = { amr: null as unknown, updated: [] as string[] };
vi.mock("@/server/rate-limit", () => ({
  clientIp: vi.fn(async () => "198.51.100.7"),
  hashKey: (v: string) => v,
  rateLimitAll: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "member-1" } }, error: null }),
      getClaims: async () => ({ data: { claims: { sub: "member-1", amr: session.amr } }, error: null }),
      updateUser: async ({ password }: { password: string }) => {
        session.updated.push(password);
        return { data: {}, error: null };
      },
    },
  }),
}));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }));
vi.mock("@/server/flags", () => ({ isFlagEnabled: vi.fn(async () => true) }));
vi.mock("@/server/legal", () => ({ registerLegalVersions: vi.fn(async () => {}) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { updatePasswordAction } = await import("@/server/actions/auth");
const { initialActionState } = await import("@/lib/action-state");
const form = () => {
  const f = new FormData();
  f.set("password", "New-Password-2026!");
  f.set("confirm", "New-Password-2026!");
  return f;
};

beforeEach(() => {
  session.updated = [];
  redirect.mockReset();
});

describe("updatePasswordAction", () => {
  it("refuses an ordinary signed-in session and changes nothing", async () => {
    session.amr = [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 60 }];
    const r = await updatePasswordAction(initialActionState, form());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/reset email/);
    expect(session.updated).toEqual([]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a reset link opened more than 30 minutes ago", async () => {
    session.amr = [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - EMAIL_LINK_WINDOW_SECONDS - 120 }];
    expect((await updatePasswordAction(initialActionState, form())).ok).toBe(false);
    expect(session.updated).toEqual([]);
  });

  it("sets the password from a reset link opened just now", async () => {
    session.amr = [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - 30 }];
    await updatePasswordAction(initialActionState, form());
    expect(session.updated).toEqual(["New-Password-2026!"]);
    expect(redirect).toHaveBeenCalledWith("/home?password=updated");
  });
});
