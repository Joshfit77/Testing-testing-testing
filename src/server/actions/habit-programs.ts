"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getHabitProgram } from "@/data/habit-programs";
import { isoDateInTz, isValidTimeZone } from "@/lib/domain/dates";
import { activitiesForDay, habitDayNumber, habitProgress } from "@/lib/domain/habit-programs";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, getUserPlan, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { autoCheckins, listHabitCheckins } from "@/server/services/habit-programs";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function context() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const tz = profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : "UTC";
  return { user, tz, supabase: await getServerSupabase() };
}

/** Start a habit program today (Pro). One active enrollment per program; earlier ones are kept as history. */
export async function startHabitProgramAction(slug: string): Promise<Result> {
  const { user, tz, supabase } = await context();
  const program = getHabitProgram(slug);
  if (!program) return { ok: false, error: "That program doesn't exist." };
  if (!hasFeature(await getUserPlan(user.id), "full_program_library")) return { ok: false, error: "Structured programs are included with Pro." };
  const goals = Object.fromEntries(program.goalFields.map((g) => [g.key, g.default]));
  const { error } = await supabase.from("habit_program_enrollments").insert({ user_id: user.id, program_slug: slug, started_on: isoDateInTz(new Date(), tz), goals });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You're already doing this program." };
    logError("habit.start", error);
    return { ok: false, error: "Couldn't start the program. Please try again." };
  }
  revalidatePath("/train/habits");
  return { ok: true };
}

const toggleSchema = z.object({
  enrollmentId: z.string().uuid(),
  day: z.number().int().min(1).max(120),
  key: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  done: z.boolean(),
  answer: z.string().trim().max(500).optional(),
});

/** Tick an activity on or off for a day up to today (never a future day). Weekly items may be ticked on any day of their week. */
export async function setHabitActivityAction(input: z.infer<typeof toggleSchema>): Promise<Result> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { enrollmentId, day, key, done, answer } = parsed.data;
  const { user, tz, supabase } = await context();
  const { data: enr } = await supabase.from("habit_program_enrollments").select("id, program_slug, started_on, status").eq("id", enrollmentId).eq("user_id", user.id).maybeSingle();
  if (!enr) return { ok: false, error: "That program enrollment doesn't exist." };
  if (enr.status !== "active") return { ok: false, error: "This program has ended. Your records stay here to read." };
  const program = getHabitProgram(enr.program_slug as string);
  if (!program) return { ok: false, error: "That program doesn't exist." };
  const today = habitDayNumber(enr.started_on as string, isoDateInTz(new Date(), tz));
  if (day > Math.min(today, program.days)) return { ok: false, error: "You can't tick off a day that hasn't come yet." };
  const { daily, weekly } = activitiesForDay(program, day);
  if (![...daily, ...weekly].some((a) => a.key === key)) return { ok: false, error: "That activity isn't part of this day." };
  if (done) {
    const { error } = await supabase
      .from("habit_program_checkins")
      .upsert({ enrollment_id: enrollmentId, user_id: user.id, day_number: day, activity_key: key, answer: answer || null, checked_on: isoDateInTz(new Date(), tz) }, { onConflict: "enrollment_id,day_number,activity_key", ignoreDuplicates: !answer });
    if (error) {
      logError("habit.tick", error);
      return { ok: false, error: error.code === "42501" ? "Ticking off activities is included with Pro." : "Couldn't save. Please try again." };
    }
  } else {
    const { error } = await supabase.from("habit_program_checkins").delete().eq("enrollment_id", enrollmentId).eq("user_id", user.id).eq("day_number", day).eq("activity_key", key);
    if (error) return { ok: false, error: "Couldn't save. Please try again." };
  }
  // Mark the program complete once its completion criteria are met (only ever moves forward).
  const [manual, auto] = await Promise.all([listHabitCheckins(supabase, user.id, enrollmentId), autoCheckins(supabase, user.id, program, enr.started_on as string, Math.min(today, program.days), tz)]);
  const progress = habitProgress(program, enr.started_on as string, isoDateInTz(new Date(), tz), [...manual, ...auto]);
  if (progress.complete) await supabase.from("habit_program_enrollments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", enrollmentId).eq("user_id", user.id);
  revalidatePath(`/train/habits/${enr.program_slug}`);
  return { ok: true };
}

/** Change the member's own targets for this program (validated against the program's goal fields). */
export async function updateHabitGoalsAction(enrollmentId: string, goals: Record<string, number>): Promise<Result> {
  const { user, supabase } = await context();
  if (!z.string().uuid().safeParse(enrollmentId).success) return { ok: false, error: "Invalid request." };
  const { data: enr } = await supabase.from("habit_program_enrollments").select("program_slug").eq("id", enrollmentId).eq("user_id", user.id).maybeSingle();
  const program = enr ? getHabitProgram(enr.program_slug as string) : undefined;
  if (!program) return { ok: false, error: "That program doesn't exist." };
  const clean: Record<string, number> = {};
  for (const f of program.goalFields) {
    const v = Number(goals[f.key]);
    if (!Number.isFinite(v) || v < f.min || v > f.max) return { ok: false, error: `${f.label} must be between ${f.min} and ${f.max} ${f.unit}.` };
    clean[f.key] = Math.round(v);
  }
  const { error } = await supabase.from("habit_program_enrollments").update({ goals: clean }).eq("id", enrollmentId).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't save your goals. Please try again." };
  revalidatePath(`/train/habits/${enr!.program_slug}`);
  return { ok: true, message: "Goals updated." };
}

/** Stop a program. What was recorded stays as history; the program can be started again later from day 1. */
export async function stopHabitProgramAction(enrollmentId: string): Promise<Result> {
  const { user, supabase } = await context();
  if (!z.string().uuid().safeParse(enrollmentId).success) return { ok: false, error: "Invalid request." };
  const { data, error } = await supabase
    .from("habit_program_enrollments")
    .update({ status: "stopped", stopped_at: new Date().toISOString() })
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("program_slug")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't stop the program. Please try again." };
  revalidatePath(`/train/habits/${data.program_slug}`);
  revalidatePath("/train/habits");
  return { ok: true };
}
