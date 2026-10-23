"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { isoDateInTz } from "@/lib/domain/dates";
import {
  findOverlap,
  formatDuration,
  isValidTimeZone,
  MAX_AWAKENINGS,
  MIN_SESSION_MINUTES,
  minutesBetween,
  nightOf,
  SLEEP_GOAL_MAX_MINUTES,
  SLEEP_GOAL_MIN_MINUTES,
  SLEEP_KINDS,
  TIMER_AUTO_CLOSE_HOURS,
  validateSleepSession,
  zonedTimeToIso,
  type SleepSessionTimes,
} from "@/lib/domain/sleep";
import { alarmConfigFromForm, alarmConfigSchema, describeAlarm, parseAlarmConfig, type AlarmConfig } from "@/lib/domain/sleep-alarm";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getRunningSleepSession, getSleepSession, listSleepSessions } from "@/server/services/sleep";

const SLEEP_PATHS = ["/progress/sleep", "/progress", "/home"];
const refresh = () => {
  for (const p of SLEEP_PATHS) revalidatePath(p);
  revalidatePath("/progress/sleep", "layout");
};

async function sleepCtx() {
  const user = await requireUser();
  const [profile, supabase] = await Promise.all([getProfile(user.id), getServerSupabase()]);
  return { user, profile, supabase, tz: profile?.timezone ?? "UTC", consented: Boolean(profile?.wellness_consent_at) };
}

const CONSENT_MESSAGE = "Sleep logging stores optional wellness information. Please allow it first.";
const OVERLAP_MESSAGE = (night: string) => `This overlaps the sleep you logged for ${night}. Edit that entry or choose different times.`;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const timezone = z.string().trim().min(1).max(64).refine(isValidTimeZone, "Unknown time zone");
const localTime = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Enter a date and time");
const optionalLocalTime = z.preprocess(blankToUndefined, localTime.optional());
const optionalCount = (max: number, label: string) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`).min(0).max(max).optional());

/** Records the member's consent to store optional wellness information (shared with recovery check-ins). */
export async function allowSleepTrackingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase, consented } = await sleepCtx();
  if (consented) return actionOk();
  if (formData.get("consent") !== "on") return actionError("Tick the box to allow sleep logging.", { consent: "Consent required" });
  const { error } = await supabase.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", user.id);
  if (error) {
    logError("sleep.consent", error);
    return actionError("Couldn't record your consent. Please try again.");
  }
  refresh();
  return actionOk("Sleep logging is on. Nothing is shared with anyone, and you can delete entries at any time.");
}

const timerSchema = z.object({
  op: z.enum(["start", "stop"]),
  id: z.string().uuid(),
  kind: z.enum(SLEEP_KINDS).default("night"),
  timezone: timezone.optional(),
});

/** Start or stop the in-app sleep timer. A stopped timer shorter than five minutes is discarded, not saved. */
export async function sleepTimerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase, tz, consented } = await sleepCtx();
  const parsed = timerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const zone = v.timezone ?? tz;
  const running = await getRunningSleepSession(supabase, user.id).catch((err: unknown) => {
    logError("sleep.timer.lookup", err);
    return null;
  });

  if (v.op === "start") {
    if (!consented) return actionError(CONSENT_MESSAGE);
    if (running) return actionOk("Your sleep timer is already running.");
    const startedAt = new Date().toISOString();
    const times: SleepSessionTimes = { kind: v.kind, startedAt, endedAt: null, timezone: zone };
    const recent = await listSleepSessions(supabase, user.id, { limit: 20 }).catch(() => []);
    const clash = findOverlap(recent, times);
    if (clash) return actionError(OVERLAP_MESSAGE(clash.nightOf));
    const { error } = await supabase.from("sleep_sessions").insert({
      id: v.id,
      user_id: user.id,
      kind: v.kind,
      started_at: startedAt,
      ended_at: null,
      timezone: zone,
      night_of: nightOf(times),
      source: "timer",
    });
    if (error) {
      if (error.code === "23505") return actionOk("Your sleep timer is already running.");
      if (error.code === "23P01") return actionError("This overlaps a sleep session you already logged.");
      logError("sleep.timer.start", error);
      return actionError("Couldn't start the timer. Please try again.");
    }
    refresh();
    return actionOk(v.kind === "nap" ? "Nap timer started. Tap Stop when you're up." : "Sleep timer started. Tap Stop when you get up.");
  }

  if (!running || running.id !== v.id) {
    refresh();
    return actionOk("The timer isn't running.");
  }
  const endedAt = new Date().toISOString();
  const minutes = minutesBetween(running.startedAt, endedAt);
  if (minutes < MIN_SESSION_MINUTES || minutes > TIMER_AUTO_CLOSE_HOURS * 60) {
    const { error } = await supabase.from("sleep_sessions").delete().eq("id", running.id).eq("user_id", user.id);
    if (error) logError("sleep.timer.discard", error);
    refresh();
    return actionOk(minutes < MIN_SESSION_MINUTES ? "The timer ran for under five minutes, so nothing was saved." : "The timer ran for more than 20 hours, so it wasn't saved. You can enter that sleep by hand.");
  }
  const finished: SleepSessionTimes = { kind: running.kind, startedAt: running.startedAt, endedAt, timezone: running.timezone };
  const { error } = await supabase.from("sleep_sessions").update({ ended_at: endedAt, night_of: nightOf(finished) }).eq("id", running.id).eq("user_id", user.id);
  if (error) {
    logError("sleep.timer.stop", error);
    return actionError("Couldn't stop the timer. Please try again.");
  }
  refresh();
  return actionOk("Saved. Add detail to the entry any time: when you fell asleep, wake-ups, notes.");
}

const sessionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(SLEEP_KINDS).default("night"),
  timezone,
  startedAt: localTime,
  endedAt: localTime,
  onsetAt: optionalLocalTime,
  finalWakeAt: optionalLocalTime,
  awakenings: optionalCount(MAX_AWAKENINGS, "Wake-ups"),
  awakeMinutes: optionalCount(1440, "Minutes awake"),
  notes: z.string().trim().max(280, "Keep notes under 280 characters").optional().default(""),
  returnTo: z.string().optional(),
});

/** Create or edit a night or nap entered by hand. Times arrive as wall-clock values in the chosen zone. */
export async function saveSleepSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase, consented } = await sleepCtx();
  if (!consented) return actionError(CONSENT_MESSAGE);
  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const toIso = (local: string | undefined) => (local ? zonedTimeToIso(local, v.timezone) : null);
  const times: SleepSessionTimes = {
    kind: v.kind,
    timezone: v.timezone,
    startedAt: toIso(v.startedAt) ?? "",
    endedAt: toIso(v.endedAt),
    onsetAt: toIso(v.onsetAt),
    finalWakeAt: toIso(v.finalWakeAt),
    awakenings: v.awakenings ?? null,
    awakeMinutes: v.awakeMinutes ?? null,
  };
  if (!times.endedAt) return actionError("Enter when you got up.", { endedAt: "Required" });
  const check = validateSleepSession(times);
  if (!check.ok) return actionError(check.message, check.field ? { [check.field]: check.message } : undefined);

  const existing = await getSleepSession(supabase, user.id, v.id).catch(() => null);
  if (existing && existing.source !== "manual" && existing.source !== "timer") return actionError("Imported sleep can't be edited here. Delete it and enter the night by hand if it's wrong.");
  const around = await listSleepSessions(supabase, user.id, { fromNight: isoDateInTz(new Date(Date.parse(times.startedAt) - 3 * 86_400_000), v.timezone), toNight: isoDateInTz(new Date(Date.parse(times.endedAt) + 3 * 86_400_000), v.timezone) }).catch(() => []);
  const clash = findOverlap(around, times, v.id);
  if (clash) return actionError(OVERLAP_MESSAGE(clash.nightOf), { startedAt: "Overlaps another entry" });

  const row = {
    id: v.id,
    user_id: user.id,
    kind: v.kind,
    started_at: times.startedAt,
    ended_at: times.endedAt,
    onset_at: times.onsetAt ?? null,
    final_wake_at: times.finalWakeAt ?? null,
    awakenings: times.awakenings,
    awake_minutes: times.awakeMinutes,
    timezone: v.timezone,
    night_of: nightOf(times),
    source: existing?.source ?? "manual",
    notes: v.notes || null,
  };
  const { error } = existing
    ? await supabase.from("sleep_sessions").update(row).eq("id", v.id).eq("user_id", user.id)
    : await supabase.from("sleep_sessions").insert(row);
  if (error) {
    if (error.code === "23P01") return actionError("This overlaps a sleep session you already logged.", { startedAt: "Overlaps another entry" });
    if (error.message?.includes("sleep_session_limit")) return actionError("You've reached the limit of saved sleep sessions. Delete some old entries first.");
    logError("sleep.session.save", error);
    return actionError("Couldn't save this sleep. Please try again.");
  }
  refresh();
  redirect(v.returnTo && v.returnTo.startsWith("/progress/sleep") ? `${v.returnTo}${v.returnTo.includes("?") ? "&" : "?"}saved=1` : "/progress/sleep?saved=1");
}

const goalSchema = z.object({
  goalMinutes: z.coerce.number({ error: "Choose a goal" }).int().min(SLEEP_GOAL_MIN_MINUTES, "At least 4 hours").max(SLEEP_GOAL_MAX_MINUTES, "At most 12 hours"),
});

/** The member's own sleep target (4–12 hours). A chosen target, not a measured need. */
export async function setSleepGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase } = await sleepCtx();
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const { error } = await supabase.from("profiles").update({ sleep_goal_minutes: parsed.data.goalMinutes }).eq("id", user.id);
  if (error) {
    logError("sleep.goal", error);
    return actionError("Couldn't save your goal. Please try again.");
  }
  refresh();
  revalidatePath("/progress/sleep/settings");
  return actionOk(`Sleep goal set to ${formatDuration(parsed.data.goalMinutes)}.`);
}

const targetWakeSchema = z.object({ targetWake: z.preprocess(blankToUndefined, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 06:30").optional()) });

/** The wake time the member wants to keep; blank means "use my typical wake time". */
export async function setSleepTargetWakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase } = await sleepCtx();
  const parsed = targetWakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const value = parsed.data.targetWake ? `${parsed.data.targetWake}:00` : null;
  const { error } = await supabase.from("profiles").update({ sleep_target_wake: value }).eq("id", user.id);
  if (error) {
    logError("sleep.target_wake", error);
    return actionError("Couldn't save. Please try again.");
  }
  refresh();
  revalidatePath("/progress/sleep/schedule");
  return actionOk(value ? "Wake time saved. Your windows now hang off it." : "Cleared. Your windows follow your typical wake time.");
}

/** The wake-up alarm settings. The phone schedules the notifications itself after this succeeds (src/lib/native-alarm.ts). */
export async function setSleepAlarmAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, profile, supabase } = await sleepCtx();
  const parsed = alarmConfigSchema.safeParse(alarmConfigFromForm(formData, parseAlarmConfig(profile?.sleep_alarm)));
  if (!parsed.success) return actionInvalid(parsed.error);
  const config = parsed.data;
  if (config.enabled && config.days.length === 0) return actionError("Please fix the highlighted fields.", { days: "Pick at least one day." });
  const { error } = await supabase.from("profiles").update({ sleep_alarm: config }).eq("id", user.id);
  if (error) {
    logError("sleep.alarm", error);
    return actionError("Couldn't save. Please try again.");
  }
  refresh();
  revalidatePath("/progress/sleep/alarm");
  return actionOk(config.enabled ? `Alarm set for ${describeAlarm(config)}.` : "Alarm switched off.");
}

/** The saved alarm settings, for the phone app to schedule on launch; null when signed out or never set. */
export async function getSleepAlarmConfigAction(): Promise<AlarmConfig | null> {
  try {
    const { profile } = await sleepCtx();
    return profile?.sleep_alarm == null ? null : parseAlarmConfig(profile.sleep_alarm);
  } catch {
    return null;
  }
}

/** Hide one habit tip. Used by one-click buttons. */
export async function dismissSleepTipAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = String(formData.get("key") ?? "");
  if (!/^[a-z_]{1,40}$/.test(key)) return;
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("profiles").select("sleep_tips_dismissed").eq("id", user.id).maybeSingle();
  const current = ((data?.sleep_tips_dismissed as string[] | null) ?? []).filter((k) => k !== key);
  const { error } = await supabase.from("profiles").update({ sleep_tips_dismissed: [...current, key].slice(-50) }).eq("id", user.id);
  if (error) logError("sleep.tip.dismiss", error);
  refresh();
}

/** Show dismissed tips again. */
export async function restoreSleepTipsAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ sleep_tips_dismissed: [] }).eq("id", user.id);
  if (error) logError("sleep.tip.restore", error);
  refresh();
}

/** Remove every sleep session (stages go with them), check-in and import record. Consent itself is kept; it is shared with recovery check-ins. */
export async function deleteAllSleepDataAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const steps = await Promise.all([
    supabase.from("sleep_sessions").delete().eq("user_id", user.id),
    supabase.from("sleep_checkins").delete().eq("user_id", user.id),
    supabase.from("sleep_import_runs").delete().eq("user_id", user.id),
  ]);
  for (const { error } of steps) if (error) logError("sleep.delete_all", error);
  refresh();
  revalidatePath("/progress/sleep/settings");
}

/** Delete one session (any source). Used by one-click buttons, so it never throws. */
export async function deleteSleepSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("sleep_sessions").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) logError("sleep.session.delete", error);
  refresh();
}
