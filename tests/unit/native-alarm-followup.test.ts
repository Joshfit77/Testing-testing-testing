import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The alarm's follow-up ring on the phone (O-04 and the native review): opening the app during a snooze keeps the
 * snooze; I'm up replaces this morning's ring with the next alarm's; Snooze replaces the follow-up in the same slot.
 */
type Pending = { id: number; schedule?: { at?: Date }; extra?: Record<string, unknown> };
const state = { pending: [] as Pending[], listener: null as null | ((e: unknown) => void) };
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getPending: async () => ({ notifications: state.pending }),
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => {
      const ids = new Set(notifications.map((n) => n.id));
      state.pending = state.pending.filter((p) => !ids.has(p.id));
    },
    schedule: async ({ notifications }: { notifications: Pending[] }) => {
      const ids = new Set(notifications.map((n) => n.id));
      state.pending = [...state.pending.filter((p) => !ids.has(p.id)), ...notifications];
      return { notifications: notifications.map((n) => ({ id: n.id })) };
    },
    registerActionTypes: async () => undefined,
    addListener: async (_n: string, fn: (e: unknown) => void) => {
      state.listener = fn;
      return { remove: async () => undefined };
    },
  },
}));
vi.mock("@/lib/native", () => ({ isNativeApp: () => true, NOTIFICATION_SOUND: "x.wav" }));
vi.mock("@/lib/in-app-navigation", () => ({ navigateInApp: vi.fn() }));

const cfg = { enabled: true, wakeTime: "06:30", windowMinutes: 0, mode: "fixed" as const, days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[], snoozeMinutes: 9 };
const slot = () => state.pending.find((p) => p.id === 5410);

beforeEach(() => {
  state.pending = [];
  state.listener = null;
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 25, 6, 31)); // Wednesday, the 06:30 alarm just rang
});

describe("alarm follow-up on the phone", () => {
  it("schedules the weekly alarms plus one follow-up in the shared slot (8 pending at most)", async () => {
    const { scheduleSleepAlarm } = await import("@/lib/native-alarm");
    await scheduleSleepAlarm(cfg);
    expect(state.pending).toHaveLength(8);
    expect(slot()!.extra).toMatchObject({ followUp: true });
    expect(new Date(slot()!.schedule!.at!).getMinutes()).toBe(39);
  });

  it("Snooze replaces this morning's follow-up; opening the app during the snooze keeps it", async () => {
    const { scheduleSleepAlarm, installSleepAlarmActions } = await import("@/lib/native-alarm");
    await scheduleSleepAlarm(cfg);
    await installSleepAlarmActions();
    state.listener!({ actionId: "snooze", notification: { id: 5401 + 3, extra: { snoozeMinutes: 9, config: cfg } } });
    await vi.waitFor(() => expect(slot()!.extra).toMatchObject({ snoozed: true }));
    const snoozeAt = new Date(slot()!.schedule!.at!).getTime();
    await scheduleSleepAlarm(cfg); // the app opens (sync from the account) during the snooze
    expect(slot()!.extra).toMatchObject({ snoozed: true });
    expect(new Date(slot()!.schedule!.at!).getTime()).toBe(snoozeAt);
  });

  it("I'm up replaces this morning's ring with tomorrow's follow-up, and a later sync doesn't bring today's back", async () => {
    const { scheduleSleepAlarm, installSleepAlarmActions } = await import("@/lib/native-alarm");
    await scheduleSleepAlarm(cfg);
    await installSleepAlarmActions();
    state.listener!({ actionId: "up", notification: { id: 5404, extra: { snoozeMinutes: 9, config: cfg } } });
    await vi.waitFor(() => expect(new Date(slot()!.schedule!.at!).getDate()).toBe(26));
    await scheduleSleepAlarm(cfg);
    expect(new Date(slot()!.schedule!.at!).getDate()).toBe(26);
  });
});
