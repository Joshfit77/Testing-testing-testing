// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SESSION_MAX_AGE_DAYS, sessionMaxAgeDays, sessionSignedInAt, sessionTooOld } from "@/lib/auth/session-age";

/**
 * F-14 (security assessment 2026-11-20): a sign-in lasts 30 days (SESSION_MAX_AGE_DAYS), however often it is refreshed;
 * the age comes from the access token's amr claim, which keeps the original sign-in time through refreshes. Past it,
 * the middleware signs this device out and page visits go to sign-in with a message; server actions answer as signed
 * out (getCurrentUser) instead of being redirected mid-workout.
 */
const NOW = Date.parse("2026-11-21T12:00:00Z");
const DAY = 86_400;
const token = (amr: unknown) => `h.${Buffer.from(JSON.stringify({ sub: "u1", amr })).toString("base64url")}.s`;
const signedInDaysAgo = (d: number) => token([{ method: "password", timestamp: NOW / 1000 - d * DAY }, { method: "totp", timestamp: NOW / 1000 - 60 }]);

describe("session age rules", () => {
  it("reads the original sign-in time (the earliest method), whatever came after", () => {
    expect(sessionSignedInAt(signedInDaysAgo(3))).toBe(NOW / 1000 - 3 * DAY);
    for (const bad of [null, "", "not-a-jwt", token("x"), token([{ method: "otp" }])]) expect(sessionSignedInAt(bad), String(bad)).toBeNull();
  });
  it("is too old past the maximum age only", () => {
    expect(sessionTooOld(signedInDaysAgo(29), NOW, 30)).toBe(false);
    expect(sessionTooOld(signedInDaysAgo(31), NOW, 30)).toBe(true);
    expect(sessionTooOld("garbage", NOW, 30)).toBe(false);
  });
  it("SESSION_MAX_AGE_DAYS: 1 to 365 days, else 30", () => {
    expect(sessionMaxAgeDays(undefined)).toBe(DEFAULT_SESSION_MAX_AGE_DAYS);
    expect(sessionMaxAgeDays("7")).toBe(7);
    for (const bad of ["0", "-3", "400", "1.5", "abc"]) expect(sessionMaxAgeDays(bad), bad).toBe(30);
  });
});

const session = { token: null as string | null, signedOut: 0 };
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: session.token ? { id: "u1" } : null } }),
      getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }),
      signOut: async () => {
        session.signedOut += 1;
        return { error: null };
      },
    },
  }),
}));
const { updateSession } = await import("@/lib/supabase/middleware");
const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(path, "https://app.narrowgate.test"), { method: init.method ?? "GET", headers: init.headers ?? {} });

describe("the middleware enforces the maximum age", () => {
  beforeEach(() => {
    session.signedOut = 0;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("a 31-day-old sign-in: this device is signed out and a page visit goes to sign-in with the reason", async () => {
    session.token = signedInDaysAgo(31);
    const res = await updateSession(req("/home"));
    expect(session.signedOut).toBe(1);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("notice")).toBe("session_expired");
  });

  it("a server action isn't redirected (it answers as signed out itself); a recent sign-in is untouched", async () => {
    session.token = signedInDaysAgo(31);
    const action = await updateSession(req("/train/workout", { method: "POST", headers: { "next-action": "abc" } }));
    expect(action.headers.get("location")).toBeNull();
    expect(session.signedOut).toBe(1);
    session.token = signedInDaysAgo(2);
    session.signedOut = 0;
    const fresh = await updateSession(req("/home"));
    expect(fresh.headers.get("location")).toBeNull();
    expect(session.signedOut).toBe(0);
  });
});
