"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { storeLogOut } from "@/lib/billing/store-purchases";
import { clearAllDrafts, markDeviceCleanup } from "@/lib/drafts";
import { draftSnapshot } from "@/lib/domain/workout-draft";
import { clearDeviceNotifications } from "@/lib/native-notifications";
import { discardedWorkoutIds, loadLocalDraft } from "@/lib/workout-storage";
import { confirmDialog } from "@/components/ui/confirm";
import { syncWorkoutDraftAction } from "@/server/actions/workouts";

/** The workout in progress on this device that the account may not have yet (none once discarded). */
function workoutAtRisk(userId: string) {
  const draft = loadLocalDraft(userId);
  return draft && !discardedWorkoutIds(userId).includes(draft.clientId) ? draft : null;
}

/**
 * Before the device forgets a workout in progress, make sure the member's account has it. Signing out clears this
 * device (below), and that used to delete a workout whose latest sets had not reached the server yet (logged offline,
 * or just before signing out). Returns true when it is safe to clear: no workout in progress, or the server confirmed
 * the latest copy, or the member chose to sign out anyway.
 */
export async function workoutSafeToClear(userId: string): Promise<boolean> {
  const draft = workoutAtRisk(userId);
  if (!draft) return true;
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const saved = online ? await syncWorkoutDraftAction(draftSnapshot(draft)).then((r) => r.ok, () => false) : false;
  if (saved) return true;
  return confirmDialog({
    title: "Your workout isn't saved to your account yet",
    message:
      "The workout in progress is only on this device, because the connection isn't working right now. If you sign out, it will be deleted from this device. Stay signed in and reconnect to keep it.",
    confirmLabel: "Sign out and delete it",
    destructive: true,
  });
}

/**
 * The one way to sign out: makes sure a workout in progress is saved to the account (workoutSafeToClear), then clears
 * this member's drafts, any run still being recorded and every notification this app scheduled (reminders, sleep
 * alarm, rest timer) from the device, and detaches the device from their App Store purchase identity (RevenueCat),
 * before the sign-out action runs, and leaves a marker so the login page clears again once the recorder is gone
 * (src/components/platform/device-cleanup.tsx). Both the tab bar and the profile page use it.
 */
export function SignOutForm({ action, userId, children, className }: { action: () => Promise<void>; userId: string; children: ReactNode; className?: string }) {
  const [checking, setChecking] = useState(false);
  const [, startTransition] = useTransition();
  const clearDevice = () => {
    clearAllDrafts(userId);
    markDeviceCleanup(userId);
    void storeLogOut();
    // Reminders, the sleep alarm and any rest timer belong to this member: none may reach the next person.
    void clearDeviceNotifications();
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // No workout in progress: the form signs out as it always has.
    if (!workoutAtRisk(userId)) {
      clearDevice();
      return;
    }
    // A workout in progress: save it to the account (or ask) before anything on the device is cleared.
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    void workoutSafeToClear(userId).then((ok) => {
      setChecking(false);
      if (!ok) return;
      clearDevice();
      startTransition(() => action());
    });
  };
  return (
    <form action={action} className={className} onSubmit={onSubmit} aria-busy={checking || undefined}>
      {children}
    </form>
  );
}
