import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * In-memory sliding-window limiter. Per server instance only, so it is the fallback when the shared
 * database limiter is unavailable (no service-role key, or a database error).
 */
const buckets = new Map<string, number[]>();

export function rateLimitLocal(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - hits[0]!)) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Burst limiter shared by every server instance (fixed window in Postgres via `rate_limit_hit`).
 * Falls back to the per-instance limiter if the database can't be used, so a database hiccup
 * degrades protection instead of blocking every request. Durable quotas (e.g. monthly AI usage)
 * are enforced separately.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!isServiceRoleConfigured()) return rateLimitLocal(key, limit, windowMs);
  try {
    const { data, error } = await getServiceSupabase().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; retry_after_seconds: number } | undefined;
    if (!row) throw new Error("rate_limit_hit returned no row");
    return { ok: row.allowed, retryAfterSeconds: row.allowed ? 0 : row.retry_after_seconds };
  } catch (err) {
    logError("rate_limit.shared", err);
    return rateLimitLocal(key, limit, windowMs);
  }
}

/** Best-effort client IP from the proxy headers set by the hosting platform. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Stable, non-reversible key part for an identifier such as an email address (so counters never store it). */
export function hashKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** Checks several limits in order and returns the first one that is exceeded. */
export async function rateLimitAll(checks: { key: string; limit: number; windowMs: number }[]): Promise<RateLimitResult> {
  for (const c of checks) {
    const r = await rateLimit(c.key, c.limit, c.windowMs);
    if (!r.ok) return r;
  }
  return { ok: true, retryAfterSeconds: 0 };
}
