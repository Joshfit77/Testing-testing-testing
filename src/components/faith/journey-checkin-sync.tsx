"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { flushCheckinQueue, readCheckinQueue } from "@/lib/faith/checkin-queue";
import { isNativeApp } from "@/lib/native";
import { activeJourneyIdAction, journeyCheckInAction } from "@/server/actions/journeys";

/**
 * In the app shell (every signed-in screen): sends journey check-ins that were tapped offline as soon as the
 * connection returns or the app comes back to the foreground, not only while a Faith screen is open. Does nothing,
 * and asks the server nothing, unless a check-in is waiting on this device.
 */
export function JourneyCheckinSync({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled || !navigator.onLine || !readCheckinQueue(userId).length) return;
      const r = await flushCheckinQueue(userId, {
        journeyId: () => activeJourneyIdAction(),
        send: (activity, occurredAt) => journeyCheckInAction(activity, occurredAt),
        notify: (tone, message) => toast[tone](message),
      });
      if (r.changed && !cancelled) router.refresh();
    };
    void run();
    const onOnline = () => void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    let remove: (() => void) | undefined;
    if (isNativeApp()) {
      void import("@capacitor/app")
        .then(({ App }) => App.addListener("resume", () => void run()))
        .then((h) => {
          if (cancelled) void h.remove();
          else remove = () => void h.remove();
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      remove?.();
    };
  }, [router, userId]);
  return null;
}
