import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Review 2026-11-20: when the sign-in ran out mid-workout, the middleware answered the workout backup (a server action
 * POST to /train/workout) with a redirect to /login, and Next moved the whole app there in the middle of a set. Server
 * actions authenticate themselves (and are reachable through public pages anyway), so they now pass through to give
 * their own answer; signed-out *page* requests to protected screens are still sent to /login.
 */
let user: { id: string } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: null } }) } }),
}));
const { updateSession } = await import("@/lib/supabase/middleware");
const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(path, "https://app.narrowgate.test"), { method: init.method ?? "GET", headers: init.headers ?? {} });
const ACTION = { method: "POST", headers: { "next-action": "7f3a0c1d2e", accept: "text/x-component" } };

beforeEach(() => {
  user = null;
});

describe("signed out on a protected screen", () => {
  it("a page visit still goes to /login?next=…", async () => {
    const res = await updateSession(req("/train/workout?day=d1"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(new URL(res.headers.get("location")!).searchParams.get("next")).toBe("/train/workout?day=d1");
  });

  it("a server action passes through to answer for itself (no redirect)", async () => {
    const res = await updateSession(req("/train/workout", ACTION));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("a plain POST without the action header is still redirected", async () => {
    const res = await updateSession(req("/train/workout", { method: "POST" }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("signed in, nothing changes for either", async () => {
    user = { id: "member-1" };
    expect((await updateSession(req("/train/workout"))).headers.get("location")).toBeNull();
    expect((await updateSession(req("/train/workout", ACTION))).headers.get("location")).toBeNull();
  });
});
