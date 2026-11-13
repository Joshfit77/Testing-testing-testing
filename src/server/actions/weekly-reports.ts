"use server";

import { revalidatePath } from "next/cache";
import { isValidWeekStart } from "@/lib/domain/weekly-report";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";

type Result = { ok: true } | { ok: false; error: string };

/** Delete one of the member's own weekly reports (RLS limits it to their rows). Their records are not touched. */
export async function deleteWeeklyReportAction(weekStart: string): Promise<Result> {
  const user = await requireUser();
  if (!isValidWeekStart(weekStart)) return { ok: false, error: "That report doesn't exist." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("weekly_reports").delete().eq("user_id", user.id).eq("week_start", weekStart);
  if (error) {
    logError("weekly_report.delete", error);
    return { ok: false, error: "Couldn't delete the report. Please try again." };
  }
  revalidatePath("/progress/reports");
  return { ok: true };
}
