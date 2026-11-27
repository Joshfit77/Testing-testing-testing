"use client";

import { useEffect } from "react";
import { clearAllDrafts, takeDeviceCleanup } from "@/lib/drafts";
import { clearDeviceNotifications } from "@/lib/native-notifications";

/**
 * Finishes a sign-out's clean-up on the page the member lands on. Signing out clears the member's drafts and any run
 * still being recorded straight away, but the recorder can write one more time between that and the navigation (a
 * GPS fix every second); once this page has mounted the recorder is gone, so a second pass here closes that gap.
 */
export function DeviceCleanup() {
  useEffect(() => {
    const userId = takeDeviceCleanup();
    if (userId) {
      clearAllDrafts(userId);
      void clearDeviceNotifications();
    }
  }, []);
  return null;
}
