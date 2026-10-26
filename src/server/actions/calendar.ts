"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { checkMove } from "@/lib/domain/training-schedule";
import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature } from "@/lib/domain/plans";
import { getProfile, getUserPlan, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { loadProgramSchedule } from "@/server/services/schedule";

const moveSchema = z.object({
  dayId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
});

/**
 * Move a planned (not yet completed) session of the active program to another date. Completed
 * workouts are never touched: only sessions from the program pointer onwards can be moved, and the
 * override is keyed by the enrolment + program day. Moving it back to its usual date removes the
 * override. The client refreshes the route afterwards. Rescheduling is a Pro feature.
 */
export async function movePlannedSessionAction(input: { dayId: string; date: string }): Promise<ActionState> {
  const user = await requireUser();
  if (!hasFeature(await getUserPlan(user.id), "advanced_calendar")) return actionError("Moving sessions to other days is included with Pro All Access.");
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Choose a date.");
  const profile = await getProfile(user.id);
  const supabase = await getServerSupabase();
  const schedule = await loadProgramSchedule(supabase, user.id, profile?.timezone ?? "UTC");
  if (!schedule) return actionError("There's no active program to reschedule.");
  const check = checkMove(schedule.planned, schedule.overrides, parsed.data.dayId, parsed.data.date, schedule.today);
  if (!check.ok) return actionError(check.reason);

  const base = supabase.from("planned_session_overrides");
  const { error } =
    check.store === null
      ? await base.delete().eq("user_id", user.id).eq("user_program_id", schedule.userProgramId).eq("program_day_id", parsed.data.dayId)
      : await base.upsert(
          { user_id: user.id, user_program_id: schedule.userProgramId, program_day_id: parsed.data.dayId, planned_date: check.store },
          { onConflict: "user_program_id,program_day_id" },
        );
  if (error) {
    logError("calendar.move", error);
    return actionError("Couldn't move the session. Please try again.");
  }
  if (check.clear.length) {
    const { error: clearErr } = await supabase
      .from("planned_session_overrides")
      .delete()
      .eq("user_id", user.id)
      .eq("user_program_id", schedule.userProgramId)
      .in("program_day_id", check.clear);
    if (clearErr) logError("calendar.move.clear", clearErr);
  }
  const label = new Date(`${parsed.data.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  return actionOk(check.store === null ? `Back on its usual day, ${label}.` : `Moved to ${label}.`);
}

/** Put a moved session back on its default date. Allowed on every plan, so a downgrade never strands a move. */
export async function resetPlannedSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dayId = z.string().uuid().safeParse(formData.get("dayId"));
  if (!dayId.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("planned_session_overrides").delete().eq("user_id", user.id).eq("program_day_id", dayId.data);
}
