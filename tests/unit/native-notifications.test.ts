import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The phone side, against a stand-in for Capacitor's LocalNotifications plugin (no real device here): permission
 * handling, Android channels, deep links, offline, account switching, sign-out and cancel-on-completion. Real delivery
 * on an iPhone / Android phone still has to be checked by hand (docs/NOTIFICATIONS.md).
 */
type Pending = { id: number; extra?: { kind?: string; date?: string | null; url?: string } };
const state = {
  permission: "granted" as "granted" | "denied" | "prompt",
  grantOnRequest: true,
  pending: [] as Pending[],
  channels: [] as { id: string; visibility?: number }[],
  scheduled: [] as Record<string, unknown>[],
  listeners: new Map<string, (e: unknown) => void>(),
  requested: 0,
};
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(async () => ({ display: state.permission })),
    requestPermissions: vi.fn(async () => {
      state.requested++;
      if (state.grantOnRequest) state.permission = "granted";
      else state.permission = "denied";
      return { display: state.permission };
    }),
    createChannel: vi.fn(async (c: { id: string; visibility?: number }) => void state.channels.push(c)),
    cancel: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      const ids = new Set(notifications.map((n) => n.id));
      state.pending = state.pending.filter((p) => !ids.has(p.id));
    }),
    schedule: vi.fn(async ({ notifications }: { notifications: Record<string, unknown>[] }) => {
      state.scheduled = notifications;
      state.pending.push(...notifications.map((n) => ({ id: n.id as number, extra: n.extra as Pending["extra"] })));
      return { notifications: notifications.map((n) => ({ id: n.id })) };
    }),
    getPending: vi.fn(async () => ({ notifications: state.pending })),
    removeAllDeliveredNotifications: vi.fn(async () => undefined),
    addListener: vi.fn(async (name: string, fn: (e: unknown) => void) => {
      state.listeners.set(name, fn);
      return { remove: async () => void state.listeners.delete(name) };
    }),
  },
}));

import { cancelDoneToday, clearDeviceNotifications, installReminderTapHandler, needsResync, syncReminders, toCapacitor } from "@/lib/native-notifications";
import { FAITH_REMINDER_KINDS, defaultFaithReminder } from "@/lib/faith-reminders";
import { APP_REMINDER_KINDS, defaultAppReminder } from "@/lib/notifications/catalog";
import { DEFAULT_NOTIFICATION_PREFS, NOTHING_DONE } from "@/lib/notifications/planner";
import type { NotificationSync } from "@/server/actions/notifications";

const setPlatform = (p: "ios" | "android" | null) => {
  (window as unknown as { Capacitor?: unknown }).Capacitor = p ? { isNativePlatform: () => true, getPlatform: () => p } : undefined;
};
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const sync = (over: Partial<NotificationSync> = {}): NotificationSync => ({
  owner: "owner-a",
  delivers: true,
  devices: [],
  faith: FAITH_REMINDER_KINDS.map(defaultFaithReminder),
  app: APP_REMINDER_KINDS.map((k) => (k === "dinner" || k === "winddown" ? { ...defaultAppReminder(k), enabled: true, time: "23:59" } : defaultAppReminder(k))),
  prefs: { ...DEFAULT_NOTIFICATION_PREFS },
  context: { today, timezone: "UTC", faithEnabled: true, journeyActive: false, done: { ...NOTHING_DONE }, training: { hasProgram: false, workoutDates: [] }, openPrayerRequests: 0 },
  ...over,
});

beforeEach(() => {
  Object.assign(state, { permission: "granted", grantOnRequest: true, pending: [], channels: [], scheduled: [], requested: 0 });
  state.listeners.clear();
  localStorage.clear();
  setPlatform("ios");
});
afterEach(() => setPlatform(null));

describe("scheduling on the phone", () => {
  it("does nothing in a web browser", async () => {
    setPlatform(null);
    expect(await syncReminders(async () => sync())).toEqual({ ok: false, reason: "not-native" });
  });

  it("schedules the plan with each reminder's screen and its group (iOS thread, Android channel)", async () => {
    const res = await syncReminders(async () => sync());
    expect(res).toMatchObject({ ok: true, delivers: true });
    expect(state.scheduled.length).toBeGreaterThan(0);
    const dinner = state.scheduled.find((n) => (n.extra as { kind: string }).kind === "dinner")!;
    expect(dinner).toMatchObject({ title: "Dinner", threadIdentifier: "ngf-nutrition", extra: { url: "/nutrition" }, isExactNotification: false });
    setPlatform("android");
    await syncReminders(async () => sync());
    expect(state.channels.map((c) => c.id)).toEqual(["ngf-faith", "ngf-workouts", "ngf-nutrition", "ngf-recovery"]);
    expect(state.channels.every((c) => c.visibility === 0)).toBe(true); // private on a secure lock screen
    expect(state.scheduled.every((n) => typeof n.channelId === "string")).toBe(true);
  });

  it("rebuilding twice leaves one copy of each reminder (no duplicates)", async () => {
    await syncReminders(async () => sync());
    const first = state.pending.length;
    await syncReminders(async () => sync());
    expect(state.pending.length).toBe(first);
    expect(new Set(state.pending.map((p) => p.id)).size).toBe(state.pending.length);
  });

  it("permission denied: asks only when the member just saved reminders, and reports it", async () => {
    state.permission = "prompt";
    expect(await syncReminders(async () => sync())).toEqual({ ok: false, reason: "permission-denied" });
    expect(state.requested).toBe(0); // never prompts on its own
    state.grantOnRequest = false;
    expect(await syncReminders(async () => sync(), { askPermission: true })).toEqual({ ok: false, reason: "permission-denied" });
    expect(state.requested).toBe(1);
    expect(state.pending).toEqual([]);
  });

  it("offline: the account can't be reached, so what's already scheduled stays as it is", async () => {
    await syncReminders(async () => sync());
    const before = [...state.pending];
    expect(await syncReminders(async () => Promise.reject(new Error("Failed to fetch")))).toEqual({ ok: false, reason: "offline" });
    expect(state.pending).toEqual(before);
  });

  it("this phone switched off for reminders, or everything paused: nothing stays scheduled", async () => {
    await syncReminders(async () => sync());
    expect(state.pending.length).toBeGreaterThan(0);
    await syncReminders(async () => sync({ delivers: false }));
    expect(state.pending).toEqual([]);
    await syncReminders(async () => sync());
    await syncReminders(async () => sync({ prefs: { ...DEFAULT_NOTIFICATION_PREFS, paused: true } }));
    expect(state.pending).toEqual([]);
  });
});

describe("account switching and sign-out", () => {
  it("a different member signing in never inherits the previous member's reminders", async () => {
    await syncReminders(async () => sync({ owner: "owner-a" }));
    expect(state.pending.length).toBeGreaterThan(0);
    const b = sync({ owner: "owner-b", app: APP_REMINDER_KINDS.map(defaultAppReminder) });
    await syncReminders(async () => b);
    expect(state.pending).toEqual([]);
  });
  it("signing out removes everything this app scheduled, the sleep alarm and rest timer included", async () => {
    await syncReminders(async () => sync());
    state.pending.push({ id: 5401 }, { id: 4201 });
    await clearDeviceNotifications();
    expect(state.pending).toEqual([]);
  });
  it("the sleep alarm and rest timer are left alone by an ordinary rebuild", async () => {
    state.pending.push({ id: 5401 }, { id: 4201 });
    await syncReminders(async () => sync());
    expect(state.pending.map((p) => p.id)).toEqual(expect.arrayContaining([5401, 4201]));
  });
});

describe("completion and deep links", () => {
  it("doing something cancels today's reminder for it at once, and nothing else", async () => {
    state.pending.push(
      { id: 5640, extra: { kind: "dinner", date: today } },
      { id: 5641, extra: { kind: "dinner", date: "2099-01-01" } },
      { id: 5620, extra: { kind: "breakfast", date: today } },
      { id: 5500, extra: { kind: "reading", date: today } },
      { id: 5540, extra: { kind: "accountability", date: today } },
      { id: 5401 },
    );
    expect(await cancelDoneToday(today, { dinner: true, reading: true })).toBe(2);
    expect(state.pending.map((p) => p.id).sort()).toEqual([5401, 5540, 5620, 5641]);
    // The evening check-in goes once both reading and prayer are done.
    await cancelDoneToday(today, { reading: true, prayer: true });
    expect(state.pending.map((p) => p.id)).not.toContain(5540);
  });

  it("tapping a reminder opens its screen; anything that isn't one of the app's own screens opens Home", async () => {
    const go = vi.fn();
    await installReminderTapHandler(go);
    const tap = state.listeners.get("localNotificationActionPerformed")!;
    tap({ actionId: "tap", notification: { id: 5500, extra: { url: "/faith/journey" } } });
    tap({ actionId: "tap", notification: { id: 5640, extra: { url: "https://evil.example/" } } });
    tap({ actionId: "tap", notification: { id: 5401, extra: { url: "/progress" } } }); // the alarm has its own handler
    expect(go.mock.calls).toEqual([["/faith/journey"], ["/home"]]);
  });

  it("resyncs when it has never synced, the time zone or day changed, or after a while", async () => {
    expect(needsResync()).toBe(true);
    await syncReminders(async () => sync());
    expect(needsResync(Date.now(), today)).toBe(false);
    expect(needsResync(Date.now(), "2000-01-01")).toBe(true);
    expect(needsResync(Date.now() + 16 * 60_000)).toBe(true);
    const last = JSON.parse(localStorage.getItem("ngf.notifications.lastSync")!);
    localStorage.setItem("ngf.notifications.lastSync", JSON.stringify({ ...last, timezone: "Mars/Olympus" }));
    expect(needsResync()).toBe(true);
  });

  it("maps dated and weekly reminders to Capacitor's schedule shapes", () => {
    const at = new Date("2026-11-03T12:00:00Z");
    const [a, b] = toCapacitor(
      [
        { id: 1, kind: "lunch", group: "nutrition", channelId: "ngf-nutrition", title: "Lunch", body: "x", url: "/nutrition", time: "12:00", date: "2026-11-03", at, priority: 7 },
        { id: 2, kind: "winddown", group: "recovery", channelId: "ngf-recovery", title: "W", body: "y", url: "/progress/sleep", time: "21:30", date: null, on: { weekday: 1, hour: 21, minute: 30 }, priority: 8 },
      ],
      "android",
    );
    expect(a!.schedule).toEqual({ at, allowWhileIdle: true });
    expect(b!.schedule).toEqual({ on: { weekday: 1, hour: 21, minute: 30 }, allowWhileIdle: true });
    expect(a).toMatchObject({ channelId: "ngf-nutrition", group: "nutrition", extra: { url: "/nutrition", kind: "lunch", date: "2026-11-03" } });
  });
});
