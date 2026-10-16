"use client";

/**
 * Schedules weekly workout reminders with Capacitor LocalNotifications (iOS/Android shells only).
 * Mirrors the rest-timer pattern in ./native.ts: dynamic import, permission check, no-op on the web.
 */
import { isNativeApp } from "@/lib/native";
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
