"use client";

import type { ReactNode } from "react";
import { clearAllDrafts, markDeviceCleanup } from "@/lib/drafts";

/**
 * The one way to sign out: clears this member's drafts and any run still being recorded from the device before the
 * sign-out action runs, and leaves a marker so the login page clears again once the recorder is gone
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
      }}
    >
      {children}
    </form>
  );
}
