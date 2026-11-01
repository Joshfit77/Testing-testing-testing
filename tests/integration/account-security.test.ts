import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, anonKey, createTestUser, deleteTestUser, serviceClient, stackAvailable, url, type TestUser } from "./helpers";

/**
 * Account security against the auth server and the REST API as an attacker reaches them: unconfirmed sign-ins,
 * reused refresh tokens after sign-out, forged or re-signed access tokens, bogus reset links, and admin escalation.
 * Runs against the local stack; the same auth settings must be set on the hosted Supabase project (see the report).
 */
const available = await stackAvailable();

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

describe.skipIf(!available)("account security", () => {
  let a: TestUser;
  let b: TestUser;
  const admin = serviceClient();

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser("acct-a"), createTestUser("acct-b")]);
    await admin.from("profiles").update({ display_name: "Private A" }).eq("id", a.id);
  });
  afterAll(async () => Promise.all([deleteTestUser(a), deleteTestUser(b)]));

  it("an unconfirmed email address can't sign in", async () => {
    const email = `it-unconfirmed-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: "Integration-Test-1", email_confirm: false });
    expect(error).toBeNull();
    try {
      const res = await anonClient().auth.signInWithPassword({ email, password: "Integration-Test-1" });
      expect(res.error).not.toBeNull();
      expect(res.data.session).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(data.user!.id);
    }
  });

  it("wrong passwords fail with one generic message (no account enumeration)", async () => {
    const wrong = await anonClient().auth.signInWithPassword({ email: a.email, password: "Wrong-Password-1" });
    const missing = await anonClient().auth.signInWithPassword({ email: `nobody-${Date.now()}@example.com`, password: "Wrong-Password-1" });
    expect(wrong.error?.message).toBe(missing.error?.message);
  });

  it("after sign-out the old refresh token can't start a new session", async () => {
    const u = await createTestUser("acct-signout");
    try {
      const { data } = await u.client.auth.getSession();
      const refresh = data.session!.refresh_token;
      await u.client.auth.signOut({ scope: "global" });
      const reuse = await anonClient().auth.refreshSession({ refresh_token: refresh });
      expect(reuse.error).not.toBeNull();
      expect(reuse.data.session).toBeNull();
    } finally {
      await deleteTestUser(u);
    }
  });

  it("a forged access token (another member's id, or re-signed with a guessed secret) is rejected by the API", async () => {
    const { data } = await b.client.auth.getSession();
    const [h, p, s] = data.session!.access_token.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString());
    // 1. Keep B's signature, swap in A's id.
    const swapped = [h, b64url(JSON.stringify({ ...payload, sub: a.id })), s].join(".");
    // 2. Re-sign with a guessed secret.
    const body = `${h}.${b64url(JSON.stringify({ ...payload, sub: a.id }))}`;
    const resigned = `${body}.${b64url(createHmac("sha256", "secret").update(body).digest())}`;
    // 3. "alg": "none".
    const none = `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify({ ...payload, sub: a.id }))}.`;
    for (const token of [swapped, resigned, none]) {
      const res = await fetch(`${url()}/rest/v1/profiles?select=id,display_name&id=eq.${a.id}`, { headers: { apikey: anonKey(), authorization: `Bearer ${token}` } });
      const text = await res.text();
      expect(res.status, text.slice(0, 120)).toBe(401);
      expect(text).not.toContain("Private A");
    }
  });

  it("a bogus or reused password-reset / confirmation token is refused", async () => {
    const c = anonClient();
    const bad = await c.auth.verifyOtp({ token_hash: "0".repeat(56), type: "recovery" });
    expect(bad.error).not.toBeNull();
    expect(bad.data.session).toBeNull();
    // A real recovery link works once only.
    const { data: link } = await admin.auth.admin.generateLink({ type: "recovery", email: b.email });
    const hash = link.properties!.hashed_token;
    const first = await anonClient().auth.verifyOtp({ token_hash: hash, type: "recovery" });
    expect(first.error).toBeNull();
    const second = await anonClient().auth.verifyOtp({ token_hash: hash, type: "recovery" });
    expect(second.error).not.toBeNull();
  });

  it("a member can't make themselves an admin or reach admin-only data", async () => {
    await b.client.from("profiles").update({ role: "admin" }).eq("id", b.id);
    expect((await admin.from("profiles").select("role").eq("id", b.id).single()).data?.role).not.toBe("admin");
    expect((await b.client.rpc("is_admin")).data ?? false).toBe(false);
    const audit = await b.client.from("admin_audit_logs").select("id").limit(1);
    expect(audit.data ?? []).toEqual([]);
    // Another member's profile is invisible and can't be changed.
    expect((await b.client.from("profiles").select("id").eq("id", a.id)).data ?? []).toEqual([]);
    await b.client.from("profiles").update({ display_name: "Hacked" }).eq("id", a.id);
    expect((await admin.from("profiles").select("display_name").eq("id", a.id).single()).data?.display_name).toBe("Private A");
  });

  it("signed-out (anonymous) callers read no member data", async () => {
    const anon = anonClient();
    for (const table of ["profiles", "workout_sessions", "measurement_entries", "weight_entries", "progress_photos", "ai_messages", "coach_memories", "faith_journal_entries", "sleep_sessions", "activities", "subscriptions", "user_entitlements"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      // A missing table would also return no rows: make sure the query reached a real table.
      expect(error?.code === "PGRST205" || error?.code === "42P01", `${table} exists`).toBe(false);
      expect(data ?? [], table).toEqual([]);
    }
    const list = await anon.storage.from("progress-photos").list(a.id);
    expect(list.data ?? []).toEqual([]);
  });
});
