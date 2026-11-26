import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function serviceClient(): SupabaseClient {
  return createClient(url(), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Whether the local Supabase stack is reachable. Suites skip themselves when it isn't, which is convenient on a laptop
 * without Docker but would let a broken CI job pass silently: with REQUIRE_TEST_STACK=1 (set in CI and by
 * `npm run verify`) an unreachable stack fails the run instead.
 */
export async function stackAvailable(): Promise<boolean> {
  let ok = false;
  try {
    const res = await fetch(`${url()}/auth/v1/health`, { headers: { apikey: anonKey() }, signal: AbortSignal.timeout(3000) });
    ok = res.ok;
  } catch {
    ok = false;
  }
  if (!ok && requireStack()) {
    throw new Error(`REQUIRE_TEST_STACK is set but the Supabase stack at ${url()} isn't reachable. Run \`npx supabase start\`.`);
  }
  return ok;
}

export function requireStack(): boolean {
  return process.env.REQUIRE_TEST_STACK === "1" || process.env.REQUIRE_TEST_STACK === "true";
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Create a confirmed user via the admin API and return a client signed in as them (RLS applies). */
export async function createTestUser(label: string, opts: { id?: string } = {}): Promise<TestUser> {
  const admin = serviceClient();
  const email = `it-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Integration-Test-1";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: label }, ...(opts.id ? { id: opts.id } : {}) });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (user) await serviceClient().auth.admin.deleteUser(user.id);
}

export async function exerciseIds(slugs: string[]): Promise<Record<string, string>> {
  const { data } = await serviceClient().from("exercises").select("id, slug").in("slug", slugs);
  return Object.fromEntries((data ?? []).map((e) => [e.slug as string, e.id as string]));
}

/** Give a test user a plan (as an admin grant), for tests of paid features: the database checks the plan too. */
export async function grantPlan(user: TestUser, plan: "plus" | "pro"): Promise<void> {
  const { error } = await serviceClient().from("user_entitlements").upsert({ user_id: user.id, plan, source: "admin" }, { onConflict: "user_id" });
  if (error) throw error;
}

/**
 * Snapshot today's and this month's global AI budget rows and alerts (migrations 066 and 081) and return a function that
 * puts them back. Suites that move global spend use it so they don't leave holds or spend behind for later suites.
 */
export async function snapshotAiBudgets(now = new Date()): Promise<() => Promise<void>> {
  const svc = serviceClient();
  const month = `${now.toISOString().slice(0, 7)}-01`;
  const day = now.toISOString().slice(0, 10);
  const [m, ma, d, da] = await Promise.all([
    svc.from("ai_budget_months").select("*").eq("month", month).maybeSingle(),
    svc.from("ai_budget_alerts").select("*").eq("month", month),
    svc.from("ai_budget_days").select("*").eq("day", day).maybeSingle(),
    svc.from("ai_budget_day_alerts").select("*").eq("day", day),
  ]);
  return async () => {
    await svc.from("ai_budget_alerts").delete().eq("month", month);
    if (ma.data?.length) await svc.from("ai_budget_alerts").insert(ma.data);
    if (m.data) await svc.from("ai_budget_months").upsert(m.data);
    else await svc.from("ai_budget_months").delete().eq("month", month);
    await svc.from("ai_budget_day_alerts").delete().eq("day", day);
    if (da.data?.length) await svc.from("ai_budget_day_alerts").insert(da.data);
    if (d.data) await svc.from("ai_budget_days").upsert(d.data);
    else await svc.from("ai_budget_days").delete().eq("day", day);
  };
}

/** RFC 6238 time-based one-time code (SHA-1, 30 s, 6 digits), as an authenticator app computes it, for tests. */
export function totpCode(secretBase32: string, at: number = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const n = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return n.toString().padStart(6, "0");
}

/**
 * Make a test user an administrator as the app requires (migration 085): role admin, plus an authenticator enrolled and
 * verified, so their client's session is at aal2. A password-only session of an admin has no admin rights.
 */
export async function makeAdmin(user: TestUser): Promise<{ factorId: string; secret: string }> {
  const { error: roleErr } = await serviceClient().from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (roleErr) throw roleErr;
  const { data, error } = await user.client.auth.mfa.enroll({ factorType: "totp", friendlyName: `test-${crypto.randomUUID().slice(0, 8)}` });
  if (error || !data) throw error ?? new Error("enroll failed");
  const { error: vErr } = await user.client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totpCode(data.totp.secret) });
  if (vErr) throw vErr;
  return { factorId: data.id, secret: data.totp.secret };
}

/**
 * Reserve a photo upload the way the app does before sending a file (migration 20261127000097): the progress-photos and
 * body-scans buckets only accept a file the member reserved. Returns 'ok', 'limit', or null when the call was refused.
 */
export async function reserveUpload(client: SupabaseClient, bucket: string, path: string): Promise<string | null> {
  const { data, error } = await client.rpc("reserve_storage_upload", { p_bucket: bucket, p_name: path });
  return error ? null : (data as string);
}
