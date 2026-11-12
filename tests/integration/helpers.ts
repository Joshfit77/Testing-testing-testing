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
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = serviceClient();
  const email = `it-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Integration-Test-1";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: label } });
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
