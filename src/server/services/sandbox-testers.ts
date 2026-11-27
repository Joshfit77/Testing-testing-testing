import "server-only";
import { getServiceSupabase } from "@/lib/supabase/server";
import { serverEnv } from "@/server/env";

/**
 * Who may unlock a plan with an App Store / Google Play **sandbox** purchase (development builds, TestFlight, App
 * Review). Sandbox purchases are free, so they count only for accounts an administrator put on the allow-list
 * (`sandbox_testers`, migration 052), by user id, or for everyone where REVENUECAT_ALLOW_SANDBOX=true (a separate
 * test deployment only). Checked when RevenueCat is read and again on every plan recompute.
 */
export async function sandboxPurchasesAllowed(userId: string): Promise<boolean> {
  if (serverEnv.revenueCatAllowSandbox) return true;
  const { data, error } = await getServiceSupabase().rpc("is_sandbox_tester", { p_user_id: userId });
  if (error) throw error;
  return data === true;
}

export interface SandboxTester {
  userId: string;
  displayName: string | null;
  note: string;
  expiresAt: string | null;
  createdAt: string;
  active: boolean;
}

export async function listSandboxTesters(): Promise<SandboxTester[]> {
  const admin = getServiceSupabase();
  const { data, error } = await admin.from("sandbox_testers").select("user_id, note, expires_at, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length ? await admin.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]));
  const now = Date.now();
  return (data ?? []).map((r) => ({
    userId: r.user_id as string,
    displayName: names.get(r.user_id as string) ?? null,
    note: r.note as string,
    expiresAt: (r.expires_at as string | null) ?? null,
    createdAt: r.created_at as string,
    active: !r.expires_at || new Date(r.expires_at as string).getTime() > now,
  }));
}

/** The account's user id for an email address or a user id, or null when there is no such account. */
export async function resolveAccount(emailOrId: string): Promise<string | null> {
  const admin = getServiceSupabase();
  const value = emailOrId.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    const { data } = await admin.from("profiles").select("id").eq("id", value).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }
  // The email is only used to find the account; the allow-list stores the id.
  const email = value.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function addSandboxTester(input: { userId: string; note: string; expiresAt: string | null; addedBy: string }): Promise<void> {
  const { error } = await getServiceSupabase()
    .from("sandbox_testers")
    .upsert({ user_id: input.userId, note: input.note, expires_at: input.expiresAt, added_by: input.addedBy }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function removeSandboxTester(userId: string): Promise<void> {
  const { error } = await getServiceSupabase().from("sandbox_testers").delete().eq("user_id", userId);
  if (error) throw error;
}
