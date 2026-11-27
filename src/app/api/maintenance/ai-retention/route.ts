import { NextResponse, type NextRequest } from "next/server";
import { isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";
import { purgeExpiredAiChats } from "@/server/services/ai-retention";
import { cronAuthorized } from "@/server/services/billing-reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled AI-conversation retention job (run daily): deletes AI messages older than AI_CHAT_RETENTION_DAYS
 * (src/server/services/ai-retention.ts). Does nothing while that is unset. Only a caller presenting
 * `Authorization: Bearer $CRON_SECRET` gets through; the reply holds counts only.
 */
async function run(request: NextRequest) {
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await purgeExpiredAiChats());
  } catch (err) {
    logError("ai_retention.job", err);
    return NextResponse.json({ error: "AI retention job failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
