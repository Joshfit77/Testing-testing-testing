"use client";

import { addFix, type GpsFix, type TrackState } from "@/lib/domain/gps-track";
import { GPS_RECORDING_PREFIX as RECORDING_PREFIX } from "@/lib/opening";

/**
 * A write-ahead journal of GPS fixes for the recording on the open recorder screen (O-01).
 *
 * The recorder saves its whole track to the device from a React effect every few seconds. With the phone locked, the
 * native watcher keeps delivering fixes, but the web view may not render, so those saves wait for the app to come
 * back. If the system ends the app meanwhile, everything since the last save was lost. Each fix is therefore also
 * appended here, synchronously, by the code that receives it (src/lib/run/live-recording.ts), with no React or timer
 * involved; every full save of the track prunes what it already contains, and recovering an unfinished recording
 * replays whatever is newer than the saved track.
 *
 * Writes are throttled (at most every WRITE_EVERY_MS, plus whenever the page is hidden), so a lost write costs at most
 * a couple of seconds of route, never the stretch since the app was locked.
 */

const JOURNAL_KEY = "run.fixjournal";
const WRITE_EVERY_MS = 2000;
/** About four hours at one fix a second: older fixes than this are always in a full save already. */
const MAX_FIXES = 15_000;

type Row = [lat: number, lng: number, accuracy: number, t: number];
interface Journal {
  /** The recorder's storage key (`run.recording.<userId>`): a journal is only ever replayed into the same recording. */
  key: string;
  fixes: Row[];
}

let mem: Journal | null = null;
let lastWrite = 0;
let dirty = false;
let listening = false;

function read(): Journal | null {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Journal;
    return j && typeof j.key === "string" && Array.isArray(j.fixes) ? j : null;
  } catch {
    return null;
  }
}

function write(): void {
  if (!mem) return;
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(mem));
    dirty = false;
    lastWrite = Date.now();
  } catch {
    /* storage full or blocked: the in-memory track still has the fixes */
  }
}

function listen(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;
  const flushNow = () => {
    if (dirty) write();
  };
  document.addEventListener("visibilitychange", flushNow);
  window.addEventListener("pagehide", flushNow);
}

/** Record a fix for the recording stored under `key`. Cheap; called for every fix the open screen receives. */
export function journalFix(key: string, fix: GpsFix, now: number = Date.now()): void {
  listen();
  if (!mem || mem.key !== key) {
    const stored = read();
    mem = stored && stored.key === key ? stored : { key, fixes: [] };
  }
  mem.fixes.push([fix.lat, fix.lng, fix.accuracy, fix.t]);
  if (mem.fixes.length > MAX_FIXES) mem.fixes.splice(0, mem.fixes.length - MAX_FIXES);
  dirty = true;
  if (now - lastWrite >= WRITE_EVERY_MS) write();
}

/** Write any fixes not yet on the device. */
export function flushJournal(): void {
  if (dirty) write();
}

/** The track saved under `key` now holds every fix up to `upTo` (its lastFixAt): drop those from the journal. */
export function pruneJournal(key: string, upTo: number | null): void {
  if (upTo == null) return;
  if (!mem || mem.key !== key) {
    const stored = read();
    if (!stored || stored.key !== key) return;
    mem = stored;
  }
  const before = mem.fixes.length;
  mem.fixes = mem.fixes.filter((f) => f[3] > upTo);
  if (mem.fixes.length !== before) {
    dirty = true;
    write();
  }
}

/** Forget the journal (a new recording starts, or the recording was saved or discarded). */
export function clearJournal(): void {
  mem = null;
  dirty = false;
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    /* nothing stored */
  }
}

/**
 * The saved track with every journalled fix it doesn't have yet (newer than its last accepted fix), applied in order
 * through the same rules as live fixes. Returns the track unchanged when there is nothing to add.
 */
export function replayJournal(key: string, track: TrackState): TrackState {
  const j = mem && mem.key === key ? mem : read();
  if (!j || j.key !== key || !j.fixes.length) return track;
  return replayFixes(track, j.fixes.map(([lat, lng, accuracy, t]) => ({ lat, lng, accuracy, t })));
}

/**
 * Apply fixes from any journal (this device's web journal, or the native one written while the web view was
 * suspended) that are newer than the track's last accepted fix, oldest first, through the live rules. Fixes already
 * in the track are never counted twice; a finished track is left alone.
 */
export function replayFixes(track: TrackState, fixes: GpsFix[]): TrackState {
  if (!fixes.length || track.status === "finished") return track;
  const after = track.lastFixAt ?? -Infinity;
  let t = track;
  for (const f of [...fixes].sort((a, b) => a.t - b.t)) {
    if (!(f.t > after) || !Number.isFinite(f.lat) || !Number.isFinite(f.lng)) continue;
    t = addFix(t, f).state;
  }
  return t;
}

/**
 * Remove recorded routes from this device (sign-out, account deletion): the web journal and the native journal of
 * `userId`'s recording, or all of them without a user.
 */
export function clearRunJournalData(userId?: string): void {
  const stored = mem ?? read();
  if (!userId || !stored || stored.key === `${RECORDING_PREFIX}${userId}`) clearJournal();
  // Signing out removes only that member's native journal (another member's unrecovered run on a shared phone isn't
  // theirs to delete); without a user (account deletion, forgetting the device) every native journal goes.
  const key = userId ? `${RECORDING_PREFIX}${userId}` : undefined;
  void import("@/lib/native/run-journal").then((m) => m.clearNativeRunJournal(key)).catch(() => undefined);
}

/** For tests: reset module state. */
export function resetJournalForTests(): void {
  mem = null;
  lastWrite = 0;
  dirty = false;
}
