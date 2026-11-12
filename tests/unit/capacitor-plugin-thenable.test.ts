import { describe, expect, it, vi } from "vitest";

/**
 * A real Capacitor plugin is a Proxy that answers every property, `then` included (registerPlugin in
 * @capacitor/core). An async function that *returns* the plugin is therefore resolved as a thenable: the promise
 * machinery calls `plugin.then(resolve, reject)`, Capacitor turns that into a native call to a method that doesn't
 * exist, and `resolve` is never called. Before the fix, `await plugin()` in the reminder and alarm modules never
 * settled on a phone (sign-out cleanup, reminder sync and the sleep alarm all hung) and threw an unhandled rejection
 * on the web. The other plugin stand-ins in the test suite are plain objects without `then`, which is why none of
 * them caught it; this one behaves like the real proxy.
 */
const calls: string[] = [];
const capacitorLikeProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then") {
        // Like Capacitor on a device: a "method" that never calls back.
        return () => new Promise(() => {});
      }
      return async (..._args: unknown[]) => {
        calls.push(String(prop));
        if (prop === "getPending") return { notifications: [{ id: 1 }] };
        if (prop === "checkPermissions" || prop === "requestPermissions") return { display: "granted" };
        if (prop === "schedule") return { notifications: [] };
        return undefined;
      };
    },
  },
);

vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: capacitorLikeProxy }));
vi.mock("@/lib/native", () => ({ isNativeApp: () => true, NOTIFICATION_SOUND: undefined }));

const settlesWithin = <T,>(p: Promise<T>, ms = 1000) =>
  Promise.race([p.then(() => "settled" as const), new Promise<"hung">((r) => setTimeout(() => r("hung"), ms))]);

describe("Capacitor plugins are never returned from an async function", () => {
  it("sign-out clears the phone's notifications instead of hanging", async () => {
    const { clearDeviceNotifications } = await import("@/lib/native-notifications");
    calls.length = 0;
    expect(await settlesWithin(clearDeviceNotifications())).toBe("settled");
    expect(calls).toEqual(expect.arrayContaining(["getPending", "cancel", "removeAllDeliveredNotifications"]));
  });

  it("cancelling reminders and reading permission settle", async () => {
    const { cancelAllReminders, notificationPermission } = await import("@/lib/native-notifications");
    calls.length = 0;
    expect(await settlesWithin(cancelAllReminders())).toBe("settled");
    expect(calls).toContain("cancel");
    expect(await settlesWithin(notificationPermission())).toBe("settled");
  });

  it("the sleep alarm can be cancelled and counted", async () => {
    const { cancelSleepAlarm, pendingSleepAlarmCount } = await import("@/lib/native-alarm");
    calls.length = 0;
    expect(await settlesWithin(cancelSleepAlarm())).toBe("settled");
    expect(calls).toContain("cancel");
    expect(await settlesWithin(pendingSleepAlarmCount())).toBe("settled");
  });
});
