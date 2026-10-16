import "server-only";
import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getServerSupabase, getTokenSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export interface ApiAuth {
  user: User;
  supabase: SupabaseClient;
  via: "cookie" | "bearer";
}

/**
 * Authenticate an API request.
 * - Native/mobile clients send `Authorization: Bearer <supabase access token>` (not CSRF-prone).
 * - Browser requests use the cookie session; state-changing methods must be same-origin (CSRF protection).
 */
export async function authenticateRequest(request: NextRequest): Promise<ApiAuth | { error: "unauthorized" | "forbidden_origin" }> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    const supabase = getTokenSupabase(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { error: "unauthorized" };
    return { user: data.user, supabase, via: "bearer" };
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !isSameOrigin(request)) return { error: "forbidden_origin" };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: "unauthorized" };
  return { user: data.user, supabase, via: "cookie" };
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  const allowed = new Set([request.nextUrl.origin, publicEnv.siteUrl]);
  return allowed.has(origin);
}
