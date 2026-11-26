import { spawnSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();
const TEST_PASSWORD = "Integration-Test-1"; // the password createTestUser gives every test member (helpers.ts)
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => {
  const r = spawnSync("psql", [DB_URL, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};

/**
 * Independent security review, 2026-11-25 (migration 090 and src/server/api-auth.ts), against the real local stack:
 * N-1 sign-ins past the maximum age are refused by the API's Bearer path and ended at the authentication server;
 * N-2 nothing new can be uploaded to the unused avatars bucket; N-4 an applied or dismissed coach proposal can't be
 * re-armed by the member; N-5 layout preferences are size-limited.
 */
describe.skipIf(!available)("security review hardening (migration 090)", () => {
  const svc = serviceClient();
  let m: TestUser;
  let other: TestUser;
  beforeAll(async () => {
    [m, other] = await Promise.all([createTestUser("secrev-a"), createTestUser("secrev-b")]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(m), deleteTestUser(other)]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("N-2: no new uploads or overwrites in the avatars bucket", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const up = await m.client.storage.from("avatars").upload(`${m.id}/a.png`, png, { contentType: "image/png" });
    expect(up.error).not.toBeNull();
  });

  it("N-4: a member can apply or dismiss a proposal once, but never move it back", async () => {
    const conv = (await svc.from("ai_conversations").insert({ user_id: m.id, title: "t" }).select("id").single()).data!.id;
    const msg = (
      await svc
        .from("ai_messages")
        .insert({ conversation_id: conv, user_id: m.id, role: "assistant", content: "A plan", proposal: { kind: "test" }, proposal_status: "proposed" })
        .select("id")
        .single()
    ).data!.id;
    const set = (status: string) => m.client.from("ai_messages").update({ proposal_status: status }).eq("id", msg).select("proposal_status");
    expect((await set("applied")).error).toBeNull();
    expect((await set("proposed")).error).not.toBeNull();
    expect((await set("dismissed")).error).not.toBeNull();
    expect((await svc.from("ai_messages").select("proposal_status").eq("id", msg).single()).data!.proposal_status).toBe("applied");
    // The server (after a failed save) may reopen it.
    expect((await svc.from("ai_messages").update({ proposal_status: "proposed" }).eq("id", msg)).error).toBeNull();
    expect((await set("dismissed")).error).toBeNull();
  });

  it("N-5: layout preferences are capped at 4,000 bytes", async () => {
    expect((await m.client.from("profiles").update({ layout_prefs: { home: ["a", "b"] } }).eq("id", m.id)).error).toBeNull();
    const big = { x: "y".repeat(5000) };
    expect((await m.client.from("profiles").update({ layout_prefs: big }).eq("id", m.id)).error).not.toBeNull();
  });

  it("N-1: old sign-ins are ended at the auth server, by the server only", async () => {
    const fresh = anonClient();
    const signIn = await fresh.auth.signInWithPassword({ email: other.email, password: TEST_PASSWORD });
    expect(signIn.error).toBeNull();
    const refreshToken = signIn.data.session!.refresh_token;
    // A member can't call the function.
    expect((await m.client.rpc("expire_old_sessions", { p_max_age_days: 1 })).error).not.toBeNull();
    // Make that session 40 days old, then end sessions older than 30 days.
    sql(`update auth.sessions set created_at = now() - interval '40 days' where user_id = '${other.id}'`);
    const ended = await svc.rpc("expire_old_sessions", { p_max_age_days: 30 });
    expect(ended.error).toBeNull();
    expect(Number(ended.data)).toBeGreaterThanOrEqual(1);
    expect(sql(`select count(*) from auth.sessions where user_id = '${other.id}'`)).toBe("0");
    // Its refresh token no longer works.
    const again = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    expect(again.error).not.toBeNull();
    // Recent sessions are untouched.
    expect(sql(`select count(*) from auth.sessions where user_id = '${m.id}' and created_at > now() - interval '1 day'`)).not.toBe("0");
  });

  it("N-1: the API's Bearer path refuses a sign-in older than the maximum age", async () => {
    const { authenticateRequest } = await import("@/server/api-auth");
    const { NextRequest } = await import("next/server");
    const token = (await m.client.auth.getSession()).data.session!.access_token;
    const req = () => new NextRequest("http://localhost/api/v1/me", { headers: { authorization: `Bearer ${token}` } });
    const ok = await authenticateRequest(req());
    expect("error" in ok).toBe(false);
    // 31 days later (the token's own sign-in time is in its amr claim), the same token is refused.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    const late = await authenticateRequest(req());
    expect(late).toEqual({ error: "unauthorized" });
  });
});
