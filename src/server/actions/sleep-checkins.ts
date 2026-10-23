"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { DISTURBANCES, EXERCISE_TIMINGS, RATING_FIELDS, type RatingField } from "@/lib/domain/sleep-checkins";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const refresh = () => {
  for (const p of ["/progress/sleep", "/progress", "/home"]) revalidatePath(p);
  revalidatePath("/progress/sleep", "layout");
};

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const rating = z.preprocess(blank, z.coerce.number().int().min(1).max(5).optional());
const yesNo = z.preprocess(blank, z.enum(["yes", "no"]).optional());
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a day");

const checkinSchema = z.object({
  day,
  restedness: rating,
  energy_morning: rating,
  energy_afternoon: rating,
  energy_evening: rating,
  mood: rating,
  stress: rating,
  sleep_quality: rating,
  caffeine_last: z.preprocess(blank, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 14:30").optional()),
  caffeine_none: z.preprocess(blank, z.literal("on").optional()),
  alcohol: yesNo,
  late_meal: yesNo,
  exercise_timing: z.preprocess(blank, z.enum(EXERCISE_TIMINGS).optional()),
  evening_screens: yesNo,
  travel: yesNo,
  sleep_aid: z.string().trim().max(120, "Keep this under 120 characters").optional().default(""),
  notes: z.string().trim().max(280, "Keep notes under 280 characters").optional().default(""),
  returnTo: z.string().optional(),
});

const tri = (v: "yes" | "no" | undefined) => (v === undefined ? null : v === "yes");

async function ctx() {
  const user = await requireUser();
  const [profile, supabase] = await Promise.all([getProfile(user.id), getServerSupabase()]);
  const tz = profile?.timezone ?? "UTC";
  return { user, supabase, today: isoDateInTz(new Date(), tz), consented: Boolean(profile?.wellness_consent_at) };
}

function dayInRange(d: string, today: string): boolean {
  return d <= addDays(today, 1) && d >= addDays(today, -60);
}

/** Save (or clear) the check-in for a day. Every field is optional; a check-in with nothing in it is removed. */
export async function saveSleepCheckinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase, today, consented } = await ctx();
  if (!consented) return actionError("Check-ins store optional wellness information. Allow sleep logging first.");
  const disturbances = formData.getAll("disturbances").map(String);
  const parsed = checkinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  if (!dayInRange(v.day, today)) return actionError("Check-ins can be entered for the last 60 days.", { day: "Out of range" });
  if (disturbances.some((d) => !(DISTURBANCES as readonly string[]).includes(d))) return actionError("Unknown disturbance.");
  const ratings = Object.fromEntries(RATING_FIELDS.map((f) => [f, v[f] ?? null])) as Record<RatingField, number | null>;
  const row = {
    user_id: user.id,
    day: v.day,
    ...ratings,
    caffeine_last: v.caffeine_none ? null : (v.caffeine_last ?? null),
    alcohol: tri(v.alcohol),
    late_meal: tri(v.late_meal),
    exercise_timing: v.exercise_timing ?? null,
    evening_screens: tri(v.evening_screens),
    disturbances,
    travel: tri(v.travel),
    sleep_aid: v.sleep_aid || null,
    notes: v.notes || null,
  };
  const empty = RATING_FIELDS.every((f) => ratings[f] === null) && row.caffeine_last === null && row.alcohol === null && row.late_meal === null && row.exercise_timing === null && row.evening_screens === null && disturbances.length === 0 && row.travel === null && !row.sleep_aid && !row.notes;
  const { error } = empty
    ? await supabase.from("sleep_checkins").delete().eq("user_id", user.id).eq("day", v.day)
    : await supabase.from("sleep_checkins").upsert(row, { onConflict: "user_id,day" });
  if (error) {
    logError("sleep.checkin.save", error);
    return actionError("Couldn't save your check-in. Please try again.");
  }
  refresh();
  const to = v.returnTo && v.returnTo.startsWith("/progress/sleep") ? v.returnTo : "/progress/sleep";
  redirect(`${to}${to.includes("?") ? "&" : "?"}saved=${empty ? "cleared" : "checkin"}`);
}

const quickSchema = z.object({ day, restedness: z.coerce.number().int().min(1).max(5) });

/** The one-tap morning check-in on the dashboard: just restedness. Keeps anything else already recorded for the day. */
export async function quickRestednessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase, today, consented } = await ctx();
  if (!consented) return actionError("Check-ins store optional wellness information. Allow sleep logging first.");
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  if (!dayInRange(parsed.data.day, today)) return actionError("That day is out of range.");
  const { error } = await supabase.from("sleep_checkins").upsert({ user_id: user.id, day: parsed.data.day, restedness: parsed.data.restedness }, { onConflict: "user_id,day" });
  if (error) {
    logError("sleep.checkin.quick", error);
    return actionError("Couldn't save. Please try again.");
  }
  refresh();
  return actionOk(`Noted: rested ${parsed.data.restedness} out of 5.`);
}

/** Remove a day's check-in. Used by one-click buttons. */
export async function deleteSleepCheckinAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = day.safeParse(formData.get("day"));
  if (!parsed.success) return;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("sleep_checkins").delete().eq("user_id", user.id).eq("day", parsed.data);
  if (error) logError("sleep.checkin.delete", error);
  refresh();
}
