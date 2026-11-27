import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The location source behind the GPS recorder, with the Capacitor bridge mocked: the native background watcher
 * (iPhone / Android) and the browser fallback. The real watcher needs a phone (docs/RUN_TRACKING_PLAN.md).
 */
const { cap, bg, notifications } = vi.hoisted(() => ({
  cap: { isNativePlatform: vi.fn(() => false), isPluginAvailable: vi.fn(() => false), getPlatform: vi.fn(() => "web") },
  bg: { addWatcher: vi.fn(), removeWatcher: vi.fn(async () => undefined), openSettings: vi.fn(async () => undefined) },
  notifications: { checkPermissions: vi.fn(), requestPermissions: vi.fn() },
}));
vi.mock("@capacitor/core", () => ({ Capacitor: cap, registerPlugin: () => bg }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: notifications }));

const { canOpenLocationSettings, hasNativeBackgroundLocation, openLocationSettings, watchLocation } = await import("@/lib/native/location");

type BgCallback = (location?: { latitude: number; longitude: number; accuracy: number; time: number | null; simulated?: boolean }, error?: { code?: string; message?: string }) => void;

function native(platform: "ios" | "android") {
  cap.isNativePlatform.mockReturnValue(true);
  cap.isPluginAvailable.mockReturnValue(true);
  cap.getPlatform.mockReturnValue(platform);
}

beforeEach(() => {
  vi.clearAllMocks();
  cap.isNativePlatform.mockReturnValue(false);
  cap.isPluginAvailable.mockReturnValue(false);
  cap.getPlatform.mockReturnValue("web");
  notifications.checkPermissions.mockResolvedValue({ display: "granted" });
  notifications.requestPermissions.mockResolvedValue({ display: "granted" });
  bg.addWatcher.mockResolvedValue("watcher-1");
});

describe("native background watcher", () => {
  it("on iPhone starts a background watcher that asks for permission, ignores simulated or stale fixes, and stops cleanly", async () => {
    native("ios");
    let deliver: BgCallback = () => undefined;
    bg.addWatcher.mockImplementation(async (_opts: unknown, cb: BgCallback) => {
      deliver = cb;
      return "watcher-1";
    });
    const onFix = vi.fn();
    const onError = vi.fn();
    const stop = await watchLocation(onFix, onError);
    expect(hasNativeBackgroundLocation()).toBe(true);
    expect(bg.addWatcher).toHaveBeenCalledWith(expect.objectContaining({ backgroundTitle: "Recording your run", requestPermissions: true, stale: false, distanceFilter: 0 }), expect.any(Function));
    // iOS has no notification permission to ask for.
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    deliver({ latitude: 40, longitude: -75, accuracy: 6, time: 1_700_000_000_000 });
    expect(onFix).toHaveBeenLastCalledWith({ lat: 40, lng: -75, accuracy: 6, t: 1_700_000_000_000 });
    deliver({ latitude: 41, longitude: -75, accuracy: 6, time: 1_700_000_001_000, simulated: true });
    expect(onFix).toHaveBeenCalledTimes(1);
    const before = Date.now();
    deliver({ latitude: 40.001, longitude: -75, accuracy: 6, time: null });
    expect(onFix.mock.calls[1]![0].t).toBeGreaterThanOrEqual(before);
    deliver(undefined, { code: "NOT_AUTHORIZED", message: "Permission denied." });
    expect(onError).toHaveBeenLastCalledWith("denied");
    deliver(undefined, { message: "Location services disabled." });
    expect(onError).toHaveBeenLastCalledWith("unavailable");
    stop();
    expect(bg.removeWatcher).toHaveBeenCalledWith({ id: "watcher-1" });
  });

  it("on Android asks for the notification permission before the foreground-service watcher starts", async () => {
    native("android");
    notifications.checkPermissions.mockResolvedValue({ display: "prompt" });
    await watchLocation(vi.fn(), vi.fn());
    expect(notifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(notifications.requestPermissions.mock.invocationCallOrder[0]!).toBeLessThan(bg.addWatcher.mock.invocationCallOrder[0]!);
  });

  it("on Android does not ask again once notifications were allowed or refused, and starts even without the plugin", async () => {
    native("android");
    notifications.checkPermissions.mockResolvedValue({ display: "denied" });
    await watchLocation(vi.fn(), vi.fn());
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(bg.addWatcher).toHaveBeenCalledTimes(1);
    notifications.checkPermissions.mockRejectedValue(new Error("plugin missing"));
    await watchLocation(vi.fn(), vi.fn());
    expect(bg.addWatcher).toHaveBeenCalledTimes(2);
  });

  it("can open the phone's Settings after a refusal, only in the app", async () => {
    expect(canOpenLocationSettings()).toBe(false);
    await openLocationSettings();
    expect(bg.openSettings).not.toHaveBeenCalled();
    native("ios");
    expect(canOpenLocationSettings()).toBe(true);
    await openLocationSettings();
    expect(bg.openSettings).toHaveBeenCalledTimes(1);
  });
});

describe("browser fallback", () => {
  it("uses watchPosition with high accuracy and clears the watch on stop", async () => {
    const watchPosition = vi.fn((success: (p: GeolocationPosition) => void) => {
      success({ coords: { latitude: 40, longitude: -75, accuracy: 8 }, timestamp: 1_700_000_000_000 } as GeolocationPosition);
      return 7;
    });
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { watchPosition, clearWatch } });
    const onFix = vi.fn();
    const stop = await watchLocation(onFix, vi.fn());
    expect(watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 });
    expect(onFix).toHaveBeenCalledWith({ lat: 40, lng: -75, accuracy: 8, t: 1_700_000_000_000 });
    stop();
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(bg.addWatcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("maps the browser's errors and reports an unsupported browser", async () => {
    const watchPosition = vi.fn((_s: unknown, error: (e: GeolocationPositionError) => void) => {
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" } as GeolocationPositionError);
      error({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" } as GeolocationPositionError);
      return 1;
    });
    vi.stubGlobal("navigator", { ...navigator, geolocation: { watchPosition, clearWatch: vi.fn() } });
    const onError = vi.fn();
    await watchLocation(vi.fn(), onError);
    expect(onError.mock.calls.map((c) => c[0])).toEqual(["denied", "timeout"]);
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    const unsupported = vi.fn();
    await watchLocation(vi.fn(), unsupported);
    expect(unsupported).toHaveBeenCalledWith("unsupported");
    vi.unstubAllGlobals();
  });
});
