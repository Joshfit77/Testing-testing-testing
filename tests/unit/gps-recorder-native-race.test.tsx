import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFix, startTrack, type GpsFix, type TrackState } from "@/lib/domain/gps-track";

/**
 * Recovering a run in the phone app reads the native journal (fixes written while the web view was suspended or the
 * app had been ended) asynchronously. "Continue recording" tapped before that read finishes must still get those
 * fixes: before, the late read found nothing to merge into (the offer was gone) and the fixes were dropped, then
 * deleted with the journal when the run was saved.
 */
const { location, nativeJournal } = vi.hoisted(() => ({
  location: {
    watchLocation: vi.fn(async () => () => undefined),
    hasNativeBackgroundLocation: vi.fn(() => true),
    keepScreenOn: vi.fn(async () => null),
    locationSourceLabel: vi.fn(() => "Phone GPS"),
    canOpenLocationSettings: vi.fn(() => false),
    openLocationSettings: vi.fn(async () => undefined),
    browserLocationPermission: vi.fn(async () => "granted" as const),
  },
  nativeJournal: {
    read: { resolve: (_f: unknown[]) => undefined as void, promise: null as Promise<unknown[]> | null },
    clearNativeRunJournal: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/native/location", () => location);
vi.mock("@/lib/native/run-journal", () => ({
  readNativeRunJournal: vi.fn(() => nativeJournal.read.promise!),
  clearNativeRunJournal: nativeJournal.clearNativeRunJournal,
  startNativeRunJournal: vi.fn(async () => undefined),
  stopNativeRunJournal: vi.fn(async () => undefined),
  hasNativeRunJournal: () => true,
}));
vi.mock("@/server/actions/gps-activities", () => ({ saveGpsActivityAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/confirm", () => ({ confirmDialog: vi.fn(async () => true) }));

const { GpsRecorder } = await import("@/components/run/gps-recorder");
const live = await import("@/lib/run/live-recording");

const USER = "11111111-2222-4333-8444-555555555555";
const KEY = `run.recording.${USER}`;
const M_PER_DEG_LAT = 111_195;
const T0 = Date.now() - 5 * 60_000;
const fix = (i: number): GpsFix => ({ lat: 40 + (i * 3) / M_PER_DEG_LAT, lng: -75, accuracy: 5, t: T0 + i * 1000 });
const props = { userId: USER, units: "metric" as const, initialKind: "run" as const, guided: null };

function savedTrack(): TrackState {
  let s = startTrack({ id: "6f1c6a52-1b2c-4d3e-8f90-123456789abc", kind: "run", unit: "km", now: T0 });
  for (let i = 0; i <= 60; i++) s = addFix(s, fix(i)).state;
  return s;
}
const storedTrack = () => (JSON.parse(localStorage.getItem(KEY)!) as { track: TrackState }).track;

beforeEach(() => {
  live.stopKept();
  localStorage.clear();
  vi.clearAllMocks();
  nativeJournal.read.promise = new Promise((resolve) => (nativeJournal.read.resolve = resolve as (f: unknown[]) => void));
  if (typeof globalThis.crypto?.randomUUID !== "function") vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
});

describe("Continue recording while the native journal is still being read", () => {
  it("waits for the native fixes and keeps them in the continued recording", async () => {
    const saved = savedTrack();
    localStorage.setItem(KEY, JSON.stringify({ track: saved, guidedDayId: null }));
    render(<GpsRecorder {...props} />);
    const button = await screen.findByRole("button", { name: "Continue recording" });
    // Tap before the native read has answered.
    fireEvent.click(button);
    expect(location.watchLocation).not.toHaveBeenCalled();
    // The read answers: two more minutes recorded natively while the web view was suspended.
    const native = Array.from({ length: 120 }, (_, k) => fix(61 + k));
    await act(async () => nativeJournal.read.resolve(native));
    expect(await screen.findByTestId("gps-recording")).toBeInTheDocument();
    await waitFor(() => expect(storedTrack().lastFixAt).toBe(native.at(-1)!.t));
    expect(storedTrack().distanceM).toBeGreaterThan(saved.distanceM + 300);
    await waitFor(() => expect(location.watchLocation).toHaveBeenCalledTimes(1));
  });

  it("a second tap while waiting doesn't start a second recording or watcher", async () => {
    localStorage.setItem(KEY, JSON.stringify({ track: savedTrack(), guidedDayId: null }));
    render(<GpsRecorder {...props} />);
    const button = await screen.findByRole("button", { name: "Continue recording" });
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => nativeJournal.read.resolve([]));
    expect(await screen.findByTestId("gps-recording")).toBeInTheDocument();
    await waitFor(() => expect(location.watchLocation).toHaveBeenCalledTimes(1));
  });
});
