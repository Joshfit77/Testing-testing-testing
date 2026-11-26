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
    expect(JSON.parse(localStorage.getItem("run.fixjournal")!)).toEqual({ v: 2, key: KEY, first: 0, last: 0 });
    expect(JSON.parse(localStorage.getItem("run.fixjournal.0")!)).toEqual([[40, -75, 5, T0 + 5000]]);
    detach();
  });
});

describe("GPS fix journal storage (chunked)", () => {
  const chunkKeys = () => Object.keys(localStorage).filter((k) => k.startsWith("run.fixjournal.")).sort();

  it("an hour with the phone locked: each write stores only the chunk still filling up, not the whole hour", () => {
    const fixes = trace(T0, 3600);
    for (const f of fixes.slice(0, 3000)) journalFix(KEY, f, f.t);
    flushJournal();
    const writes: [string, number][] = [];
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      writes.push([k, v.length]);
      return real.call(this, k, v);
    };
    try {
      // The next minute, written every 2 seconds as it arrives.
      for (const f of fixes.slice(3000, 3060)) journalFix(KEY, f, f.t);
      flushJournal();
    } finally {
      Storage.prototype.setItem = real;
    }
    // Every write touched at most the index and one chunk of at most 300 fixes, never the 3,000 before.
    const biggest = Math.max(...writes.map(([, n]) => n));
    expect(biggest).toBeLessThan(300 * 60);
    expect(new Set(writes.map(([k]) => k))).toEqual(new Set(["run.fixjournal", "run.fixjournal.10"]));
    // Relaunch: all 3,060 fixes come back, in order.
    resetJournalForTests();
    const recovered = replayJournal(KEY, startTrack({ id: "r", kind: "run", unit: "km", now: T0 - 1000 }));
    expect(recovered.lastFixAt).toBe(fixes[3059]!.t);
  });

  it("a journal written by the previous version (one entry) is still replayed, then rewritten in chunks", () => {
    const old = trace(T0, 10).map((f) => [f.lat, f.lng, f.accuracy, f.t]);
    localStorage.setItem("run.fixjournal", JSON.stringify({ key: KEY, fixes: old }));
    const track = replayJournal(KEY, startTrack({ id: "r", kind: "run", unit: "km", now: T0 - 1000 }));
    expect(track.lastFixAt).toBe(T0 + 10_000);
    journalFix(KEY, { lat: 40.001, lng: -75, accuracy: 5, t: T0 + 11_000 }, T0 + 11_000);
    flushJournal();
    expect(JSON.parse(localStorage.getItem("run.fixjournal")!)).toMatchObject({ v: 2, key: KEY, first: 0, last: 0 });
    expect(JSON.parse(localStorage.getItem("run.fixjournal.0")!)).toHaveLength(12);
  });

  it("past the four-hour cap the oldest chunk goes, its stored copy too", () => {
    const fixes = trace(T0, 15_300);
    for (const f of fixes) journalFix(KEY, f, f.t);
    flushJournal();
    const index = JSON.parse(localStorage.getItem("run.fixjournal")!);
    expect(index.first).toBeGreaterThan(0);
    expect(localStorage.getItem(`run.fixjournal.${index.first - 1}`)).toBeNull();
    expect(chunkKeys()).toHaveLength(index.last - index.first + 1);
    resetJournalForTests();
    const recovered = replayJournal(KEY, startTrack({ id: "r", kind: "run", unit: "km", now: T0 - 1000 }));
    expect(recovered.lastFixAt).toBe(fixes.at(-1)!.t);
  });

  it("a full save prunes the journal and leaves no stale chunks; clearing removes every chunk", () => {
    const fixes = trace(T0, 1000);
    for (const f of fixes) journalFix(KEY, f, f.t);
    flushJournal();
    expect(chunkKeys()).toHaveLength(4);
    pruneJournal(KEY, fixes[995]!.t);
    expect(chunkKeys()).toEqual(["run.fixjournal.0"]);
    expect(JSON.parse(localStorage.getItem("run.fixjournal.0")!)).toHaveLength(5);
    clearJournal();
    expect(chunkKeys()).toEqual([]);
    expect(localStorage.getItem("run.fixjournal")).toBeNull();
  });

  it("another member's recording starts a fresh journal and removes the previous one's chunks", () => {
    for (const f of trace(T0, 700)) journalFix(KEY, f, f.t);
    flushJournal();
    expect(chunkKeys().length).toBe(3);
    journalFix("run.recording.user-2", { lat: 41, lng: -75, accuracy: 5, t: T0 }, T0 + 10_000);
    flushJournal();
    expect(chunkKeys()).toEqual(["run.fixjournal.0"]);
    expect(replayJournal(KEY, startTrack({ id: "x", kind: "run", unit: "km", now: T0 }))).toMatchObject({ lastFixAt: null });
  });
});
