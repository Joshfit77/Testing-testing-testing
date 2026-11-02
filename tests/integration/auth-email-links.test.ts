import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { anonKey, createTestUser, deleteTestUser, serviceClient, stackAvailable, url, type TestUser } from "./helpers";

// The cookies of the browser that opens the link, for the app's own /auth/confirm route (cleared per request).
const safariCookies = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...safariCookies].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void safariCookies.set(name, value),
  }),
  headers: async () => new Headers(),
}));

/**
 * Why password-reset (and sign-up confirmation) emails must link to /auth/confirm with a token hash.
 *
 * With Supabase's default templates the email links to GoTrue's /verify, which redirects to /auth/callback with a
 * PKCE code. Exchanging that code needs the code verifier, which the app stored as a cookie in the browser that
 * asked for the email. In the iPhone app that browser is the app's WebView, but a link tapped in Mail opens in
 * Safari (the app has no universal links), so the exchange fails and the member can never reset their password.
 * The same happens on the web whenever the email is opened in another browser or a mail app's in-app browser.
 *
 * The token-hash link (supabase/templates/*.html → /auth/confirm) carries everything needed, so it works in
 * whichever browser opens it. These tests show both behaviours against the local stack's real GoTrue and mail
 * catcher.
 */
const available = await stackAvailable();
const MAILPIT = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";
const SITE = "http://localhost:3000";

/** A browser's cookie jar, as far as supabase-js is concerned. */
function jar(): SupportedStorage & { keys: () => string[] } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}
const browser = (storage: SupportedStorage) =>
  createClient(url(), anonKey(), { auth: { flowType: "pkce", storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });

async function latestLinkTo(email: string, type: string): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    for (const msg of list.messages ?? []) {
      const body = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML?: string; Text?: string };
      const link = `${body.HTML ?? ""} ${body.Text ?? ""}`.replace(/&amp;/g, "&").match(new RegExp(`https?://[^\\s"'<>)]+type=${type}[^\\s"'<>)]*`))?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/**
 * The token hash in an emailed link: `token_hash` in this repository's templates (/auth/confirm), `token` in GoTrue's
 * default /verify link. The local stack sends whichever templates it was started with (config.toml), so both count.
 */
function emailedTokenHash(link: string | null): string | null {
  if (!link) return null;
  const u = new URL(link);
  return u.searchParams.get("token_hash") ?? u.searchParams.get("token");
}

/** GoTrue's default link for that token hash (what {{ .ConfirmationURL }} would have been in the email). */
function defaultVerifyLink(tokenHash: string, type: string, redirectTo: string): string {
  return `${url()}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;
}

async function mailCatcherAvailable(): Promise<boolean> {
  try {
    return (await fetch(`${MAILPIT}/api/v1/messages?limit=1`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}
const mail = available && (await mailCatcherAvailable());

describe.skipIf(!available)("auth email links", () => {
  // One member per emailed test: GoTrue allows one reset email per address per minute (max_frequency).
  let member: TestUser;
  let pkceMember: TestUser;
  let hashMember: TestUser;

  beforeAll(async () => {
    [member, pkceMember, hashMember] = await Promise.all([createTestUser("reset-link"), createTestUser("reset-pkce"), createTestUser("reset-hash")]);
  });
  afterAll(async () => Promise.all([deleteTestUser(member), deleteTestUser(pkceMember), deleteTestUser(hashMember)]));

  it.skipIf(!mail)("a default (PKCE) reset link only works in the browser that asked for it", async () => {
    const appWebView = jar();
    const redirectTo = `${SITE}/auth/callback?next=/reset-password`;
    const { error } = await browser(appWebView).auth.resetPasswordForEmail(pkceMember.email, { redirectTo });
    if (error?.status === 429) {
      // The local stack's hourly email limit is shared with every other test run; this proof needs one email.
      console.warn("Skipped: local GoTrue email rate limit reached");
      return;
    }
    expect(error).toBeNull();
    expect(appWebView.keys().some((k) => k.endsWith("-code-verifier"))).toBe(true);

    const link = await latestLinkTo(pkceMember.email, "recovery");
    expect(link, "recovery email in the mail catcher").toBeTruthy();
    // The default template's link, for the token this email carries.
    const verify = await fetch(defaultVerifyLink(emailedTokenHash(link)!, "recovery", redirectTo), { redirect: "manual" });
    const location = new URL(verify.headers.get("location")!);
    expect(location.pathname).toBe("/auth/callback");
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    // Safari (or any other browser): no code verifier, so the exchange in /auth/callback fails.
    const safari = await browser(jar()).auth.exchangeCodeForSession(code!);
    expect(safari.error).not.toBeNull();
    expect(safari.data.session).toBeNull();
    // The browser that asked for the email can complete it.
    const same = await browser(appWebView).auth.exchangeCodeForSession(code!);
    expect(same.error).toBeNull();
    expect(same.data.session?.user.id).toBe(pkceMember.id);
  });

  it.skipIf(!mail)("the token hash of a reset the app requested (PKCE) verifies in any other browser", async () => {
    // The app's server client always starts PKCE flows, so this is what {{ .TokenHash }} holds in a real email.
    const { error } = await browser(jar()).auth.resetPasswordForEmail(hashMember.email, { redirectTo: `${SITE}/auth/callback?next=/reset-password` });
    if (error?.status === 429) {
      console.warn("Skipped: local GoTrue email rate limit reached");
      return;
    }
    expect(error).toBeNull();
    const link = await latestLinkTo(hashMember.email, "recovery");
    // The same token hash whichever template sent it (the repository's links /auth/confirm?token_hash=…, the default
    // /verify?token=…).
    const tokenHash = emailedTokenHash(link);
    expect(tokenHash).toMatch(/^pkce_[0-9a-f]+$/);
    const safari = browser(jar());
    const verified = await safari.auth.verifyOtp({ type: "recovery", token_hash: tokenHash! });
    expect(verified.error).toBeNull();
    expect(verified.data.session?.user.id).toBe(hashMember.id);
  });

  it("a token-hash reset link (what /auth/confirm verifies) works in any browser and lets the member set a new password", async () => {
    const { data, error } = await serviceClient().auth.admin.generateLink({ type: "recovery", email: member.email });
    expect(error).toBeNull();
    const tokenHash = data.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();

    // A brand-new browser with nothing stored, exactly what Safari is after tapping the link in Mail.
    const safari = browser(jar());
    const verified = await safari.auth.verifyOtp({ type: "recovery", token_hash: tokenHash! });
    expect(verified.error).toBeNull();
    expect(verified.data.session?.user.id).toBe(member.id);
    const newPassword = `Reset-${crypto.randomUUID().slice(0, 8)}-9`;
    expect((await safari.auth.updateUser({ password: newPassword })).error).toBeNull();
    const signIn = await browser(jar()).auth.signInWithPassword({ email: member.email, password: newPassword });
    expect(signIn.error).toBeNull();
    // The link is single-use.
    expect((await browser(jar()).auth.verifyOtp({ type: "recovery", token_hash: tokenHash! })).error).not.toBeNull();
  });

  it("the app's /auth/confirm route turns the reset link into a session in a fresh browser and opens the reset page", async () => {
    const { GET } = await import("@/app/auth/confirm/route");
    const { data } = await serviceClient().auth.admin.generateLink({ type: "recovery", email: member.email });
    safariCookies.clear();
    const res = await GET(new NextRequest(`${SITE}/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery&next=/reset-password`));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/reset-password");
    expect([...safariCookies.keys()].some((k) => /^sb-.+-auth-token/.test(k))).toBe(true);
  });

  it.skipIf(!mail)("a sign-up made in the app (PKCE) is confirmed by /auth/confirm with type=email, as the confirmation template links", async () => {
    const { GET } = await import("@/app/auth/confirm/route");
    const email = `it-signup-link-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const { data: signed, error } = await browser(jar()).auth.signUp({ email, password: "Integration-Test-1", options: { emailRedirectTo: `${SITE}/auth/callback?next=/onboarding` } });
    if (error?.status === 429) {
      console.warn("Skipped: local GoTrue email rate limit reached");
      return;
    }
    expect(error).toBeNull();
    const userId = signed.user!.id;
    try {
      // type=email in the repository's confirmation template, type=signup in GoTrue's default one.
      const link = await latestLinkTo(email, "(?:email|signup)");
      const tokenHash = emailedTokenHash(link);
      expect(tokenHash, "confirmation email in the mail catcher").toBeTruthy();
      safariCookies.clear();
      const res = await GET(new NextRequest(`${SITE}/auth/confirm?token_hash=${tokenHash}&type=email&next=/onboarding`));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
      const { data: user } = await serviceClient().auth.admin.getUserById(userId);
      expect(user.user?.email_confirmed_at).toBeTruthy();
    } finally {
      await serviceClient().auth.admin.deleteUser(userId);
    }
  });
});
