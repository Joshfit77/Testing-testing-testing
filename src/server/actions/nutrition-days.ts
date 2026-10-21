"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

/**
 * Mark a diary day as complete, or as a day you ate nothing (a fast), so the weekly summary can tell a
 * day logged as zero from a day that wasn't logged. `status: null` removes the mark.
 */
export async function setDayMarkAction(input: unknown): Promise<ActionState> {
  try {
    const user = await requireUser();
    await assertFeature(user.id, "nutrition_tracking");
    const supabase = await getServerSupabase();
    const parsed = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["complete", "fasted"]).nullable() }).safeParse(input);
    if (!parsed.success) return actionError("Choose a day.");
    const { date, status } = parsed.data;
    if (status === "fasted") {
      const { count } = await supabase
        .from("meal_items")
        .select("id, meal:meals!inner(eaten_on, status, is_template)", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("meal.eaten_on", date)
        .eq("meal.status", "logged")
        .eq("meal.is_template", false)
        .gt("calories", 0);
      if (count) return actionError("This day already has food logged. Remove it first, or mark the day complete instead.");
    }
    const { error } = status
      ? await supabase.from("nutrition_day_marks").upsert({ user_id: user.id, day: date, status })
      : await supabase.from("nutrition_day_marks").delete().eq("user_id", user.id).eq("day", date);
    if (error) throw error;
    return actionOk(status === "complete" ? "Day marked complete." : status === "fasted" ? "Logged as a day you ate nothing." : "Mark removed.");
  } catch (err) {
    if (err instanceof EntitlementError) return actionError("Nutrition tracking is included with Plus and Pro.");
    logError("nutrition.day_mark", err);
    return actionError("Something went wrong. Please try again.");
  }
}
