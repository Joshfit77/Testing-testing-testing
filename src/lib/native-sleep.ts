"use client";

/**
 * Apple Health (iOS) / Health Connect (Android) sleep records via @capgo/capacitor-health, read on the device and
 * normalised into the app's sessions (src/lib/domain/sleep-import.ts) before the server stores them. Like the step
 * sync, every function is a safe no-op outside the native shells. Not yet verified on a physical phone.
 */
import { samplesToSessions, type ImportedSession, type PlatformSleepSample } from "@/lib/domain/sleep-import";
import { HEALTH_APP_NAME, HEALTH_SOURCE, healthSyncPlatform, type HealthPlatform, type HealthSource } from "@/lib/native-health";

export type SleepReadResult =
  | { ok: true; platform: HealthPlatform; source: HealthSource; timezone: string; rangeStart: string; rangeEnd: string; sessions: ImportedSession[] }
  | { ok: false; message: string };

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Ask for read access to sleep, then read the last `days` days of records. Never throws. */
export async function readRecentSleep(days = 14): Promise<SleepReadResult> {
  const platform = healthSyncPlatform();
  if (!platform) return { ok: false, message: "Automatic import works in the Narrow Gate phone app, which reads sleep from Apple Health or Health Connect." };
  const appName = HEALTH_APP_NAME[platform];
  try {
    const { Health } = await import("@capgo/capacitor-health");
    const availability = await Health.isAvailable();
    if (!availability.available) {
      return { ok: false, message: platform === "android" ? "Health Connect isn't available on this phone. Install or update it from the Play Store." : `Apple Health isn't available on this device${availability.reason ? ` (${availability.reason})` : ""}.` };
    }
    const auth = await Health.requestAuthorization({ read: ["sleep"] });
    if (platform === "android" && auth.readDenied.includes("sleep") && !auth.readAuthorized.includes("sleep")) {
      return { ok: false, message: "Sleep access wasn't allowed. Open Health Connect > App permissions > Narrow Gate and allow Sleep." };
    }
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const { samples } = await Health.readSamples({ dataType: "sleep", startDate: start.toISOString(), endDate: end.toISOString(), limit: 2000, ascending: true });
    const sessions = samplesToSessions(samples as PlatformSleepSample[]);
    if (!sessions.length) {
      return { ok: false, message: platform === "ios" ? `No sleep found in ${appName} for the last ${days} days. Check Health > Sharing > Apps > Narrow Gate and turn on Sleep.` : `No sleep found in Health Connect for the last ${days} days. Check that your watch or sleep app writes sleep to Health Connect.` };
    }
    return { ok: true, platform, source: HEALTH_SOURCE[platform], timezone: deviceTimeZone(), rangeStart: start.toISOString(), rangeEnd: end.toISOString(), sessions };
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message.slice(0, 120)})` : "";
    return { ok: false, message: `Couldn't read sleep from ${appName}${detail}. Please try again.` };
  }
}
