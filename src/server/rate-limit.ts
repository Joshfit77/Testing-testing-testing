import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/server/env";
import { logError, logInfo } from "@/server/log";

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * Per-instance sliding-window limiter. Only the fallback for when the shared limiter below can't be reached (no
 * service-role key, or a database error): on serverless hosting each instance counts only its own requests.
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
 * Burst limiter shared by every server instance: an atomic sliding-window counter in Postgres
 * (`rate_limit_hit`, service role only). If the database can't be used the per-instance limiter takes over, so an
 * outage weakens burst protection rather than blocking every member; the durable limits that protect money (the
 * monthly AI quota, reserved in the database before any provider call) fail closed on their own.
 *
 * Keys name the action and the member (or a hashed client address), never personal data in clear.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!isServiceRoleConfigured()) return rateLimitLocal(key, limit, windowMs);
  try {
    const { data, error } = await getServiceSupabase().rpc("rate_limit_hit", {
      p_key: key.slice(0, 200),
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; retry_after_seconds: number } | undefined;
    if (!row) throw new Error("rate_limit_hit returned no row");
    if (!row.allowed) logInfo("rate_limit.refused", { action: key.split(":")[0] ?? "unknown" });
    return { ok: Boolean(row.allowed), retryAfterSeconds: row.allowed ? 0 : Math.max(1, Number(row.retry_after_seconds) || 1) };
  } catch (err) {
    logError("rate_limit.shared", err);
    return rateLimitLocal(key, limit, windowMs);
  }
}

/** Checks several limits in order and returns the first one that is exceeded. */
export async function rateLimitAll(checks: { key: string; limit: number; windowMs: number }[]): Promise<RateLimitResult> {
  for (const c of checks) {
    const r = await rateLimit(c.key, c.limit, c.windowMs);
    if (!r.ok) return r;
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client address from the hosting platform's proxy headers (for limits on signed-out requests). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Stable, non-reversible key part for an identifier such as an email address or IP (counters never store it). */
export function hashKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}
