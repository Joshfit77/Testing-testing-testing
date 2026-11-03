"use client";

/**
 * Delivers the member's reminders on an iPhone / Android phone with Capacitor LocalNotifications. The schedule comes
 * from the planner (src/lib/notifications/planner.ts); this module only talks to the phone. Every function is a safe
 * no-op in a web browser, which can't show reminders while the site is closed.
 *
 * - Android: one channel per group (Faith, workouts, food and water, recovery), private on the lock screen.
 * - Each notification carries the screen to open (checked against the app's own sections when tapped).
 * - Rebuilt when the app opens or comes back to the foreground, and at once when the time zone or the date changed.
 * - Offline: if the account can't be reached, the reminders already on the phone are left as they are.
 * - Signing out (or another member signing in) removes everything this app scheduled on the phone.
 * Delivery on real phones still has to be checked by hand (docs/NOTIFICATIONS.md).
 */
import { NOTIFICATION_SOUND, isNativeApp } from "@/lib/native";
import { ALL_FAITH_REMINDER_IDS } from "@/lib/faith-reminders";
import { ALL_APP_REMINDER_IDS, NOTIFICATION_CHANNELS, safeNotificationPath } from "@/lib/notifications/catalog";
import { isDoneToday, planNotifications, type DoneToday, type PlannedNotification } from "@/lib/notifications/planner";
import type { NotificationSync } from "@/server/actions/notifications";

export const ALL_REMINDER_IDS: number[] = [...ALL_FAITH_REMINDER_IDS, ...ALL_APP_REMINDER_IDS];
const isReminderId = (id: number) => ALL_REMINDER_IDS.includes(id);

const DEVICE_KEY = "ngf.notifications.device";
const OWNER_KEY = "ngf.notifications.owner";
const LAST_SYNC_KEY = "ngf.notifications.lastSync";
const LEGACY_WORKOUT_KEY = "ngf.workoutReminders.v1";

export type PermissionState = "granted" | "denied" | "prompt" | "unknown";
export type SyncResult =
  | { ok: true; scheduled: number; delivers: boolean; paused: boolean }
  | { ok: false; reason: "not-native" | "permission-denied" | "offline" | "error" };

export interface LastSync {
  at: number;
  scheduled: number;
  timezone: string;
  date: string;
}

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

function platform(): "ios" | "android" | "web" {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  },
};

/** A random id this app keeps on the phone so the member can tell their phones apart (not a hardware id). */
export function deviceKey(): string {
  let key = store.get(DEVICE_KEY);
  if (!key || !/^[A-Za-z0-9-]{16,64}$/.test(key)) {
    key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    store.set(DEVICE_KEY, key);
  }
  return key;
}

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
/** Today's date on the phone's clock ("YYYY-MM-DD"). */
export const deviceToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: deviceTimeZone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function lastSync(): LastSync | null {
  try {
    const v = JSON.parse(store.get(LAST_SYNC_KEY) ?? "null") as LastSync | null;
    return v && typeof v.at === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Notification permission on this phone ("unknown" in a browser). Never prompts. */
export async function notificationPermission(): Promise<PermissionState> {
  if (!isNativeApp()) return "unknown";
  try {
    const p = (await (await plugin()).checkPermissions()).display;
    return p === "granted" || p === "denied" ? p : "prompt";
  } catch {
    return "unknown";
  }
}

/** Android channels (no-op elsewhere). Created before anything is scheduled on them. */
export async function ensureChannels(): Promise<void> {
  if (!isNativeApp() || platform() !== "android") return;
  const LocalNotifications = await plugin();
  for (const c of NOTIFICATION_CHANNELS) {
    await LocalNotifications.createChannel({ id: c.id, name: c.name, description: c.description, importance: 3, visibility: 0, vibration: true });
  }
}

/** The Capacitor notifications for a plan (exported for tests). */
export function toCapacitor(plan: PlannedNotification[], os: "ios" | "android" | "web") {
  return plan.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    // Android: the group's channel. iOS: grouped per group in Notification Centre.
    ...(os === "android" ? { channelId: n.channelId, group: n.group } : { threadIdentifier: `ngf-${n.group}` }),
    extra: { url: n.url, kind: n.kind, date: n.date },
    // Without a sound iOS shows the reminder silently.
    sound: NOTIFICATION_SOUND,
    schedule: n.at ? { at: n.at, allowWhileIdle: true } : { on: n.on!, allowWhileIdle: true },
    // Inexact on Android: no "Alarms & reminders" permission needed; may arrive a few minutes late.
    isExactNotification: false,
  }));
}

/** Remove every reminder this app scheduled (the sleep alarm and rest timer have their own ids and stay). */
export async function cancelAllReminders(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await (await plugin()).cancel({ notifications: ALL_REMINDER_IDS.map((id) => ({ id })) });
  } catch {
    /* nothing to cancel */
  }
}

/**
 * On sign-out: remove everything this app has pending on the phone (reminders, the sleep alarm, a rest timer), so
 * the next person to sign in never gets the previous member's notifications.
 */
export async function clearDeviceNotifications(): Promise<void> {
  store.remove(OWNER_KEY);
  store.remove(LAST_SYNC_KEY);
  if (!isNativeApp()) return;
  try {
    const LocalNotifications = await plugin();
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch {
    /* plugin unavailable */
  }
}

/**
 * Rebuild this phone's reminders from the account. Asks for permission only when `askPermission` is set (after the
 * member saves reminders) and at least one reminder is planned; otherwise never prompts.
 */
export async function syncReminders(
  load: (device: { key: string; platform: "ios" | "android"; timezone: string; permission: PermissionState }) => Promise<NotificationSync>,
  opts: { askPermission?: boolean } = {},
): Promise<SyncResult> {
  if (!isNativeApp()) return { ok: false, reason: "not-native" };
  const os = platform();
  if (os === "web") return { ok: false, reason: "not-native" };
  let sync: NotificationSync;
  const permission = await notificationPermission();
  try {
    sync = await load({ key: deviceKey(), platform: os, timezone: deviceTimeZone(), permission });
  } catch {
    // Offline or signed out: keep what's already scheduled; it still arrives. It's rebuilt once the app reconnects.
    return { ok: false, reason: "offline" };
  }
  try {
    const LocalNotifications = await plugin();
    // A different account than last time (signing out already cleared the phone; this covers an expired session):
    // none of the previous member's reminders may remain. Everything this app scheduled is replaced below anyway.
    if (store.get(OWNER_KEY) !== sync.owner) {
      await cancelAllReminders();
      store.set(OWNER_KEY, sync.owner);
    }
    const now = new Date();
    const plan = sync.delivers
      ? planNotifications({ faith: sync.faith, app: sync.app, prefs: sync.prefs, ctx: { ...sync.context, now, deviceTimezone: deviceTimeZone() } })
      : [];
    if (plan.length && permission !== "granted") {
      if (!opts.askPermission) return { ok: false, reason: "permission-denied" };
      if ((await LocalNotifications.requestPermissions()).display !== "granted") return { ok: false, reason: "permission-denied" };
    }
    await ensureChannels();
    await LocalNotifications.cancel({ notifications: ALL_REMINDER_IDS.map((id) => ({ id })) });
    const res = plan.length ? await LocalNotifications.schedule({ notifications: toCapacitor(plan, os) }) : { notifications: [] };
    store.set(LAST_SYNC_KEY, JSON.stringify({ at: now.getTime(), scheduled: res.notifications.length, timezone: deviceTimeZone(), date: sync.context.today } satisfies LastSync));
    return { ok: true, scheduled: res.notifications.length, delivers: sync.delivers, paused: sync.prefs.paused };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Whether the schedule should be rebuilt now: never synced, the time zone or day changed, or it's been a while. */
export function needsResync(now = Date.now(), today?: string, maxAgeMs = 15 * 60_000): boolean {
  const last = lastSync();
  if (!last) return true;
  if (last.timezone !== deviceTimeZone()) return true;
  if (today && last.date !== today) return true;
  return now - last.at > maxAgeMs;
}

/**
 * Cancel today's reminders for what was just done on this phone (a reading marked, a meal or water logged, a workout
 * finished), without waiting for the account. Uses each notification's own kind and date.
 */
export async function cancelDoneToday(today: string, done: Partial<DoneToday>): Promise<number> {
  if (!isNativeApp()) return 0;
  try {
    const LocalNotifications = await plugin();
    const { notifications } = await LocalNotifications.getPending();
    const ids = notifications
      .filter((n) => isReminderId(n.id))
      .filter((n) => {
        const extra = (n.extra ?? {}) as { kind?: string; date?: string | null };
        return extra.date === today && typeof extra.kind === "string" && isDoneToday(extra.kind as PlannedNotification["kind"], done);
      })
      .map((n) => ({ id: n.id }));
    if (ids.length) await LocalNotifications.cancel({ notifications: ids });
    return ids.length;
  } catch {
    return 0;
  }
}

/** Tapping a reminder opens its screen (only the app's own sections; anything else opens Home). */
export async function installReminderTapHandler(navigate: (path: string) => void = (p) => window.location.assign(p)): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const handle = await (await plugin()).addListener("localNotificationActionPerformed", (event) => {
      if (!isReminderId(event.notification.id)) return;
      navigate(safeNotificationPath((event.notification.extra as { url?: unknown } | undefined)?.url) ?? "/home");
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}

/** The workout reminder older versions kept only on this phone, if any (moved to the account once, then removed). */
export function takeLegacyWorkoutReminder(): unknown {
  const raw = store.get(LEGACY_WORKOUT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    store.remove(LEGACY_WORKOUT_KEY);
    return null;
  }
}
export const forgetLegacyWorkoutReminder = () => store.remove(LEGACY_WORKOUT_KEY);
