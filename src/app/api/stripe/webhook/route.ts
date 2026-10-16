import { NextResponse, type NextRequest } from "next/server";
import { getStripe, handleStripeEvent } from "@/server/services/billing";
import { isServiceRoleConfigured, isStripeWebhookConfigured, serverEnv } from "@/server/env";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

/** Stripe webhook. The signature is verified against the raw body before anything is processed. */
export async function POST(request: NextRequest) {
  if (!isStripeWebhookConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const body = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, serverEnv.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const processed = await handleStripeEvent(event);
    return NextResponse.json({ received: true, duplicate: !processed });
  } catch (err) {
    logError("stripe.webhook", err, { type: event.type });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
