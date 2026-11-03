"use client";

/**
 * Schedules weekly workout reminders with Capacitor LocalNotifications (iOS/Android shells only).
 * Mirrors the rest-timer pattern in ./native.ts: dynamic import, permission check, no-op on the web.
 */
import { isNativeApp } from "@/lib/native";
import { ALL_FAITH_REMINDER_IDS, buildDatedFaithNotifications, buildFaithNotifications, todayIdsToCancel, type FaithReminder, type FaithReminderContext } from "@/lib/faith-reminders";
import { ALL_REMINDER_IDS, buildReminderSchedule, reminderMessage, type ReminderSettings } from "@/lib/reminders";

export type ReminderScheduleResult =
  | { ok: true; scheduled: number }
  | { ok: false; reason: "not-native" | "permission-denied" | "error" };

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

export async function cancelWorkoutReminders(): Promise<ReminderScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    const LocalNotifications = await plugin();
    await LocalNotifications.cancel({ notifications: ALL_REMINDER_IDS.map((id) => ({ id })) });
    return { ok: true, scheduled: 0 };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Cancels any existing reminders, then schedules the new weekly set. */
export async function scheduleWorkoutReminders(settings: ReminderSettings, faithEnabled: boolean): Promise<ReminderScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    const LocalNotifications = await plugin();
    const entries = buildReminderSchedule(settings);
    if (entries.length) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return { ok: false, reason: "permission-denied" };
      }
    }
    await LocalNotifications.cancel({ notifications: ALL_REMINDER_IDS.map((id) => ({ id })) });
    if (!entries.length) return { ok: true, scheduled: 0 };
    const res = await LocalNotifications.schedule({
      notifications: entries.map((e) => ({
        id: e.id,
        ...reminderMessage(settings.style, e.jsWeekday, faithEnabled),
        // `on` repeats every matching weekday/time. Inexact on Android, so no exact-alarm permission is needed.
        schedule: { on: e.on, allowWhileIdle: true },
        isExactNotification: false,
      })),
    });
    return { ok: true, scheduled: res.notifications.length };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Number of this app's workout reminders currently pending on the device, or null if unknown. */
export async function pendingWorkoutReminderCount(): Promise<number | null> {
  if (!isNativeApp()) return null;
  try {
    const LocalNotifications = await plugin();
    const { notifications } = await LocalNotifications.getPending();
    return notifications.filter((n) => ALL_REMINDER_IDS.includes(n.id)).length;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Faith reminders (devotional / prayer / practices). Same plugin, separate id range.
// ---------------------------------------------------------------------------

/**
 * Replace this device's faith reminders with the given settings: weekly ones, plus dated ones for the next seven days
 * that leave out anything already done today (see buildDatedFaithNotifications). Asks for notification permission
 * only when at least one reminder is on and `askPermission` is set. No-op (reason "not-native") in a web browser.
 */
export async function syncFaithReminders(
  reminders: FaithReminder[],
  opts: { askPermission?: boolean; context?: Omit<FaithReminderContext, "now"> | null } = {},
): Promise<ReminderScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    const LocalNotifications = await plugin();
    const weekly = buildFaithNotifications(reminders, opts.context?.quiet);
    const dated = opts.context ? buildDatedFaithNotifications(reminders, { ...opts.context, now: new Date() }) : [];
    if (weekly.length || dated.length) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        if (!opts.askPermission) return { ok: false, reason: "permission-denied" };
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return { ok: false, reason: "permission-denied" };
      }
    }
    await LocalNotifications.cancel({ notifications: ALL_FAITH_REMINDER_IDS.map((id) => ({ id })) });
    if (!weekly.length && !dated.length) return { ok: true, scheduled: 0 };
    const res = await LocalNotifications.schedule({
      notifications: [
        ...weekly.map((e) => ({ id: e.id, title: e.title, body: e.body, schedule: { on: e.on, allowWhileIdle: true }, isExactNotification: false })),
        ...dated.map((e) => ({ id: e.id, title: e.title, body: e.body, schedule: { at: e.at, allowWhileIdle: true }, isExactNotification: false })),
      ],
    });
    return { ok: true, scheduled: res.notifications.length };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Cancel today's reminders for activities just completed on this device (reading, prayer, challenge, fitness, and the
 * journey's evening and final reminders once both reading and prayer are done). */
export async function cancelTodayFaithReminders(done: FaithReminderContext["done"]): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const ids = todayIdsToCancel(done);
    if (!ids.length) return;
    const LocalNotifications = await plugin();
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* nothing to cancel on this device */
  }
}
