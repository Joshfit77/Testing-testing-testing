"use client";

import { useEffect } from "react";
import { clearAllDrafts } from "@/lib/drafts";
import { storeLogOut } from "@/lib/billing/store-purchases";
import { clearDeviceNotifications } from "@/lib/native-notifications";

/**
 * Shown after an account is deleted: removes what the app kept on this device — form drafts, the
 * in-progress workout copy, this tab's navigation memory, every notification the app scheduled (reminders, sleep
 * alarm, rest timer) and the store purchase identity (RevenueCat). Display preferences (text size, motion) are not
 * personal data and are left alone.
 */
export function ForgetDeviceData() {
  useEffect(() => {
    clearAllDrafts();
    void clearDeviceNotifications();
    void storeLogOut();
    try {
      for (const store of [localStorage, sessionStorage]) {
        const doomed: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && (k.startsWith("ngf.workout.draft.") || k.startsWith("ngf.nav.") || k.startsWith("ngf.scroll.") || k.startsWith("ngf.ui."))) doomed.push(k);
        }
        doomed.forEach((k) => store.removeItem(k));
      }
    } catch {
      /* storage unavailable */
    }
  }, []);
  return null;
}
