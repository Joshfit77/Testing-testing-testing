import "server-only";
import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Claim-based processing of provider webhooks (Stripe, RevenueCat). See
 * supabase/migrations/20261101000046_billing_integrity.sql: an event is `processing` under a short lease while one
 * delivery works on it, `processed` once its changes are saved, and `failed` (kept, with a short error code) when
 * they weren't, so the provider's next retry can claim it again. A delivery that finds the lease held by another
 * is answered "busy" (the route replies 409 so the provider retries later) instead of "already done".
 */
export type WebhookProvider = "stripe" | "revenuecat";
export type ClaimResult = "claimed" | "duplicate" | "busy";
export type WebhookOutcome = "processed" | "duplicate" | "busy";

/** How long one delivery may hold an event before another delivery may take it over. */
export const WEBHOOK_LEASE_SECONDS = 120;

export async function claimWebhookEvent(provider: WebhookProvider, eventId: string, type: string, environment?: string | null): Promise<ClaimResult> {
  const { data, error } = await getServiceSupabase().rpc("claim_webhook_event", {
    p_provider: provider,
    p_event_id: eventId,
    p_type: type,
    p_environment: environment ?? null,
    p_lease_seconds: WEBHOOK_LEASE_SECONDS,
  });
  if (error) throw error;
  if (data !== "claimed" && data !== "duplicate" && data !== "busy") throw new Error("Unexpected webhook claim result");
  return data;
}

export async function finishWebhookEvent(provider: WebhookProvider, eventId: string, ok: boolean, err?: unknown): Promise<void> {
  const { error } = await getServiceSupabase().rpc("finish_webhook_event", {
    p_provider: provider,
    p_event_id: eventId,
    p_ok: ok,
    p_error: ok ? null : webhookErrorCode(err),
  });
  if (error) throw error;
}

/**
 * A short, non-sensitive description of a processing error for the event row: the error's class and code or HTTP
 * status only, never its message (which can carry customer or provider details).
 */
export function webhookErrorCode(err: unknown): string {
  const e = (err ?? {}) as { name?: unknown; code?: unknown; status?: unknown; statusCode?: unknown; type?: unknown };
  const parts = [typeof e.name === "string" ? e.name : "Error"];
  for (const v of [e.code, e.type, e.statusCode ?? e.status]) if (typeof v === "string" || typeof v === "number") parts.push(String(v));
  return parts.join(":").replace(/[^\w:.-]/g, "").slice(0, 120);
}

/** Run a claimed event's work, recording success or failure. A failure is rethrown so the route answers 500. */
export async function processClaimedEvent(provider: WebhookProvider, eventId: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    try {
      await finishWebhookEvent(provider, eventId, false, err);
    } catch {
      // The lease expires on its own; the provider's retry can claim the event then.
    }
    throw err;
  }
  await finishWebhookEvent(provider, eventId, true);
}
