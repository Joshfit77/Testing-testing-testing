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
 *
 * Storage is chunked: a small index under JOURNAL_KEY (`{ v: 2, key, first, last }`) and the fixes in chunks of
 * CHUNK_FIXES under `run.fixjournal.<n>`. A write only rewrites the chunk still filling up (and any just completed), so
 * an hour with the phone locked writes a few kilobytes every two seconds, not the whole hour's route each time.
 */

const JOURNAL_KEY = "run.fixjournal";
const CHUNK_PREFIX = `${JOURNAL_KEY}.`;
const WRITE_EVERY_MS = 2000;
/** About five minutes at one fix a second (about 12 KB). */
const CHUNK_FIXES = 300;
/** About four hours at one fix a second: older fixes than this are always in a full save already. */
const MAX_FIXES = 15_000;

type Row = [lat: number, lng: number, accuracy: number, t: number];
interface Journal {
  /** The recorder's storage key (`run.recording.<userId>`): a journal is only ever replayed into the same recording. */
  key: string;
  fixes: Row[];
  /** Chunk number of fixes[0] (fixes[0] is always the first fix of a chunk). */
  first: number;
}
interface Index {
  v: 2;
  key: string;
  first: number;
  last: number;
}

let mem: Journal | null = null;
let lastWrite = 0;
let dirty = false;
let listening = false;
/** Chunks (by number) already on the device exactly as in `mem`; every chunk before the last full one is final. */
let writtenFull = -1;
/** The highest chunk number on the device, to remove leftovers when the journal shrinks. */
let storedLast = -1;

function getItem(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function read(): Journal | null {
  const raw = getItem(JOURNAL_KEY);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<Index> & { fixes?: unknown };
    if (!j || typeof j.key !== "string") return null;
    // The earlier single-entry format (a journal written before an update is still replayed).
    if (Array.isArray(j.fixes)) return { key: j.key, fixes: j.fixes as Row[], first: 0 };
    if (j.v !== 2 || !Number.isInteger(j.first) || !Number.isInteger(j.last)) return null;
    const fixes: Row[] = [];
    for (let n = j.first!; n <= j.last!; n++) {
      const chunk = JSON.parse(getItem(CHUNK_PREFIX + n) ?? "[]") as unknown;
      if (Array.isArray(chunk)) fixes.push(...(chunk as Row[]));
    }
    return { key: j.key, fixes, first: j.first! };
  } catch {
    return null;
  }
}

/** Load the journal on the device into memory, remembering what is already written. */
function load(stored: Journal | null): void {
  mem = stored;
  // A journal read from the device is written in full again on the next write (it may be in the old format).
  writtenFull = -1;
  storedLast = stored ? stored.first + Math.ceil(stored.fixes.length / CHUNK_FIXES) - 1 : -1;
}

function write(): void {
  if (!mem) return;
  try {
    const full = Math.floor(mem.fixes.length / CHUNK_FIXES);
    const last = mem.first + Math.ceil(mem.fixes.length / CHUNK_FIXES) - 1;
    for (let i = 0; i * CHUNK_FIXES < mem.fixes.length; i++) {
      const n = mem.first + i;
      if (i < full && n <= writtenFull) continue; // a completed chunk already on the device
      localStorage.setItem(CHUNK_PREFIX + n, JSON.stringify(mem.fixes.slice(i * CHUNK_FIXES, (i + 1) * CHUNK_FIXES)));
    }
    for (let n = Math.max(last + 1, 0); n <= storedLast; n++) localStorage.removeItem(CHUNK_PREFIX + n);
    const index: Index = { v: 2, key: mem.key, first: mem.first, last };
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(index));
    writtenFull = mem.first + full - 1;
    storedLast = last;
    dirty = false;
    lastWrite = Date.now();
  } catch {
    /* storage full or blocked: the in-memory track still has the fixes */
  }
}

function removeAllChunks(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CHUNK_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* nothing stored */
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
    if (stored && stored.key === key) load(stored);
    else {
      if (stored || mem) removeAllChunks();
      load({ key, fixes: [], first: 0 });
    }
  }
  const j = mem!;
  j.fixes.push([fix.lat, fix.lng, fix.accuracy, fix.t]);
  // Past the cap, the oldest whole chunk goes (its fixes are long in a full save), keeping chunk numbers in place.
  if (j.fixes.length > MAX_FIXES) {
    const drop = Math.ceil((j.fixes.length - MAX_FIXES) / CHUNK_FIXES);
    j.fixes.splice(0, drop * CHUNK_FIXES);
    for (let n = j.first; n < j.first + drop; n++) {
      try {
        localStorage.removeItem(CHUNK_PREFIX + n);
      } catch {
        /* blocked */
      }
    }
    j.first += drop;
  }
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
    load(stored);
  }
  const j = mem!;
  const before = j.fixes.length;
  j.fixes = j.fixes.filter((f) => f[3] > upTo);
  if (j.fixes.length !== before) {
    // What is left is usually a few seconds of fixes: renumber from the first chunk and write it all again.
    j.first = 0;
    writtenFull = -1;
    dirty = true;
    write();
  }
}

/** Forget the journal (a new recording starts, or the recording was saved or discarded). */
export function clearJournal(): void {
  mem = null;
  dirty = false;
  writtenFull = -1;
  storedLast = -1;
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    /* nothing stored */
  }
  removeAllChunks();
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

/** Native journal deletions asked for but not yet confirmed by the phone ("*" = all), retried at the next app start. */
const PENDING_NATIVE_CLEAR_KEY = "ngf.runjournal.pendingClear";

function pendingNativeClears(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_NATIVE_CLEAR_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function setPendingNativeClears(keys: string[]): void {
  try {
    if (keys.length) localStorage.setItem(PENDING_NATIVE_CLEAR_KEY, JSON.stringify([...new Set(keys)]));
    else localStorage.removeItem(PENDING_NATIVE_CLEAR_KEY);
  } catch {
    /* storage blocked: the deletion is still attempted now */
  }
}

/**
 * Ask the phone to delete one recording's native journal (`"*"` = all), remembering the request until the phone
 * confirms it, so a deletion cut short (the app closed, the page left) is finished at the next app start. Used when a
 * recording is saved, discarded or replaced, and at sign-out and account deletion.
 */
export async function clearNativeConfirmed(target: string): Promise<boolean> {
  setPendingNativeClears([...pendingNativeClears(), target]);
  let ok = false;
  try {
    const { clearNativeRunJournal } = await import("@/lib/native/run-journal");
    ok = await clearNativeRunJournal(target === "*" ? undefined : target);
  } catch {
    ok = false;
  }
  // Confirmed: that request is done (deleting everything also covers every single-key request).
  if (ok) setPendingNativeClears(target === "*" ? [] : pendingNativeClears().filter((k) => k !== target));
  return ok;
}

/**
 * Remove recorded routes from this device (sign-out, account deletion): the web journal and the native journal of
 * `userId`'s recording, or all of them without a user. Resolves true once the phone has confirmed the native deletion.
 * The request is remembered first, so if the app is closed, or the page leaves, before the phone answers, the next app
 * start finishes it (retryPendingNativeClears).
 */
export async function clearRunJournalData(userId?: string): Promise<boolean> {
  const stored = mem ?? read();
  if (!userId || !stored || stored.key === `${RECORDING_PREFIX}${userId}`) clearJournal();
  // Signing out removes only that member's native journal (another member's unrecovered run on a shared phone isn't
  // theirs to delete); without a user (account deletion, forgetting the device) every native journal goes.
  return clearNativeConfirmed(userId ? `${RECORDING_PREFIX}${userId}` : "*");
}

/** At app start: finish native journal deletions that weren't confirmed before the app closed. True when none remain. */
export async function retryPendingNativeClears(): Promise<boolean> {
  const pending = pendingNativeClears();
  if (!pending.length) return true;
  const { clearNativeRunJournal } = await import("@/lib/native/run-journal");
  const left: string[] = [];
  // Deleting everything covers every single-key request too.
  const targets = pending.includes("*") ? ["*"] : pending;
  for (const t of targets) if (!(await clearNativeRunJournal(t === "*" ? undefined : t).catch(() => false))) left.push(t);
  setPendingNativeClears(left);
  return left.length === 0;
}

/** For tests: reset module state. */
export function resetJournalForTests(): void {
  mem = null;
  lastWrite = 0;
  dirty = false;
  writtenFull = -1;
  storedLast = -1;
}
