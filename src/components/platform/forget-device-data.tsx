"use client";

import { useEffect } from "react";
import { clearAllDrafts } from "@/lib/drafts";

/**
 * Shown after an account is deleted: removes what the app kept on this device — form drafts, the
 * in-progress workout copy and this tab's navigation memory. Display preferences (text size, motion)
 * are not personal data and are left alone.
 */
export function ForgetDeviceData() {
  useEffect(() => {
    clearAllDrafts();
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
