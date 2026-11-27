import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reading sleep from Apple Health / Health Connect through the mocked plugin: which reads are made and how the
 * answers (and refusals) are turned into sessions. The real plugin needs a phone (docs/SLEEP_DEVICE_CHECKLIST.md).
 */
const { Health } = vi.hoisted(() => ({
  Health: {
    isAvailable: vi.fn(),
    requestAuthorization: vi.fn(),
    readSamples: vi.fn(),
  },
}));
vi.mock("@capgo/capacitor-health", () => ({ Health }));

const { readRecentSleep } = await import("@/lib/native-sleep");

type Cap = { isNativePlatform: () => boolean; getPlatform: () => string; isPluginAvailable: (n: string) => boolean };
function nativePlatform(platform: "ios" | "android" | null) {
  const w = window as unknown as { Capacitor?: Cap };
  if (!platform) {
    delete w.Capacitor;
    return;
  }
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform, isPluginAvailable: (n) => n === "Health" };
}

const night = (id: string, start: string, end: string, sourceName = "Apple Watch") => ({ startDate: start, endDate: end, sleepState: "asleep", platformId: id, sourceName });

beforeEach(() => {
  vi.clearAllMocks();
  Health.isAvailable.mockResolvedValue({ available: true });
  Health.requestAuthorization.mockResolvedValue({ readAuthorized: ["sleep", "heartRate", "heartRateVariability", "respiratoryRate"], readDenied: [] });
});

describe("reading recent sleep from the health platform", () => {
  it("reads newest first within the limit, so a cut-off never drops last night, and still returns nights oldest first", async () => {
    nativePlatform("ios");
    Health.readSamples.mockImplementation(async ({ dataType }: { dataType: string }) => {
      if (dataType === "sleep") {
        // As the platform returns them when asked newest first.
        return { samples: [night("b", "2026-10-23T22:30:00Z", "2026-10-24T06:30:00Z"), night("a", "2026-10-22T22:00:00Z", "2026-10-23T06:00:00Z")] };
      }
      if (dataType === "heartRate") return { samples: [{ startDate: "2026-10-24T02:00:00Z", endDate: "2026-10-24T02:00:00Z", value: 52, sourceName: "Apple Watch" }] };
      return { samples: [] };
    });
    const res = await readRecentSleep(14);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe("apple_health");
    expect(res.sessions.map((s) => s.sourceId)).toEqual(["p:a", "p:b"]);
    expect(res.sessions[1]!.vitals?.heartRate).toMatchObject({ avg: 52, samples: 1 });
    expect(res.vitalsRead).toEqual(["heartRate"]);
    expect(res.vitalsDenied).toEqual([]);
    const reads = Health.readSamples.mock.calls.map((c) => c[0] as { dataType: string; ascending: boolean; limit: number });
    expect(reads.map((r) => r.dataType)).toEqual(["sleep", "heartRate", "heartRateVariability", "respiratoryRate"]);
    expect(reads.every((r) => r.ascending === false)).toBe(true);
    expect(reads[0]!.limit).toBe(2000);
    expect(Health.requestAuthorization).toHaveBeenCalledWith({ read: ["sleep", "heartRate", "heartRateVariability", "respiratoryRate"] });
  });

  it("says where to allow sleep when Health Connect reports a refusal", async () => {
    nativePlatform("android");
    Health.requestAuthorization.mockResolvedValue({ readAuthorized: [], readDenied: ["sleep", "heartRate"] });
    const res = await readRecentSleep(14);
    expect(res).toMatchObject({ ok: false, message: expect.stringContaining("Health Connect > App permissions") });
    expect(Health.readSamples).not.toHaveBeenCalled();
  });

  it("reports a refused measurement series on Android and still imports the sleep", async () => {
    nativePlatform("android");
    Health.requestAuthorization.mockResolvedValue({ readAuthorized: ["sleep"], readDenied: ["heartRate"] });
    Health.readSamples.mockImplementation(async ({ dataType }: { dataType: string }) => ({ samples: dataType === "sleep" ? [night("hc", "2026-10-23T22:30:00Z", "2026-10-24T06:30:00Z", "Pixel Watch")] : [] }));
    const res = await readRecentSleep(14);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe("health_connect");
    expect(res.vitalsDenied).toEqual(["heartRate"]);
    expect(Health.readSamples.mock.calls.map((c) => (c[0] as { dataType: string }).dataType)).toEqual(["sleep", "heartRateVariability", "respiratoryRate"]);
    expect(res.sessions[0]!.vitals).toBeNull();
  });

  it("explains an empty answer on iPhone, where HealthKit never says that reading was refused", async () => {
    nativePlatform("ios");
    Health.readSamples.mockResolvedValue({ samples: [] });
    const res = await readRecentSleep(14);
    expect(res).toMatchObject({ ok: false, message: expect.stringContaining("Health > Sharing > Apps > Narrow Gate") });
  });

  it("is a no-op outside the phone app and when the platform is unavailable", async () => {
    nativePlatform(null);
    expect(await readRecentSleep(14)).toMatchObject({ ok: false, message: expect.stringContaining("phone app") });
    nativePlatform("android");
    Health.isAvailable.mockResolvedValue({ available: false });
    expect(await readRecentSleep(14)).toMatchObject({ ok: false, message: expect.stringContaining("Health Connect isn't available") });
    expect(Health.requestAuthorization).not.toHaveBeenCalled();
  });

  it("never throws when the plugin does", async () => {
    nativePlatform("ios");
    Health.readSamples.mockRejectedValue(new Error("HKErrorAuthorizationNotDetermined"));
    const res = await readRecentSleep(14);
    expect(res).toMatchObject({ ok: false, message: expect.stringContaining("Couldn't read sleep from Apple Health (HKErrorAuthorizationNotDetermined)") });
  });
});
