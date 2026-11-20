import type { NextRequest } from "next/server";
import { clientIpFrom, hashKey, rateLimit } from "@/server/rate-limit";
import { authRateLimitScale } from "@/server/test-overrides";

/** Email-link openings allowed per client address: far above any person's use, low enough to stop token guessing. */
export const AUTH_LINK_LIMIT = { limit: 30, windowMs: 5 * 60_000 };

/**
 * The email-link routes (/auth/confirm, /auth/callback) call Supabase from our server, so Supabase's own per-address
 * limit on token checks counts the server's address: one client flooding them with made-up tokens could use it up for
 * everyone. This limits each client address before Supabase is called. No address from the platform: no limit (so
 * unrelated people never share one counter).
 */
export async function authLinkLimited(request: NextRequest): Promise<boolean> {
  const ip = clientIpFrom(request.headers);
  if (ip === "unknown") return false;
  const r = await rateLimit(`authlink:ip:${hashKey(ip)}`, AUTH_LINK_LIMIT.limit * authRateLimitScale(), AUTH_LINK_LIMIT.windowMs);
  return !r.ok;
}
