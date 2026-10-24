"use client";

/**
 * Apple Health (iOS) / Health Connect (Android) sleep via @capgo/capacitor-health, read on the device and normalised
 * into the app's sessions (src/lib/domain/sleep-import.ts) before the server stores them. Apple Watch, Oura, Garmin,
 * WHOOP and others reach the app this way: whatever they write to the platform is what is read, stages included.
 * Alongside the sleep records, the overnight heart rate, HRV and respiratory rate samples the platform holds are
 * summarised per session when the member allowed them. Like the step sync, every function is a safe no-op outside
 * the native shells. Not yet verified on a physical phone.
 */
import { samplesToSessions, summarizeVitals, type ImportedSession, type PlatformSleepSample, type PlatformVitalSample } from "@/lib/domain/sleep-import";
import { HEALTH_APP_NAME, HEALTH_SOURCE, healthSyncPlatform, type HealthPlatform, type HealthSource } from "@/lib/native-health";

/** The measurement series read next to sleep. Each is optional: the member can allow sleep alone. */
export const SLEEP_VITAL_TYPES = ["heartRate", "heartRateVariability", "respiratoryRate"] as const;
export type SleepVitalType = (typeof SLEEP_VITAL_TYPES)[number];
export const SLEEP_VITAL_LABEL: Record<SleepVitalType, string> = { heartRate: "heart rate", heartRateVariability: "heart-rate variability", respiratoryRate: "respiratory rate" };

export type SleepReadResult =
  | {
      ok: true;
      platform: HealthPlatform;
      source: HealthSource;
      timezone: string;
      rangeStart: string;
      rangeEnd: string;
      sessions: ImportedSession[];
      /** Which measurement series were read, and which the platform said were not allowed (Android only reports denial). */
      vitalsRead: SleepVitalType[];
      vitalsDenied: SleepVitalType[];
    }
  | { ok: false; message: string };

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Ask for read access to sleep (and the overnight measurements), then read the last `days` days of records. Never throws. */
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
    const auth = await Health.requestAuthorization({ read: ["sleep", ...SLEEP_VITAL_TYPES] });
    // HealthKit never says whether reading was allowed (an empty result looks the same); Health Connect does.
    const denied = new Set(platform === "android" ? auth.readDenied : []);
    if (denied.has("sleep") && !auth.readAuthorized.includes("sleep")) {
      return { ok: false, message: "Sleep access wasn't allowed. Open Health Connect > App permissions > Narrow Gate and allow Sleep." };
    }
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const { samples } = await Health.readSamples({ dataType: "sleep", startDate: start.toISOString(), endDate: end.toISOString(), limit: 2000, ascending: true });
    const sessions = samplesToSessions(samples as PlatformSleepSample[]);
    if (!sessions.length) {
      return { ok: false, message: platform === "ios" ? `No sleep found in ${appName} for the last ${days} days. Check Health > Sharing > Apps > Narrow Gate and turn on Sleep.` : `No sleep found in Health Connect for the last ${days} days. Check that your watch or sleep app writes sleep to Health Connect.` };
    }

    // One read per series over the whole window, then summarised inside each session; a refusal or a series the
    // device doesn't record just leaves that figure out.
    const vitalsRead: SleepVitalType[] = [];
    const vitalsDenied: SleepVitalType[] = [];
    const series: Partial<Record<SleepVitalType, PlatformVitalSample[]>> = {};
    const first = Math.min(...sessions.map((s) => Date.parse(s.startedAt)));
    const last = Math.max(...sessions.map((s) => Date.parse(s.endedAt)));
    for (const type of SLEEP_VITAL_TYPES) {
      if (denied.has(type)) {
        vitalsDenied.push(type);
        continue;
      }
      try {
        const res = await Health.readSamples({ dataType: type, startDate: new Date(first).toISOString(), endDate: new Date(last).toISOString(), limit: type === "heartRate" ? 20000 : 5000, ascending: true });
        series[type] = res.samples.map((s) => ({ startDate: s.startDate, endDate: s.endDate, value: s.value, sourceName: s.sourceName }));
        if (res.samples.length) vitalsRead.push(type);
      } catch {
        /* the series stays unknown */
      }
    }
    const hrvMethod = platform === "ios" ? "sdnn" : "rmssd";
    for (const s of sessions) {
      s.vitals = summarizeVitals(s.startedAt, s.endedAt, { heartRate: series.heartRate, hrv: series.heartRateVariability, respiratoryRate: series.respiratoryRate }, hrvMethod);
    }
    return { ok: true, platform, source: HEALTH_SOURCE[platform], timezone: deviceTimeZone(), rangeStart: start.toISOString(), rangeEnd: end.toISOString(), sessions, vitalsRead, vitalsDenied };
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message.slice(0, 120)})` : "";
    return { ok: false, message: `Couldn't read sleep from ${appName}${detail}. Please try again.` };
  }
}
