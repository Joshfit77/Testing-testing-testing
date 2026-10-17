"use client";

/**
 * Apple Health (iOS) / Health Connect (Android) step reading via @capgo/capacitor-health.
 * Only runs inside the Capacitor shells when the native "Health" plugin is registered;
 * every function is a safe no-op in a regular browser / installed PWA.
 */
import { isoDateInTz } from "@/lib/domain/dates";
import { lastNDates, stepsByDay, syncPayload, type DaySteps } from "@/lib/domain/steps";
import { isNativeApp } from "@/lib/native";

type CapacitorGlobal = {
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  PluginHeaders?: { name: string }[];
};

export type HealthPlatform = "ios" | "android";
export type HealthSource = "apple_health" | "health_connect";

export const HEALTH_APP_NAME: Record<HealthPlatform, string> = { ios: "Apple Health", android: "Health Connect" };
export const HEALTH_SOURCE: Record<HealthPlatform, HealthSource> = { ios: "apple_health", android: "health_connect" };

/** "ios" / "android" when step sync can be offered on this device, otherwise null. */
export function healthSyncPlatform(): HealthPlatform | null {
  if (!isNativeApp()) return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  // PluginHeaders is injected by the native shell before @capacitor/core loads, so check both.
  if (!cap?.isPluginAvailable?.("Health") && !cap?.PluginHeaders?.some((h) => h.name === "Health")) return null;
  const platform = cap.getPlatform?.();
  return platform === "ios" || platform === "android" ? platform : null;
}

export type HealthReadResult =
  | { ok: true; platform: HealthPlatform; source: HealthSource; days: DaySteps[] }
  | { ok: false; message: string };

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Ask for read access to steps, then read daily step totals for the last `days` days (including today).
 * Returns only days that have steps, ready for syncStepsAction. Never throws.
 */
export async function readRecentSteps(days = 7): Promise<HealthReadResult> {
  const platform = healthSyncPlatform();
  if (!platform) return { ok: false, message: "Step sync is only available in the Narrow Gate phone app." };
  const appName = HEALTH_APP_NAME[platform];
  try {
    const { Health } = await import("@capgo/capacitor-health");
    const availability = await Health.isAvailable();
    if (!availability.available) {
      return {
        ok: false,
        message:
          platform === "android"
            ? "Health Connect isn't available on this phone. Install or update Health Connect from the Play Store (Android 8 or newer)."
            : `Apple Health isn't available on this device${availability.reason ? ` (${availability.reason})` : ""}.`,
      };
    }

    const auth = await Health.requestAuthorization({ read: ["steps"] });
    // Health Connect reports a denial; Apple Health never reveals whether read access was denied.
    if (platform === "android" && auth.readDenied.includes("steps") && !auth.readAuthorized.includes("steps")) {
      return { ok: false, message: "Step access wasn't allowed. Open Health Connect > App permissions > Narrow Gate and allow Steps." };
    }

    const tz = deviceTimeZone();
    const now = new Date();
    const dates = lastNDates(isoDateInTz(now, tz), days);
    // Local midnight at the start of the window, in the phone's own time zone.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    const { samples } = await Health.queryAggregated({
      dataType: "steps",
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      bucket: "day",
      aggregation: "sum",
    });
    const payload = syncPayload(dates, stepsByDay(samples, tz));
    if (payload.length === 0) {
      return {
        ok: false,
        message:
          platform === "ios"
            ? "No steps found — check Health > Sharing > Apps > Narrow Gate and turn on Steps."
            : `No steps found in Health Connect for the last ${days} days. Check that your step-counting app writes to Health Connect.`,
      };
    }
    return { ok: true, platform, source: HEALTH_SOURCE[platform], days: payload };
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message.slice(0, 120)})` : "";
    return { ok: false, message: `Couldn't read steps from ${appName}${detail}. Please try again.` };
  }
}
