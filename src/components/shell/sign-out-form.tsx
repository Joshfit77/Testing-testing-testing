"use client";

import type { ReactNode } from "react";
import { storeLogOut } from "@/lib/billing/store-purchases";
import { clearAllDrafts, markDeviceCleanup } from "@/lib/drafts";
import { clearDeviceNotifications } from "@/lib/native-notifications";

/**
 * The one way to sign out: clears this member's drafts, any run still being recorded and every notification this app
 * scheduled (reminders, sleep alarm, rest timer) from the device, and detaches
 * the device from their App Store purchase identity (RevenueCat), before the sign-out action runs, and leaves a marker so the login page clears again once the recorder is gone
 * (src/components/platform/device-cleanup.tsx). Both the tab bar and the profile page use it.
 */
export function SignOutForm({ action, userId, children, className }: { action: () => Promise<void>; userId: string; children: ReactNode; className?: string }) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={() => {
        clearAllDrafts(userId);
        markDeviceCleanup(userId);
        void storeLogOut();
        // Reminders, the sleep alarm and any rest timer belong to this member: none may reach the next person.
        void clearDeviceNotifications();
      }}
    >
      {children}
    </form>
  );
}
