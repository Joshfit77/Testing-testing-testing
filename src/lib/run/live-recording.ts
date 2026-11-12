"use client";

import { addFix, suspendAwareTicker, trackTotals, type GpsFix, type TrackState } from "@/lib/domain/gps-track";

/**
 * Keeps a run or walk recording while the member uses the rest of the app.
 *
 * The recorder screen (src/components/run/gps-recorder.tsx) owns the recording while it is open. When the member
 * leaves it mid-recording (another tab, the workout, a Bible chapter), the location watcher is handed over here
 * instead of being stopped: its fixes keep landing in the same track, saved to the device every few seconds exactly
 * as the screen saves it, and a "Recording" pill (src/components/shell/active-run-pill.tsx) leads back. Opening the
 * recorder again takes the recording (and the watcher) back, with nothing lost and nothing to "continue".
 *
 * Only in-app navigation keeps the page's JavaScript alive: a reload, closing the app or a crash still ends the
 * watcher, and the recorder's existing "unfinished recording" offer picks the saved track up. Sign-out and account
 * deletion stop a kept recording (clearAllDrafts in src/lib/drafts.ts).
 */

export const LIVE_RUN_EVENT = "ngf:live-run";
/** How often the kept track is written to the device (the screen writes every 5 s while recording, too). */
const SAVE_EVERY_MS = 5000;

interface Kept {
  /** The recorder's storage key (`run.recording.<userId>`). */
  key: string;
  guidedDayId: string | null;
  /** Where the recorder was opened (path and query), for the way back. */
  href: string;
  track: TrackState;
  stop: () => void;
  wake: (() => void) | null;
  timer: ReturnType<typeof setInterval> | null;
  lastSave: number;
}

let kept: Kept | null = null;
/** The open recorder screen's handlers, while it is mounted. */
let screen: { fix: (f: GpsFix) => void; error: (e: unknown) => void } | null = null;

function announce() {
  try {
    window.dispatchEvent(new Event(LIVE_RUN_EVENT));
  } catch {
    /* no window (tests) */
  }
}

function save(k: Kept, force = false) {
  if (!force && Date.now() - k.lastSave < SAVE_EVERY_MS) return;
  k.lastSave = Date.now();
  try {
    localStorage.setItem(k.key, JSON.stringify({ track: k.track, guidedDayId: k.guidedDayId }));
  } catch {
    /* storage full or blocked: the recording continues in memory */
  }
  announce();
}

/**
 * Where every watcher's fixes go: the kept recording while the member is elsewhere in the app, otherwise the open
 * recorder screen. (A single route, so a watcher never has to be restarted to change hands.)
 */
export function routeFix(fix: GpsFix): void {
  if (kept) {
    kept.track = addFix(kept.track, fix).state;
    save(kept);
    return;
  }
  screen?.fix(fix);
}

export function routeError(e: unknown): void {
  // While kept, a brief loss is recorded as a gap by the clock below; the screen shows the message when open again.
  if (!kept) screen?.error(e);
}

/** The recorder screen registers itself while mounted. Returns the unregister function. */
export function attachScreen(handlers: { fix: (f: GpsFix) => void; error: (e: unknown) => void }): () => void {
  screen = handlers;
  return () => {
    if (screen === handlers) screen = null;
  };
}

/** Whether a recording in this state should keep going when the screen closes. */
export function shouldKeep(track: TrackState | null): boolean {
  return Boolean(track && (track.status === "recording" || track.status === "acquiring"));
}

/** The recorder screen is closing mid-recording: keep the watcher and the track going here. */
export function keepRecording(input: { key: string; guidedDayId: string | null; href: string; track: TrackState; stop: () => void; wake: (() => void) | null }): void {
  stopKept();
  const k: Kept = { ...input, timer: null, lastSave: 0 };
  // The same 1 s clock the screen runs: notices a lost signal (recorded as a gap, never as distance), without mistaking
  // fixes queued while the phone was locked for a gap.
  const step = suspendAwareTicker();
  k.timer = setInterval(() => {
    if (kept !== k) return;
    k.track = step(k.track, Date.now());
    save(k);
  }, 1000);
  kept = k;
  save(k, true);
}

/**
 * The recorder screen opened again for the same member and session: hand the recording and its watcher back.
 * Null when nothing is kept for it.
 */
export function takeBack(key: string, guidedDayId: string | null): { track: TrackState; stop: () => void; wake: (() => void) | null } | null {
  const k = kept;
  if (!k || k.key !== key || k.guidedDayId !== guidedDayId) return null;
  if (k.timer) clearInterval(k.timer);
  save(k, true);
  kept = null;
  announce();
  return { track: k.track, stop: k.stop, wake: k.wake };
}

/** Stop a kept recording's watcher (sign-out, account deletion). The saved track stays unless the caller clears it. */
export function stopKept(): void {
  const k = kept;
  if (!k) return;
  kept = null;
  if (k.timer) clearInterval(k.timer);
  try {
    k.stop();
    k.wake?.();
  } catch {
    /* already stopped */
  }
  announce();
}

/** What the "Recording" pill shows: the kind, distance so far (metres) and the way back. Null when nothing is kept. */
export function keptSummary(): { kind: TrackState["kind"]; unit: TrackState["unit"]; distanceM: number; href: string; signalLost: boolean } | null {
  if (!kept) return null;
  return { kind: kept.track.kind, unit: kept.track.unit, distanceM: trackTotals(kept.track).distance_m, href: kept.href, signalLost: Boolean(kept.track.signalLost) };
}
