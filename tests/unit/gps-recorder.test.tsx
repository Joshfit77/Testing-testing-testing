import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFix, finishTrack, startTrack, type GpsFix, type TrackState } from "@/lib/domain/gps-track";

/**
 * The GPS recorder with the location source and the server mocked: what it keeps on the device, what it offers back
 * after a reload, and that a watcher never outlives a stop. The distance maths has its own tests (gps-track).
 */
const { location, saveAction, router, confirm } = vi.hoisted(() => ({
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
}));
vi.mock("@/lib/native/location", () => location);
vi.mock("@/server/actions/gps-activities", () => ({ saveGpsActivityAction: (input: unknown) => saveAction(input) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/ui/confirm", () => ({ confirmDialog: (options: unknown) => confirm(options) }));

const { GpsRecorder } = await import("@/components/run/gps-recorder");

const USER = "11111111-2222-4333-8444-555555555555";
const KEY = `run.recording.${USER}`;
const M_PER_DEG_LAT = 111_195;

/** A short run recorded `agoMs` before now: 60 fixes north at 3 m/s, optionally finished (never saved). */
function recorded(agoMs: number, finished: boolean): TrackState {
  const t0 = Date.now() - agoMs;
  let s = startTrack({ id: "6f1c6a52-1b2c-4d3e-8f90-123456789abc", kind: "run", unit: "km", now: t0 });
  for (let i = 0; i <= 60; i++) {
    const fix: GpsFix = { lat: 40 + (i * 3) / M_PER_DEG_LAT, lng: -75, accuracy: 5, t: t0 + i * 1000 };
    s = addFix(s, fix).state;
  }
  return finished ? finishTrack(s, t0 + 61_000) : s;
}

const stored = (track: TrackState) => localStorage.setItem(KEY, JSON.stringify({ track, guidedDayId: null }));
const props = { userId: USER, units: "metric" as const, initialKind: "run" as const, guided: null };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  location.watchLocation.mockResolvedValue(() => undefined);
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  }
});

describe("a recording left on the device", () => {
  it("offers a finished but unsaved run back for review instead of deleting it", async () => {
    stored(recorded(10 * 60_000, true));
    render(<GpsRecorder {...props} />);
    expect(await screen.findByTestId("gps-recoverable")).toHaveTextContent(/Your run from .* wasn't saved yet/);
    // Nothing was thrown away by looking at the page.
    expect(localStorage.getItem(KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review and save" }));
    expect(await screen.findByTestId("gps-review")).toBeInTheDocument();
    expect(screen.getByTestId("review-distance")).not.toHaveTextContent(/^0(\.00)? /);
    // Reviewing a finished run never turns location on.
    expect(location.watchLocation).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("still offers an unfinished run to continue, and continuing turns location back on", async () => {
    stored(recorded(5 * 60_000, false));
    render(<GpsRecorder {...props} />);
    expect(await screen.findByTestId("gps-recoverable")).toHaveTextContent(/You have an unfinished run/);
    fireEvent.click(screen.getByRole("button", { name: "Continue recording" }));
    expect(await screen.findByTestId("gps-recording")).toBeInTheDocument();
    await waitFor(() => expect(location.watchLocation).toHaveBeenCalledTimes(1));
  });

  it("removes only a draft too old to matter", async () => {
    stored(recorded(13 * 3600_000, true));
    render(<GpsRecorder {...props} />);
    expect(await screen.findByTestId("gps-start")).toBeInTheDocument();
    expect(screen.queryByTestId("gps-recoverable")).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps a finished run on the device while Pro has lapsed, without offering to save it", async () => {
    stored(recorded(10 * 60_000, true));
    render(<GpsRecorder {...props} canRecord={false} />);
    expect(await screen.findByTestId("gps-recoverable")).toBeInTheDocument();
    expect(screen.getByText(/until you have Pro All Access to finish and save it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review and save" })).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });
});

describe("the location watcher", () => {
  it("is stopped at once when Pause came while it was still starting (a leaked native watcher would keep GPS on)", async () => {
    let resolveWatcher: (stop: () => void) => void = () => undefined;
    location.watchLocation.mockImplementation(() => new Promise<() => void>((resolve) => (resolveWatcher = resolve)));
    render(<GpsRecorder {...props} />);
    fireEvent.click(await screen.findByTestId("gps-start"));
    expect(await screen.findByTestId("gps-recording")).toBeInTheDocument();
    // Pause while the permission prompt is still up (the watcher promise has not resolved).
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Paused")).toBeInTheDocument();
    const stop = vi.fn();
    resolveWatcher(stop);
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });

  it("is started once per Start and stopped by Finish", async () => {
    const stop = vi.fn();
    location.watchLocation.mockResolvedValue(stop);
    render(<GpsRecorder {...props} />);
    fireEvent.click(await screen.findByTestId("gps-start"));
    await waitFor(() => expect(location.watchLocation).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByTestId("gps-review")).toBeInTheDocument();
    expect(stop).toHaveBeenCalledTimes(1);
    // The finished recording stays on the device until it is saved or discarded.
    expect(JSON.parse(localStorage.getItem(KEY)!).track.status).toBe("finished");
  });
});
