/**
 * O-01: fixes that reach the open recorder while the phone is locked are journalled on the device as they arrive,
 * outside React, so a recording the system ends in the background is recovered with them. Synthetic trace only;
 * real-device behaviour is in docs/production-consolidation/IPHONE_DEVICE_TESTING.md (tests 14-15).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addFix, startTrack, trackTotals, type GpsFix, type TrackState } from "@/lib/domain/gps-track";
import { clearJournal, flushJournal, journalFix, pruneJournal, replayJournal, resetJournalForTests } from "@/lib/run/fix-journal";
import { attachScreen, routeFix } from "@/lib/run/live-recording";

const KEY = "run.recording.user-1";
const T0 = Date.UTC(2026, 10, 26, 7, 0, 0);
const M_PER_DEG_LAT = 111_195;
const trace = (from: number, seconds: number, startM = 0): GpsFix[] =>
  Array.from({ length: seconds + 1 }, (_, i) => ({ lat: 40 + (startM + i * 3) / M_PER_DEG_LAT, lng: -75, accuracy: 5, t: from + i * 1000 }));

beforeEach(() => {
  localStorage.clear();
  resetJournalForTests();
});

describe("GPS fix journal", () => {
  it("a recording ended in the background is recovered with the fixes that arrived after the last save", () => {
    // 60 s recorded and saved normally (React ran), then the phone was locked for 5 minutes: fixes kept arriving
    // through the router, but React never rendered, so the track was never saved again, and then the app was ended.
    let track: TrackState = startTrack({ id: "r1", kind: "run", unit: "km", now: T0 });
    const saved = trace(T0 + 1000, 60);
    for (const f of saved) {
      track = addFix(track, f).state;
      journalFix(KEY, f, f.t);
    }
    localStorage.setItem(KEY, JSON.stringify({ track, guidedDayId: null }));
    pruneJournal(KEY, track.lastFixAt);
    const locked = trace(T0 + 62_000, 300, 180);
    for (const f of locked) journalFix(KEY, f, f.t);
    flushJournal(); // the page was hidden when the phone locked

    // Relaunch: only what is on the device survives.
    resetJournalForTests();
    const fromDisk = JSON.parse(localStorage.getItem(KEY)!).track as TrackState;
    expect(trackTotals(fromDisk).distance_m).toBeCloseTo(180, 0);
    const recovered = replayJournal(KEY, fromDisk);
    // 180 m saved + 3 m between the two traces + 300 s at 3 m/s = 1,083 m (to within GPS smoothing).
    expect(trackTotals(recovered).distance_m).toBeGreaterThan(1000);
    expect(recovered.lastFixAt).toBe(locked.at(-1)!.t);
  });

  it("replays nothing twice, nothing into another recording, and nothing after clearing", () => {
    let track: TrackState = startTrack({ id: "r2", kind: "run", unit: "km", now: T0 });
    for (const f of trace(T0 + 1000, 30)) {
      track = addFix(track, f).state;
      journalFix(KEY, f, f.t);
    }
    flushJournal();
    // Everything journalled is already in the track: replay changes nothing (no fix counted twice).
    expect(replayJournal(KEY, track)).toBe(track);
    // A journal for one member's recording is never replayed into another's.
    expect(replayJournal("run.recording.user-2", startTrack({ id: "x", kind: "run", unit: "km", now: T0 }))).toMatchObject({ lastFixAt: null });
    clearJournal();
    expect(localStorage.getItem("run.fixjournal")).toBeNull();
  });

  it("the router journals fixes for the open screen, keyed by its recording", () => {
    const got: GpsFix[] = [];
    const detach = attachScreen({ fix: (f) => got.push(f), error: () => undefined }, KEY);
    const f = { lat: 40, lng: -75, accuracy: 5, t: T0 + 5000 };
    routeFix(f);
    flushJournal();
    expect(got).toEqual([f]);
    expect(JSON.parse(localStorage.getItem("run.fixjournal")!)).toEqual({ key: KEY, fixes: [[40, -75, 5, T0 + 5000]] });
    detach();
  });
});
