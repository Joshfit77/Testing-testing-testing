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

export async function stackAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${url()}/auth/v1/health`, { headers: { apikey: anonKey() }, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
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
