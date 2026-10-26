import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";
import { exportUserData } from "@/server/services/account";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** Download all of the signed-in user's data as JSON. An export reads every table the member owns, so a few an hour is plenty. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = rateLimit(`export:${user.id}`, 3, 60 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Please wait before exporting again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const supabase = await getServerSupabase();
    const data = await exportUserData(supabase, user.id, user.email);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="narrow-gate-fitness-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logError("account.export", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
