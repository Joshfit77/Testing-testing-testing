import { NextResponse, type NextRequest } from "next/server";
import { revenueCatWebhookSchema } from "@/lib/billing/revenuecat";
import { isRevenueCatWebhookConfigured, isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";
import { handleRevenueCatEvent, webhookAuthorized } from "@/server/services/store-billing";

export const dynamic = "force-dynamic";

/**
 * RevenueCat webhook (App Store / Google Play subscription events). Authenticated by the Authorization header
 * value configured in the RevenueCat dashboard. Only a 200 counts as delivered; anything else is retried.
 */
export async function POST(request: NextRequest) {
  if (!isRevenueCatWebhookConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!webhookAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const text = await request.text();
  if (text.length > 256_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = revenueCatWebhookSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  try {
    const processed = await handleRevenueCatEvent(parsed.data);
    return NextResponse.json({ received: true, duplicate: !processed });
  } catch (err) {
    logError("revenuecat.webhook", err, { type: parsed.data.event.type });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
