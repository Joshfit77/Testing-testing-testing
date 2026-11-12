"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CHALLENGE_DAYS, CHALLENGE_SLUG } from "@/data/devotionals";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { canCheckIn, challengeDayNumber, isChallengeComplete } from "@/lib/domain/challenge";
import { isoDateInTz } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const uuid = z.string().uuid();

const checkinSchema = z.object({
  enrollmentId: uuid,
  dayNumber: z.coerce.number().int().min(1).max(CHALLENGE_DAYS),
  devotionalDone: z.boolean(),
  workoutDone: z.boolean(),
  note: z.string().trim().max(1000, "Keep your note under 1,000 characters").optional().default(""),
});

/** Faith is always available (SPEC §12): every signed-in user can take part in the challenge. */
async function requireFaithUser() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return null;
  return { user, timezone: profile.timezone || "UTC" };
}

function revalidate() {
  revalidatePath("/faith");
  revalidatePath("/home");
}

export async function startChallengeAction(_formData: FormData): Promise<ActionState> {
  const ctx = await requireFaithUser();
  if (!ctx) return actionError("Please sign in again to join the challenge.");
  const supabase = await getServerSupabase();
  const { data: existing } = await supabase
    .from("challenge_enrollments")
    .select("id")
    .eq("user_id", ctx.user.id)
    .eq("challenge_slug", CHALLENGE_SLUG)
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    revalidate();
    return actionOk("You're already in the challenge.");
  }
  const { error } = await supabase
    .from("challenge_enrollments")
    .insert({ user_id: ctx.user.id, challenge_slug: CHALLENGE_SLUG, started_on: isoDateInTz(new Date(), ctx.timezone) });
  if (error) {
    logError("challenge.start", error);
    return actionError("Couldn't start the challenge. Please try again.");
  }
  revalidate();
  return actionOk("Day 1 starts today. Welcome to the narrow way.");
}

async function abandonActive(userId: string): Promise<boolean> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("challenge_enrollments")
    .update({ status: "abandoned" })
    .eq("user_id", userId)
    .eq("challenge_slug", CHALLENGE_SLUG)
    .eq("status", "active");
  if (error) logError("challenge.abandon", error);
  return !error;
}

export async function leaveChallengeAction(_formData: FormData): Promise<ActionState> {
  const ctx = await requireFaithUser();
  if (!ctx) return actionError("Please sign in again to manage the challenge.");
  if (!(await abandonActive(ctx.user.id))) return actionError("Couldn't leave the challenge. Please try again.");
  revalidate();
  return actionOk("You've left the challenge. You can start again any time.");
}

export async function restartChallengeAction(formData: FormData): Promise<ActionState> {
  const ctx = await requireFaithUser();
  if (!ctx) return actionError("Please sign in again to manage the challenge.");
  if (!(await abandonActive(ctx.user.id))) return actionError("Couldn't restart the challenge. Please try again.");
  return startChallengeAction(formData);
}

export async function saveChallengeCheckinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireFaithUser();
  if (!ctx) return actionError("Please sign in again to use the challenge.");
  const parsed = checkinSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    dayNumber: formData.get("dayNumber"),
    devotionalDone: formData.get("devotionalDone") === "on",
    workoutDone: formData.get("workoutDone") === "on",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;

  const supabase = await getServerSupabase();
  const { data: enrollment } = await supabase
    .from("challenge_enrollments")
    .select("id, started_on, status")
    .eq("id", v.enrollmentId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!enrollment || enrollment.status !== "active") return actionError("This challenge is no longer active.");

  const today = isoDateInTz(new Date(), ctx.timezone);
  const currentDay = challengeDayNumber(enrollment.started_on as string, today);
  if (!canCheckIn(v.dayNumber, currentDay)) return actionError(`Day ${v.dayNumber} hasn't started yet.`);

  const { error } = await supabase.from("challenge_checkins").upsert(
    {
      enrollment_id: v.enrollmentId,
      user_id: ctx.user.id,
      day_number: v.dayNumber,
      devotional_done: v.devotionalDone,
      workout_done: v.workoutDone,
      note: v.note || null,
      checked_on: today,
    },
    { onConflict: "enrollment_id,day_number" },
  );
  if (error) {
    logError("challenge.checkin", error);
    return actionError("Couldn't save your check-in. Please try again.");
  }

  const { data: rows } = await supabase
    .from("challenge_checkins")
    .select("day_number, devotional_done, workout_done")
    .eq("enrollment_id", v.enrollmentId)
    .eq("user_id", ctx.user.id);
  if (isChallengeComplete((rows ?? []) as { day_number: number; devotional_done: boolean; workout_done: boolean }[])) {
    const { error: doneErr } = await supabase
      .from("challenge_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", v.enrollmentId)
      .eq("user_id", ctx.user.id);
    if (doneErr) {
      logError("challenge.complete", doneErr);
      return actionError("Your check-in was saved, but we couldn't mark the challenge complete. Please try again.");
    }
    revalidate();
    return actionOk("You finished all 40 days! Give thanks for His grace along the way, and keep walking the narrow way.");
  }

  revalidate();
  const both = v.devotionalDone && v.workoutDone;
  return actionOk(both ? `Day ${v.dayNumber} complete.` : `Day ${v.dayNumber} saved.`);
}
