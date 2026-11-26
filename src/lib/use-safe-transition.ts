"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback, useTransition, type TransitionFunction } from "react";
import { toast } from "@/components/ui/toaster";

/** The message for a server action that never answered (no connection, a dropped request, a server error). */
export function actionFailureMessage(online: boolean = typeof navigator === "undefined" || navigator.onLine): string {
  return online ? "That didn't go through. Please try again." : "You appear to be offline. Try again when you're connected.";
}

/**
 * Runs `fn`; if it throws (a server action whose request failed), shows a message instead of letting the error reach
 * the error page. Navigation from the action (a redirect to sign-in, notFound) still happens. Returns whether `fn`
 * finished without throwing.
 */
export async function runSafely(fn: () => unknown, onError?: (message: string) => void): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    unstable_rethrow(err);
    const message = actionFailureMessage();
    if (onError) onError(message);
    else toast.error(message);
    return false;
  }
}

/**
 * `useTransition` for screens that call server actions: a thrown action (a network blip) shows a message and leaves the
 * screen as it was, instead of replacing the screen with the error page. Use it wherever a transition awaits an action.
 */
export function useSafeTransition(): [boolean, (fn: TransitionFunction | (() => unknown)) => void] {
  const [pending, start] = useTransition();
  const safeStart = useCallback(
    (fn: TransitionFunction | (() => unknown)) => {
      start(async () => {
        await runSafely(fn);
      });
    },
    [start],
  );
  return [pending, safeStart];
}
