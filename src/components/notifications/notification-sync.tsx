"use client";

import { useEffect, useRef } from "react";
import { isNativeApp } from "@/lib/native";
import { cancelDoneToday, forgetLegacyWorkoutReminder, needsResync, syncReminders, takeLegacyWorkoutReminder } from "@/lib/native-notifications";
import type { DoneToday } from "@/lib/notifications/planner";
import type { NotificationSync as SyncData } from "@/server/actions/notifications";

type Load = Parameters<typeof syncReminders>[0];

/**
 * Inside the iPhone / Android app: keeps this phone's reminders in line with the account. Rebuilds them when the app
 * opens, when it comes back to the foreground after a while, and at once after a time-zone or date change. Moves a
 * workout reminder that older versions kept only on the phone into the account, once. Never prompts for permission
 * and does nothing in a browser.
 */
export function NotificationSync({ load, importWorkout }: { load: Load; importWorkout: (raw: unknown) => Promise<{ imported: boolean }> }) {
  const busy = useRef(false);
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const run = async (force: boolean) => {
      if (busy.current || cancelled || (!force && !needsResync())) return;
      busy.current = true;
      try {
        const legacy = takeLegacyWorkoutReminder();
        if (legacy) {
          await importWorkout(legacy).catch(() => ({ imported: false }));
          forgetLegacyWorkoutReminder();
        }
        await syncReminders(load);
      } finally {
        busy.current = false;
      }
    };
    void run(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    let remove: (() => void) | undefined;
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", () => void run(false)))
      .then((h) => {
        if (cancelled) void h.remove();
        else remove = () => void h.remove();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      remove?.();
    };
  }, [load, importWorkout]);
  return null;
}

/**
 * Rendered with today's state on the screens where things get done (Faith, the journey, Train, Food): cancels
 * today's reminders on this phone for anything already done, and again whenever that changes. Nothing in a browser.
 */
export function NotificationTodaySync({ today, done }: { today: string; done: Partial<DoneToday> }) {
  const key = `${today}:${Object.entries(done)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
    .join(",")}`;
  useEffect(() => {
    void cancelDoneToday(today, done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export type { SyncData };
