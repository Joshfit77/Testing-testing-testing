"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { isValidTimeZone } from "@/lib/domain/dates";
import { normalizeWeekdays } from "@/lib/faith-reminders";
import type { AppReminder } from "@/lib/notifications/catalog";
import type { PlannerContext } from "@/lib/notifications/planner";
import { sanitizeReminderSettings } from "@/lib/reminders";
import { notificationDeviceSchema, notificationSettingsSchema } from "@/lib/validation/schemas";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { loadNotificationSettings, loadPlannerContext, type NotificationSettings } from "@/server/services/notifications";

/*
 * Reminder settings (Profile → Notifications) and what a phone needs to schedule them. Every query uses the member's
 * own client (RLS) plus an explicit user_id filter. Nothing here sends a notification: the iPhone / Android app
 * schedules local notifications from what these return.
 */

export interface DeviceSummary {
  id: string;
  label: string;
  platform: "ios" | "android";
  delivers: boolean;
  permission: string;
  lastSyncAt: string;
  thisDevice: boolean;
}

export interface NotificationSync extends NotificationSettings {
  /** An opaque tag for the signed-in account: a phone that sees a different one clears the previous member's reminders. */
  owner: string;
  /** Whether this phone shows reminders (false when the member turned it off for this phone). */
  delivers: boolean;
  devices: DeviceSummary[];
  context: Omit<PlannerContext, "now" | "deviceTimezone">;
}

const ownerTag = (userId: string) => createHash("sha256").update(`ngf-notifications:${userId}`).digest("hex").slice(0, 24);

async function listDevices(userId: string, thisKey: string | null): Promise<DeviceSummary[]> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("notification_devices")
    .select("id, device_key, platform, label, delivers, permission, last_sync_at")
    .eq("user_id", userId)
    .order("last_sync_at", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id as string,
    label: d.label as string,
    platform: d.platform as "ios" | "android",
    delivers: d.delivers as boolean,
    permission: d.permission as string,
    lastSyncAt: d.last_sync_at as string,
    thisDevice: d.device_key === thisKey,
  }));
}

/**
 * Everything a phone needs to (re)build its reminders: the settings, today's state and, when the phone says who it
 * is, its own entry (created on first contact, so the member can see and switch off each phone).
 */
export async function getNotificationSyncAction(device: z.input<typeof notificationDeviceSchema> | null = null): Promise<NotificationSync> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const supabase = await getServerSupabase();
  const parsed = device ? notificationDeviceSchema.safeParse(device) : null;
  let delivers = true;
  if (parsed?.success) {
    const d = parsed.data;
    const { data: row, error } = await supabase
      .from("notification_devices")
      .upsert(
        {
          user_id: user.id,
          device_key: d.key,
          platform: d.platform,
          label: d.platform === "ios" ? "iPhone or iPad" : "Android device",
          timezone: d.timezone && isValidTimeZone(d.timezone) ? d.timezone : null,
          permission: d.permission,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_key" },
      )
      .select("delivers")
      .single();
    if (error) logError("notifications.device", error);
    delivers = row?.delivers ?? true;
  }
  const [settings, context, devices] = await Promise.all([
    loadNotificationSettings(supabase, user.id),
    loadPlannerContext(supabase, user.id, profile ?? {}),
    listDevices(user.id, parsed?.success ? parsed.data.key : null),
  ]);
  return { ...settings, owner: ownerTag(user.id), delivers, devices, context };
}

/** Save every reminder setting at once: Faith, workout, food and recovery reminders, and the shared preferences. */
export async function saveNotificationSettingsAction(input: z.input<typeof notificationSettingsSchema>): Promise<ActionState & { settings?: NotificationSettings }> {
  const user = await requireUser();
  const parsed = notificationSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Please check your reminders.");
  const { faith, app, prefs } = parsed.data;
  const supabase = await getServerSupabase();
  const [f, a, p] = await Promise.all([
    supabase
      .from("faith_reminders")
      .upsert(faith.map((r) => ({ user_id: user.id, kind: r.kind, enabled: r.enabled, remind_at: r.time, weekdays: normalizeWeekdays(r.weekdays) })), { onConflict: "user_id,kind" }),
    supabase.from("notification_reminders").upsert(
      app.map((r) => ({
        user_id: user.id,
        kind: r.kind,
        enabled: r.enabled,
        remind_at: r.time,
        weekdays: normalizeWeekdays(r.weekdays),
        interval_minutes: r.kind === "water" ? (r.intervalMinutes ?? 120) : null,
        end_at: r.kind === "water" ? r.endTime : null,
        style: r.style,
      })),
      { onConflict: "user_id,kind" },
    ),
    supabase
      .from("notification_prefs")
      .upsert(
        { user_id: user.id, paused: prefs.paused, quiet_start: prefs.quiet?.start ?? null, quiet_end: prefs.quiet?.end ?? null, daily_limit: prefs.dailyLimit },
        { onConflict: "user_id" },
      ),
  ]);
  const error = f.error ?? a.error ?? p.error;
  if (error) {
    logError("notifications.save", error);
    return actionError("Couldn't save your reminders. Please try again.");
  }
  return { ...actionOk("Saved."), settings: await loadNotificationSettings(supabase, user.id) };
}

/** Turn reminders on or off for one of the member's phones (to avoid getting each one twice). */
export async function setDeviceDeliveryAction(deviceId: string, delivers: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(deviceId).success || typeof delivers !== "boolean") return actionError("Unknown device.");
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("notification_devices").update({ delivers }).eq("id", deviceId).eq("user_id", user.id).select("id");
  if (error || !data?.length) {
    if (error) logError("notifications.device_delivery", error);
    return actionError("Couldn't update that device.");
  }
  return actionOk(delivers ? "Reminders on for that device." : "Reminders off for that device.");
}

/** Forget a phone (it's added again, showing reminders, the next time it's used to sign in). */
export async function forgetDeviceAction(deviceId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(deviceId).success) return actionError("Unknown device.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("notification_devices").delete().eq("id", deviceId).eq("user_id", user.id);
  if (error) {
    logError("notifications.device_forget", error);
    return actionError("Couldn't remove that device.");
  }
  return actionOk("Device removed.");
}

/**
 * One-time move of the workout reminder that older versions kept only on the phone into the account. Only when the
 * account has no workout reminder yet, so it never overwrites a choice made since.
 */
export async function importDeviceWorkoutReminderAction(raw: unknown): Promise<{ imported: boolean }> {
  const user = await requireUser();
  const local = sanitizeReminderSettings(raw);
  if (!local.enabled || local.weekdays.length === 0) return { imported: false };
  const supabase = await getServerSupabase();
  const row: Record<string, unknown> & Partial<AppReminder> = {
    user_id: user.id,
    kind: "workout",
    enabled: true,
    remind_at: local.time,
    weekdays: normalizeWeekdays(local.weekdays),
    style: local.style,
  };
  const { error } = await supabase.from("notification_reminders").insert(row);
  if (error) {
    if (error.code !== "23505") logError("notifications.import_workout", error);
    return { imported: false };
  }
  return { imported: true };
}

/** Use this phone's time zone for the account (reminders and the reading journey's day both follow it). */
export async function setAccountTimeZoneAction(timezone: string): Promise<ActionState> {
  const user = await requireUser();
  if (!isValidTimeZone(timezone)) return actionError("That time zone isn't recognised.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ timezone }).eq("id", user.id);
  if (error) {
    logError("notifications.timezone", error);
    return actionError("Couldn't update your time zone.");
  }
  return actionOk(`Time zone set to ${timezone}.`);
}
