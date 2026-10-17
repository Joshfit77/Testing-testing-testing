import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";

/** Supabase client bound to the current user's cookie session (RLS applies). */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Supabase client authenticated with a bearer access token (for native/mobile API clients; RLS applies). */
export function getTokenSupabase(accessToken: string) {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client. Bypasses RLS — use only for trusted server operations
 * (Stripe webhooks, metering, account deletion, admin aggregate views) and always
 * scope queries explicitly.
 */
export function getServiceSupabase() {
  if (!serverEnv.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
