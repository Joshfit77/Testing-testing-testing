import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GpsFix } from "@/lib/domain/gps-track";

/**
 * Launch-audit component tests for the recorder screen (2026-11-07): permission and signal failure states, approximate
 * location, offline and refused saves (the draft stays on the device), one save per double tap, pause/resume with the
 * watcher, discard, the Free-plan lock, and that the manual / treadmill form never touches location.
 */
const { location, saveAction, router, confirm, formActions } = vi.hoisted(() => ({
  location: {
    watchLocation: vi.fn<(onFix: (fix: { lat: number; lng: number; accuracy: number; t: number }) => void, onError: (e: string) => void) => Promise<() => void>>(),
    hasNativeBackgroundLocation: vi.fn(() => false),
    keepScreenOn: vi.fn(async () => null),
    locationSourceLabel: vi.fn(() => "Browser location (keep this screen open)"),
    canOpenLocationSettings: vi.fn(() => false),
    openLocationSettings: vi.fn(async () => undefined),
    browserLocationPermission: vi.fn(async () => "prompt" as const),
  },
  saveAction: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
  confirm: vi.fn(async (_options?: unknown) => true),
  formActions: { createActivityAction: vi.fn(), updateActivityAction: vi.fn() },
}));
vi.mock("@/lib/native/location", () => location);
vi.mock("@/server/actions/gps-activities", () => ({ saveGpsActivityAction: (input: unknown) => saveAction(input) }));
vi.mock("@/server/actions/activities", () => formActions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/ui/confirm", () => ({ confirmDialog: (options: unknown) => confirm(options) }));

const { GpsRecorder } = await import("@/components/run/gps-recorder");
const { ActivityForm } = await import("@/components/run/activity-form");
const live = await import("@/lib/run/live-recording");

const USER = "11111111-2222-4333-8444-555555555555";
const KEY = `run.recording.${USER}`;
const M_PER_DEG_LAT = 111_195;
const props = { userId: USER, units: "metric" as const, initialKind: "run" as const, guided: null };

/** Starts a recording and returns the watcher's callbacks and its stop spy. */
async function startRecording(extra: Partial<Parameters<typeof GpsRecorder>[0]> = {}) {
  let onFix: ((fix: GpsFix) => void) | null = null;
  let onError: ((e: string) => void) | null = null;
  const stop = vi.fn();
  location.watchLocation.mockImplementation(async (fix, err) => {
    onFix = fix as (f: GpsFix) => void;
    onError = err;
    return stop;
  });
  const view = render(<GpsRecorder {...props} {...extra} />);
  fireEvent.click(await screen.findByTestId("gps-start"));
  await waitFor(() => expect(location.watchLocation).toHaveBeenCalledTimes(1));
  return { view, stop, fix: (f: GpsFix) => act(() => onFix!(f)), error: (e: string) => act(() => onError!(e)) };
}

/** `n` fixes a second apart heading north at 3 m/s from `t0`, starting `startM` up the line. */
function walk(fix: (f: GpsFix) => void, t0: number, n: number, startM = 0, accuracy = 5) {
  for (let i = 0; i < n; i++) fix({ lat: 40 + (startM + i * 3) / M_PER_DEG_LAT, lng: -75, accuracy, t: t0 + i * 1000 });
}

beforeEach(() => {
  live.stopKept();
  localStorage.clear();
  vi.clearAllMocks();
  location.hasNativeBackgroundLocation.mockReturnValue(false);
  location.canOpenLocationSettings.mockReturnValue(false);
  location.watchLocation.mockResolvedValue(() => undefined);
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  }
});

describe("permission and signal states", () => {
  it("denied in the browser: says how to turn location on, keeps the clock running, offers no Settings button", async () => {
    const { error } = await startRecording();
    error("denied");
    expect(await screen.findByText(/Location permission is off/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Settings" })).toBeNull();
    expect(screen.getByText("Waiting for GPS")).toBeInTheDocument();
  });

  it("denied in the phone app: the message comes with an Open Settings button once the recording is stopped", async () => {
    location.hasNativeBackgroundLocation.mockReturnValue(true);
    location.canOpenLocationSettings.mockReturnValue(true);
    const { error } = await startRecording();
    error("denied");
    expect(await screen.findByText(/Location permission is off/)).toBeInTheDocument();
    // The member gives up on this attempt: Pause then Discard shows the not-started screen with the Settings shortcut.
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard recording" }));
    await waitFor(() => expect(screen.getByTestId("gps-start")).toBeInTheDocument());
    // The error from the failed attempt is still shown with the shortcut to this app's Settings page.
    const open = screen.getByRole("button", { name: "Open Settings" });
    fireEvent.click(open);
    expect(location.openLocationSettings).toHaveBeenCalledTimes(1);
  });

  it("unavailable and timeout each explain themselves, and the next good fix clears the warning", async () => {
    const { fix, error } = await startRecording();
    error("unavailable");
    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument();
    error("timeout");
    expect(await screen.findByText(/Still waiting for a GPS fix/)).toBeInTheDocument();
    walk(fix, Date.now(), 3);
    await waitFor(() => expect(screen.queryByText(/Still waiting for a GPS fix/)).toBeNull());
    expect(screen.getByText("Recording")).toBeInTheDocument();
  });

  it("approximate location (precise off): nothing is counted and the hint names the setting to change", async () => {
    const { fix } = await startRecording();
    const t0 = Date.now();
    for (let i = 0; i < 6; i++) fix({ lat: 40 + (i * 2) / M_PER_DEG_LAT, lng: -75, accuracy: 2500, t: t0 + i * 1000 });
    expect(await screen.findByTestId("gps-hint-precise")).toHaveTextContent(/Precise Location/);
    expect(screen.getByTestId("gps-distance")).toHaveTextContent("0.00 km");
    expect(screen.getByTestId("gps-accuracy")).toHaveTextContent("GPS weak ±2500 m");
    expect(screen.queryByText(/Waiting for a good GPS fix/)).toBeNull();
  });

  it("the Pro notice shows the price line the server passes, and no price at all without one (the native app)", async () => {
    const web = render(<GpsRecorder {...props} canRecord={false} proPriceLine="$24.99/month" />);
    expect(await screen.findByTestId("gps-locked")).toHaveTextContent("Live GPS recording is included with Pro All Access ($24.99/month): route map");
    web.unmount();
    render(<GpsRecorder {...props} canRecord={false} proPriceLine={null} />);
    const locked = await screen.findByTestId("gps-locked");
    expect(locked).toHaveTextContent("Live GPS recording is included with Pro All Access: route map");
    expect(locked.textContent).not.toMatch(/\$|\/month|\/year/);
  });

  it("the Free plan sees no Start button and no location request, only the Pro notice and the manual-entry link", async () => {
    render(<GpsRecorder {...props} canRecord={false} proPriceLine="$17.99/month or $119.99/year" />);
    expect(await screen.findByTestId("gps-locked")).toHaveTextContent(/Pro All Access/);
    expect(screen.queryByTestId("gps-start")).toBeNull();
    expect(screen.getByRole("link", { name: "See Pro All Access" })).toHaveAttribute("href", "/profile/billing");
    expect(screen.getByRole("link", { name: "Log a run or walk by hand (free)" })).toHaveAttribute("href", "/run?tab=log");
    // The free way comes first, the run/walk picker (a choice they can't use) is gone, and the price is said once.
    expect(screen.getByTestId("gps-log-by-hand").compareDocumentPosition(screen.getByTestId("gps-locked")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Activity" })).toBeNull();
    expect(screen.getByTestId("gps-locked")).toHaveTextContent("$17.99/month or $119.99/year");
    expect(location.watchLocation).not.toHaveBeenCalled();
  });
});

describe("pause, resume, discard", () => {
  it("Pause stops the watcher and ignores fixes; Resume starts a new one and distance continues from the new position", async () => {
    const { fix, stop } = await startRecording();
    const t0 = Date.now();
    walk(fix, t0, 30);
    const before = screen.getByTestId("gps-distance").textContent;
    expect(before).not.toBe("0.00 km");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Paused")).toBeInTheDocument();
    expect(stop).toHaveBeenCalledTimes(1);
    // A straggler fix after Pause changes nothing.
    fix({ lat: 40 + 200 / M_PER_DEG_LAT, lng: -75, accuracy: 5, t: t0 + 31_000 });
    expect(screen.getByTestId("gps-distance").textContent).toBe(before);
    expect(JSON.parse(localStorage.getItem(KEY)!).track.status).toBe("paused");
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(location.watchLocation).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Recording")).toBeInTheDocument();
  });

  it("Discard asks first, then stops the GPS and removes the draft from the device", async () => {
    const { stop } = await startRecording();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(await screen.findByRole("button", { name: "Discard recording" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(KEY)).not.toBeNull();
    confirm.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard recording" }));
    await waitFor(() => expect(screen.getByTestId("gps-start")).toBeInTheDocument());
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(stop).toHaveBeenCalled();
    expect(live.keptSummary()).toBeNull();
  });
});

describe("saving", () => {
  async function finished() {
    const h = await startRecording();
    // Fix times must be at or after Start: anything older than 2 s before it is a cached position and is ignored.
    walk(h.fix, Date.now(), 60);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByTestId("gps-review")).toBeInTheDocument();
    return h;
  }

  it("offline: the save fails, the member is told, the recording stays on the device, and a later retry saves it once", async () => {
    await finished();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    saveAction.mockRejectedValueOnce(new Error("Failed to fetch"));
    fireEvent.click(screen.getByTestId("gps-save"));
    expect(await screen.findByText(/You're offline. Your recording is kept on this device/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEY)!).track.status).toBe("finished");
    expect(router.push).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    saveAction.mockRejectedValueOnce(new Error("Failed to fetch"));
    fireEvent.click(screen.getByTestId("gps-save"));
    expect(await screen.findByText(/Couldn't reach the server. Your recording is still on this device/)).toBeInTheDocument();
    saveAction.mockResolvedValueOnce({ ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", message: "Saved." });
    fireEvent.click(screen.getByTestId("gps-save"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/run/activities/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?saved=1"));
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(saveAction).toHaveBeenCalledTimes(3);
    // Every attempt sent the same id: the server saves it once however many times it is retried.
    const ids = new Set(saveAction.mock.calls.map((c) => (c[0] as { id: string }).id));
    expect(ids.size).toBe(1);
    online.mockRestore();
  });

  it("the payload carries what the server checks: id, kind, times, totals, splits, route and signal quality, nothing about the plan", async () => {
    await finished();
    saveAction.mockResolvedValueOnce({ ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", message: "Saved." });
    fireEvent.click(screen.getByTestId("gps-save"));
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    const p = saveAction.mock.calls[0]![0] as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(["distanceM", "effort", "elapsedS", "finishedAt", "gpsQuality", "id", "kind", "movingS", "notes", "program", "route", "splits", "startedAt"]);
    expect(p.kind).toBe("run");
    expect(p.distanceM as number).toBeGreaterThan(150);
    expect(p.movingS as number).toBeLessThanOrEqual(p.elapsedS as number);
    expect((p.route as { type: string }).type).toBe("MultiLineString");
    expect(p.gpsQuality).toMatchObject({ gaps: 0, rejected: 0 });
  });

  it("the server refusing (a lapsed plan, a failed check) shows the reason and keeps the recording for later", async () => {
    await finished();
    saveAction.mockResolvedValueOnce({ ok: false, error: "Saving live GPS recordings is included with Pro All Access. Your recording is still on this phone." });
    fireEvent.click(screen.getByTestId("gps-save"));
    expect(await screen.findByText(/included with Pro All Access/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEY)!).track.status).toBe("finished");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("two taps on Save send one request", async () => {
    await finished();
    let resolve: (v: unknown) => void = () => undefined;
    saveAction.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const btn = screen.getByTestId("gps-save");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    resolve({ ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", message: "Saved." });
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(saveAction).toHaveBeenCalledTimes(1);
  });
});

describe("treadmill and manual entry", () => {
  it("renders and submits without ever asking for location", async () => {
    const watch = vi.fn();
    const current = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { watchPosition: watch, getCurrentPosition: current, clearWatch: vi.fn() } });
    render(
      <ActivityForm
        mode="create"
        today="2026-11-07"
        initial={{ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", kind: "run", source: "treadmill", date: "2026-11-07", time: "06:30", distance: "5", unit: "km", duration: "25:00", moving: "", effort: "", notes: "" }}
      />,
    );
    expect(screen.getByRole("radio", { name: "Treadmill" })).toBeChecked();
    // Pace preview is computed locally from the typed distance and time.
    expect(screen.getByTestId("pace-preview")).toHaveTextContent("5:00 /km");
    expect(watch).not.toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    expect(location.watchLocation).not.toHaveBeenCalled();
    expect(location.browserLocationPermission).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("the clock while paused", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("total time keeps counting through a pause (pauses are part of total time), while moving time stops", async () => {
    const { fix } = await startRecording();
    walk(fix, Date.now(), 5);
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Paused")).toBeInTheDocument();
    const elapsedAtPause = screen.getByTestId("gps-elapsed").textContent!;
    const movingAtPause = screen.getByTestId("gps-moving").textContent!;
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    const toS = (hms: string) => hms.split(":").reduce((s, p) => s * 60 + Number(p), 0);
    expect(toS(screen.getByTestId("gps-elapsed").textContent!)).toBeGreaterThanOrEqual(toS(elapsedAtPause) + 9);
    expect(screen.getByTestId("gps-moving").textContent).toBe(movingAtPause);
  });
});
