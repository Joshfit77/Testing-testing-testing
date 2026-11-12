import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPENING_LAUNCH_COOKIE, RETURNING_COOKIE } from "@/lib/opening";

let user: { id: string } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));

const { isLaunch, updateSession } = await import("@/lib/supabase/middleware");

/** What a browser sends for a page load (the app opening "/"), and for the app's own fetches. */
const PAGE = { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" };
const FETCH = { accept: "*/*", "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" };
const req = (path: string, headers: Record<string, string>, cookies = "") =>
  new NextRequest(new URL(path, "https://app.narrowgate.test"), { headers: { ...headers, ...(cookies ? { cookie: cookies } : {}) } });

describe("launch routing", () => {
  beforeEach(() => {
    user = null;
  });

  it("a launch is the page load of / only", () => {
    expect(isLaunch(req("/", PAGE))).toBe(true);
    // Older Safari sends no Fetch Metadata: asking for HTML is enough.
    expect(isLaunch(req("/", { accept: PAGE.accept }))).toBe(true);
    // The same page load passed on by the service worker (public/sw.js), as Chromium sends it: still a navigation,
    // but its destination is no longer "document".
    expect(isLaunch(req("/", { ...PAGE, "sec-fetch-dest": "empty" }))).toBe(true);
    expect(isLaunch(req("/", FETCH))).toBe(false); // the app's own navigation to the welcome page
    expect(isLaunch(req("/", { ...PAGE, "sec-fetch-dest": "iframe", "sec-fetch-mode": "no-cors" }))).toBe(false);
    expect(isLaunch(req("/home", PAGE))).toBe(false); // a reload of a page plays the opening by its own rule
    expect(isLaunch(new NextRequest(new URL("/", "https://app.narrowgate.test"), { method: "POST", headers: PAGE }))).toBe(false);
  });

  it("marks a launch so the opening plays over wherever it ends, once (a short-lived cookie the head script removes)", async () => {
    const res = await updateSession(req("/", PAGE));
    const mark = res.cookies.get(OPENING_LAUNCH_COOKIE)!;
    expect(mark.value).toBe("1");
    expect(mark.maxAge).toBeLessThanOrEqual(30);
    expect(mark.httpOnly).toBeFalsy();
    expect((await updateSession(req("/", FETCH))).cookies.get(OPENING_LAUNCH_COOKIE)).toBeUndefined();
    expect((await updateSession(req("/home", PAGE))).cookies.get(OPENING_LAUNCH_COOKIE)).toBeUndefined();
  });

  it("a new person launching the app gets the welcome page", async () => {
    const res = await updateSession(req("/", PAGE));
    expect(res.headers.get("location")).toBeNull();
  });

  it("someone who has signed in on this device before, signed out now, launches into sign-in", async () => {
    const res = await updateSession(req("/", PAGE, `${RETURNING_COOKIE}=1`));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.cookies.get(OPENING_LAUNCH_COOKIE)?.value).toBe("1");
    // Tapping the logo inside the app still reaches the welcome page (not a launch), and so does the page after
    // deleting the account.
    expect((await updateSession(req("/", FETCH, `${RETURNING_COOKIE}=1`))).headers.get("location")).toBeNull();
    expect((await updateSession(req("/?deleted=1", PAGE, `${RETURNING_COOKIE}=1`))).headers.get("location")).toBeNull();
  });

  it("a signed-in launch goes Home with the launch mark (a page's own redirect would drop it), and the device is remembered", async () => {
    user = { id: "u1" };
    const res = await updateSession(req("/", PAGE));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/home");
    expect(res.cookies.get(OPENING_LAUNCH_COOKIE)?.value).toBe("1");
    const remembered = res.cookies.get(RETURNING_COOKIE)!;
    expect(remembered.value).toBe("1");
    expect(remembered.httpOnly).toBe(true);
    // Already remembered: not set again on every request.
    expect((await updateSession(req("/home", PAGE, `${RETURNING_COOKIE}=1`))).cookies.get(RETURNING_COOKIE)).toBeUndefined();
  });

  it("protected pages still send a signed-out visit to sign-in, without a launch mark", async () => {
    const res = await updateSession(req("/home", PAGE));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.cookies.get(OPENING_LAUNCH_COOKIE)).toBeUndefined();
  });
});
