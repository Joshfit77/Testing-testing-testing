import { NextResponse, type NextRequest } from "next/server";
import { isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";
import { cronAuthorized } from "@/server/services/billing-reconcile";
import { runWeeklyReportJob } from "@/server/services/weekly-reports";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled weekly-report job (run hourly): creates each Pro member's report once their local time reaches Sunday
 * 18:00. Only a caller presenting `Authorization: Bearer $CRON_SECRET` gets through; the reply holds counts only.
 */
async function run(request: NextRequest) {
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runWeeklyReportJob());
  } catch (err) {
    logError("weekly_report.job", err);
    return NextResponse.json({ error: "Weekly report job failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
