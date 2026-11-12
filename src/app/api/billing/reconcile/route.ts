import { NextResponse, type NextRequest } from "next/server";
import { isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";
import { cronAuthorized, reconcileBilling } from "@/server/services/billing-reconcile";

export const dynamic = "force-dynamic";

/**
 * Scheduled billing reconciliation (see src/server/services/billing-reconcile.ts). Only a caller presenting
 * `Authorization: Bearer $CRON_SECRET` gets through; the reply holds counts only, never member data.
 */
async function run(request: NextRequest) {
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await reconcileBilling());
  } catch (err) {
    logError("billing.reconcile", err);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
