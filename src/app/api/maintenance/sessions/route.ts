import { NextResponse, type NextRequest } from "next/server";
import { sessionMaxAgeDays } from "@/lib/auth/session-age";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/server/env";
import { logError, logInfo } from "@/server/log";
import { cronAuthorized } from "@/server/services/billing-reconcile";

export const dynamic = "force-dynamic";

/**
 * Scheduled job (run daily): ends sign-ins older than SESSION_MAX_AGE_DAYS (default 30) at the authentication server,
 * which also revokes their refresh tokens (migration 090, expire_old_sessions). Only a caller presenting
 * `Authorization: Bearer $CRON_SECRET` gets through; the reply holds a count only.
 */
async function run(request: NextRequest) {
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = sessionMaxAgeDays(process.env.SESSION_MAX_AGE_DAYS);
  const { data, error } = await getServiceSupabase().rpc("expire_old_sessions", { p_max_age_days: days });
  if (error) {
    logError("sessions.expire", error);
    return NextResponse.json({ error: "Session job failed" }, { status: 500 });
  }
  logInfo("sessions.expired", { days, ended: Number(data ?? 0) });
  return NextResponse.json({ days, ended: Number(data ?? 0) });
}

export const GET = run;
export const POST = run;
