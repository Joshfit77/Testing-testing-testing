"use client";

/**
 * Navigation started from native code (a notification tap, the alarm's "I'm up", an app link) goes through the app's
 * client-side router when a page is listening, instead of a full page load. A full load resets the Capacitor bridge,
 * which drops the GPS watcher's callback mid-run and stops the live recording. src/components/shell/native-init.tsx
 * listens; without a listener (very early in start-up) it falls back to a normal page load.
 */
export const NAVIGATE_EVENT = "ngf:navigate";

export function navigateInApp(path: string): void {
  if (typeof window === "undefined") return;
  const event = new CustomEvent<string>(NAVIGATE_EVENT, { detail: path, cancelable: true });
  window.dispatchEvent(event);
  if (!event.defaultPrevented) window.location.assign(path);
}
