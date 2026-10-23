"use client";

/**
 * Wake-up alarm on the phone: weekly repeating local notifications with Snooze and I'm up actions
 * (Capacitor LocalNotifications), following the workout-reminder pattern in ./native-reminders.ts.
 * Every function is a safe no-op outside the iOS/Android shells. Not yet verified on a physical phone.
 */
import { isNativeApp } from "@/lib/native";
import { ALARM_ACTION_TYPE, ALL_ALARM_IDS, alarmNotifications, SNOOZE_NOTIFICATION_ID, type AlarmConfig } from "@/lib/domain/sleep-alarm";

export type AlarmScheduleResult =
  | { ok: true; scheduled: number; exact: boolean }
  | { ok: false; reason: "not-native" | "permission-denied" | "error" };

const TITLE = "Time to get up";
const BODY = "Your Narrow Gate alarm. Snooze, or tap I'm up and tell the app how you slept.";

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

function platform(): string {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() ?? "web";
}

/** True when Android will fire the alarm at the exact minute; other platforms are treated as exact. */
async function exactAllowed(LocalNotifications: Awaited<ReturnType<typeof plugin>>): Promise<boolean> {
  if (platform() !== "android") return true;
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return false;
  }
}

/** Opens Android's "Alarms & reminders" setting for the app; resolves true when exact alarms are now allowed. */
export async function requestExactAlarms(): Promise<boolean> {
  if (!isNativeApp() || platform() !== "android") return true;
  try {
    return (await (await plugin()).changeExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return false;
  }
}

export async function cancelSleepAlarm(): Promise<AlarmScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    await (await plugin()).cancel({ notifications: ALL_ALARM_IDS.map((id) => ({ id })) });
    return { ok: true, scheduled: 0, exact: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Cancels the previous alarm (and any snooze), then schedules the new weekly set. */
export async function scheduleSleepAlarm(config: AlarmConfig): Promise<AlarmScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    const LocalNotifications = await plugin();
    const entries = alarmNotifications(config);
    if (entries.length) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return { ok: false, reason: "permission-denied" };
      }
    }
    await LocalNotifications.cancel({ notifications: ALL_ALARM_IDS.map((id) => ({ id })) });
    if (!entries.length) return { ok: true, scheduled: 0, exact: true };
    const exact = await exactAllowed(LocalNotifications);
    const res = await LocalNotifications.schedule({
      notifications: entries.map((e) => ({
        id: e.id,
        title: TITLE,
        body: BODY,
        actionTypeId: ALARM_ACTION_TYPE,
        extra: { snoozeMinutes: config.snoozeMinutes },
        // `on` repeats every matching weekday/time; exact only where Android allows it, otherwise it may run a few minutes late.
        schedule: { on: { weekday: e.weekday, hour: e.hour, minute: e.minute }, allowWhileIdle: true },
        isExactNotification: exact,
      })),
    });
    return { ok: true, scheduled: res.notifications.length, exact };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * On launch, bring this phone in line with the alarm saved to the account: settings saved on the web are scheduled
 * here, and an alarm switched off elsewhere is cancelled. Never prompts: it only schedules when notifications are
 * already allowed, so the first scheduling always happens from the alarm page where the prompt makes sense.
 */
export async function syncSleepAlarmFromAccount(load: () => Promise<AlarmConfig | null>): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const config = await load();
    if (!config) return;
    if (!config.enabled) {
      await cancelSleepAlarm();
      return;
    }
    const LocalNotifications = await plugin();
    if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
    await scheduleSleepAlarm(config);
  } catch {
    /* the alarm page reports the device state when the member opens it */
  }
}

/** Number of alarm notifications pending on this device (weekly entries plus a snooze), or null if unknown. */
export async function pendingSleepAlarmCount(): Promise<number | null> {
  if (!isNativeApp()) return null;
  try {
    const { notifications } = await (await plugin()).getPending();
    return notifications.filter((n) => ALL_ALARM_IDS.includes(n.id)).length;
  } catch {
    return null;
  }
}

/**
 * Registers the Snooze / I'm up actions and handles them: Snooze schedules one more notification a few minutes out;
 * I'm up opens the morning check-in. Called once from the native shell init so it works however the app was opened.
 */
export async function installSleepAlarmActions(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const LocalNotifications = await plugin();
    await LocalNotifications.registerActionTypes({
      types: [{ id: ALARM_ACTION_TYPE, actions: [{ id: "snooze", title: "Snooze" }, { id: "up", title: "I'm up", foreground: true }] }],
    });
    const handle = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const n = event.notification;
      if (!ALL_ALARM_IDS.includes(n.id)) return;
      if (event.actionId === "snooze") {
        const minutes = Math.min(30, Math.max(1, Math.round(Number((n.extra as { snoozeMinutes?: unknown } | undefined)?.snoozeMinutes) || 9)));
        void LocalNotifications.schedule({
          notifications: [{ id: SNOOZE_NOTIFICATION_ID, title: TITLE, body: BODY, actionTypeId: ALARM_ACTION_TYPE, extra: n.extra, schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true } }],
        }).catch(() => undefined);
      } else {
        window.location.assign("/progress/sleep/checkin");
      }
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
