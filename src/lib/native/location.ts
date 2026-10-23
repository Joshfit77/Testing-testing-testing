"use client";

/**
 * Where GPS fixes come from while a run or walk is recording.
 *
 *   - Native app (iOS / Android) with @capacitor-community/background-geolocation synced into the build: its watcher
 *     keeps delivering fixes with the screen locked (iOS background location mode; an Android foreground service with
 *     a "Recording your run" notification). NOT VERIFIED ON A DEVICE YET: see docs/RUN_TRACKING_PLAN.md.
 *   - Browser / PWA: navigator.geolocation.watchPosition, which only works while the page is visible. The recorder
 *     says so, and any time without fixes is recorded as a gap, never as movement.
 *
 * Location is requested only when the member taps Start, and every watcher stops at Pause-to-Finish or Discard.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { GpsFix } from "@/lib/domain/gps-track";

export type LocationError = "denied" | "unavailable" | "unsupported" | "timeout";

interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  time: number | null;
  simulated?: boolean;
}
interface BgPlugin {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (location?: BgLocation, error?: { code?: string; message?: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BgPlugin>("BackgroundGeolocation");

/** True when the native background watcher is part of this app build. */
export function hasNativeBackgroundLocation(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BackgroundGeolocation");
}

export function locationSourceLabel(): string {
  return hasNativeBackgroundLocation() ? "Native GPS (keeps recording with the screen locked)" : "Browser location (keep this screen open)";
}

/** Current permission state in the browser, when the browser can tell without asking. */
export async function browserLocationPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions) return "unknown";
    const s = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return s.state;
  } catch {
    return "unknown";
  }
}

/** Start delivering fixes. Returns a stop function. */
export async function watchLocation(onFix: (fix: GpsFix) => void, onError: (e: LocationError) => void): Promise<() => void> {
  if (hasNativeBackgroundLocation()) {
    const id = await BackgroundGeolocation.addWatcher(
      { backgroundTitle: "Recording your run", backgroundMessage: "Narrow Gate Fitness is recording your route. Tap to return.", requestPermissions: true, stale: false, distanceFilter: 0 },
      (location, error) => {
        if (error) {
          onError(error.code === "NOT_AUTHORIZED" ? "denied" : "unavailable");
          return;
        }
        if (!location || location.simulated) return;
        onFix({ lat: location.latitude, lng: location.longitude, accuracy: location.accuracy, t: location.time ?? Date.now() });
      },
    );
    return () => {
      void BackgroundGeolocation.removeWatcher({ id });
    };
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("unsupported");
    return () => undefined;
  }
  const watchId = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, t: p.timestamp || Date.now() }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable"),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

/** Keep the screen awake while recording in the browser, where supported (optional; drains the battery). */
export async function keepScreenOn(): Promise<(() => void) | null> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    if (!nav.wakeLock) return null;
    const lock = await nav.wakeLock.request("screen");
    return () => void lock.release();
  } catch {
    return null;
  }
}
