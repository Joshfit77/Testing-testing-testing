import { NextResponse, type NextRequest } from "next/server";
import { getStripe, handleStripeEvent } from "@/server/services/billing";
import { isServiceRoleConfigured, isStripeWebhookConfigured, serverEnv } from "@/server/env";
import { logError } from "@/server/log";
import { webhookErrorCode } from "@/server/services/webhook-events";

export const dynamic = "force-dynamic";

/** Stripe's event payloads are a few kilobytes; anything far larger isn't a genuine event. */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Stripe webhook. The signature is verified against the raw body before anything is processed. Answers:
 *   200 — processed now, or already processed before (duplicate delivery);
 *   409 — another delivery of the same event is being processed right now (Stripe retries later);
 *   400 — missing or invalid signature, or a malformed body; 413 — too large;
 *   500 — processing failed and was recorded; Stripe retries. Error bodies never carry details.
 */
export async function POST(request: NextRequest) {
  if (!isStripeWebhookConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, serverEnv.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!event || typeof event.id !== "string" || typeof event.type !== "string" || !event.data?.object) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  try {
    const outcome = await handleStripeEvent(event);
    if (outcome === "busy") return NextResponse.json({ error: "Event is being processed" }, { status: 409, headers: { "Retry-After": "60" } });
    return NextResponse.json({ received: true, duplicate: outcome === "duplicate" });
  } catch (err) {
    logError("stripe.webhook", err, { type: event.type, code: webhookErrorCode(err) });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
