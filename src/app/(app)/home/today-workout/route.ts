import { NextResponse } from "next/server";
import { isoDateInTz } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser, getProfile } from "@/server/auth";
import { logError } from "@/server/log";
import { loadProgramSchedule } from "@/server/services/schedule";
import { getActiveProgram } from "@/server/services/training";
import { BLANK_WORKOUT_HREF, todayWorkoutLink, type TodayWorkoutLink } from "./link";

export const dynamic = "force-dynamic";

/**
 * GET /home/today-workout: Quick add's workout tile asks where "today's workout" starts, so a member with a program
 * day due opens that session from any screen instead of an empty workout. Read-only; the member's own data only.
 */
export async function GET() {
  const blank: TodayWorkoutLink = { href: BLANK_WORKOUT_HREF, due: false, name: null };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(blank, { status: 401 });
  try {
    const supabase = await getServerSupabase();
    const profile = await getProfile(user.id);
    const timezone = profile?.timezone ?? "UTC";
    const [active, schedule] = await Promise.all([getActiveProgram(supabase, user.id), loadProgramSchedule(supabase, user.id, timezone).catch(() => null)]);
    return NextResponse.json(todayWorkoutLink(active, schedule, isoDateInTz(new Date(), timezone)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logError("home.todayWorkout", err);
    return NextResponse.json(blank, { headers: { "Cache-Control": "no-store" } });
  }
}
