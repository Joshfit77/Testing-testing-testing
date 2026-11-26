"use client";

/**
 * Wake-up alarm on the phone: weekly repeating local notifications with Snooze and I'm up actions
 * (Capacitor LocalNotifications), following the reminder pattern in ./native-notifications.ts.
 * Every function is a safe no-op outside the iOS/Android shells. Not yet verified on a physical phone.
 */
import { NOTIFICATION_SOUND, isNativeApp } from "@/lib/native";
import { navigateInApp } from "@/lib/in-app-navigation";
import { ALARM_ACTION_TYPE, ALL_ALARM_IDS, alarmNotifications, nextFollowUp, SNOOZE_NOTIFICATION_ID, type AlarmConfig } from "@/lib/domain/sleep-alarm";

/** The local date (YYYY-MM-DD) the member last answered an alarm: that morning's follow-up isn't scheduled again. */
const ANSWERED_KEY = "ngf.alarm.answered";
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function answeredToday(now: Date): boolean {
  try {
    return localStorage.getItem(ANSWERED_KEY) === localDate(now);
  } catch {
    return false;
  }
}
function markAnswered(now: Date): void {
  try {
    localStorage.setItem(ANSWERED_KEY, localDate(now));
  } catch {
    /* storage unavailable: the follow-up may ring once more */
  }
}

export type AlarmScheduleResult =
  | { ok: true; scheduled: number; exact: boolean }
  | { ok: false; reason: "not-native" | "permission-denied" | "error" };

const TITLE = "Time to get up";
const BODY = "Your Narrow Gate alarm. Snooze, or tap I'm up and tell the app how you slept.";
const FOLLOW_UP_TITLE = "Still time to get up";

type Notifications = Awaited<ReturnType<typeof plugin>>["LocalNotifications"];

/**
 * Put the next follow-up ring in the shared snooze slot (or clear the slot when there is none). A snooze still ahead is
 * left alone unless `replaceSnooze`.
 */
async function scheduleFollowUp(LocalNotifications: Notifications, config: AlarmConfig, exact: boolean, replaceSnooze = false): Promise<void> {
  const now = new Date();
  if (!replaceSnooze) {
    const { notifications } = await LocalNotifications.getPending();
    const slot = notifications.find((n) => n.id === SNOOZE_NOTIFICATION_ID);
    const snoozed = (slot?.extra as { snoozed?: boolean } | undefined)?.snoozed === true;
    if (slot && snoozed && slot.schedule?.at && new Date(slot.schedule.at).getTime() > now.getTime()) return;
  }
  const at = nextFollowUp(config, now, answeredToday(now));
  if (!at) {
    await LocalNotifications.cancel({ notifications: [{ id: SNOOZE_NOTIFICATION_ID }] });
    return;
  }
  // Scheduling the same id replaces whatever was in the slot.
  await LocalNotifications.schedule({
    notifications: [{ id: SNOOZE_NOTIFICATION_ID, title: FOLLOW_UP_TITLE, body: BODY, actionTypeId: ALARM_ACTION_TYPE, sound: NOTIFICATION_SOUND,
      extra: { snoozeMinutes: config.snoozeMinutes, followUp: true, config }, schedule: { at, allowWhileIdle: true }, isExactNotification: exact }],
  });
}

/**
 * The plugin's module, not the plugin itself: a Capacitor plugin is a Proxy that answers every property, `then`
 * included, so an async function that returns it is treated as a thenable and its promise never settles (the proxy
 * turns `then` into a native call that doesn't exist). Callers take `LocalNotifications` off the module.
 */
async function plugin() {
  return import("@capacitor/local-notifications");
}

function platform(): string {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() ?? "web";
}

/** True when Android will fire the alarm at the exact minute; other platforms are treated as exact. */
async function exactAllowed(LocalNotifications: Awaited<ReturnType<typeof plugin>>["LocalNotifications"]): Promise<boolean> {
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
    return (await (await plugin()).LocalNotifications.changeExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return false;
  }
}

export async function cancelSleepAlarm(): Promise<AlarmScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    await (await plugin()).LocalNotifications.cancel({ notifications: ALL_ALARM_IDS.map((id) => ({ id })) });
    return { ok: true, scheduled: 0, exact: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Cancels the previous alarm (and any snooze), then schedules the new weekly set. */
export async function scheduleSleepAlarm(config: AlarmConfig): Promise<AlarmScheduleResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  try {
    const { LocalNotifications } = await plugin();
    const entries = alarmNotifications(config);
    if (entries.length) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return { ok: false, reason: "permission-denied" };
      }
    }
    // A snooze in progress is kept (opening the app during it must not silence it); everything else is replaced.
    await LocalNotifications.cancel({ notifications: ALL_ALARM_IDS.filter((id) => id !== SNOOZE_NOTIFICATION_ID).map((id) => ({ id })) });
    if (!entries.length) return { ok: true, scheduled: 0, exact: true };
    const exact = await exactAllowed(LocalNotifications);
    const res = await LocalNotifications.schedule({
      notifications: entries.map((e) => ({
        id: e.id,
        title: TITLE,
        body: BODY,
        actionTypeId: ALARM_ACTION_TYPE,
        sound: NOTIFICATION_SOUND,
        extra: { snoozeMinutes: config.snoozeMinutes, config },
        // `on` repeats every matching weekday/time; exact only where Android allows it, otherwise it may run a few minutes late.
        schedule: { on: { weekday: e.weekday, hour: e.hour, minute: e.minute }, allowWhileIdle: true },
        isExactNotification: exact,
      })),
    });
    // The next follow-up ring (it doesn't depend on the app running to handle Snooze).
    await scheduleFollowUp(LocalNotifications, config, exact);
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
    const { LocalNotifications } = await plugin();
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
    const { notifications } = await (await plugin()).LocalNotifications.getPending();
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
    const { LocalNotifications } = await plugin();
    await LocalNotifications.registerActionTypes({
      types: [{ id: ALARM_ACTION_TYPE, actions: [{ id: "snooze", title: "Snooze" }, { id: "up", title: "I'm up", foreground: true }] }],
    });
    const handle = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const n = event.notification;
      if (!ALL_ALARM_IDS.includes(n.id)) return;
      markAnswered(new Date());
      const extra = (n.extra ?? {}) as { snoozeMinutes?: unknown; config?: AlarmConfig };
      if (event.actionId === "snooze") {
        const minutes = Math.min(30, Math.max(1, Math.round(Number(extra.snoozeMinutes) || 9)));
        // The snooze goes into the follow-up's slot (same id), replacing this morning's follow-up in one step.
        void LocalNotifications.schedule({
          notifications: [{ id: SNOOZE_NOTIFICATION_ID, title: TITLE, body: BODY, actionTypeId: ALARM_ACTION_TYPE, sound: NOTIFICATION_SOUND,
            extra: { ...extra, snoozed: true }, schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true } }],
        }).catch(() => undefined);
      } else {
        // I'm up: this morning's follow-up (or snooze) is replaced by the next alarm's follow-up.
        if (extra.config) void scheduleFollowUp(LocalNotifications, extra.config, true, true).catch(() => undefined);
        else void LocalNotifications.cancel({ notifications: [{ id: SNOOZE_NOTIFICATION_ID }] }).catch(() => undefined);
        navigateInApp("/progress/sleep/checkin");
      }
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
