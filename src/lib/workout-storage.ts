"use client";
import { migrateDraft, type WorkoutDraft } from "@/lib/domain/workout-draft";

/** Local persistence of the in-progress workout, keyed per user so shared devices don't mix accounts. */
const key = (userId: string) => `ngf.workout.draft.${userId}`;
/** The localStorage key of the member's in-progress workout (a `storage` event with this key means another tab saved it). */
export const localDraftKey = key;
export const DRAFT_EVENT = "ngf:workout-draft";

export function loadLocalDraft(userId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    // Drafts saved by older versions of the app are upgraded to the current format.
    return migrateDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveLocalDraft(userId: string, draft: WorkoutDraft): boolean {
  try {
    localStorage.setItem(key(userId), JSON.stringify(draft));
    window.dispatchEvent(new Event(DRAFT_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDraft(userId: string): void {
  try {
    localStorage.removeItem(key(userId));
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Workouts discarded on this device. When the discard happened offline (or the server didn't answer), the server
 * still has the in-progress snapshot, and without this record it brought the discarded workout back on the next
 * visit. The logger never restores a workout on this list; while `done` is false the app deletes the server copy
 * once it's back online (retryPendingDiscards). Records stay after the server copy is gone (the last 20), because a
 * page may already have loaded the snapshot before the delete landed.
 */
const discardKey = (userId: string) => `ngf.workout.discarded.${userId}`;
const MAX_DISCARDS = 20;

interface DiscardRecord {
  id: string;
  /** The server copy is known to be deleted. */
  done: boolean;
}

function readDiscards(userId: string): DiscardRecord[] {
  try {
    const list = JSON.parse(localStorage.getItem(discardKey(userId)) ?? "[]") as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((x): x is DiscardRecord => Boolean(x) && typeof (x as DiscardRecord).id === "string")
      .map((x) => ({ id: x.id, done: x.done === true }))
      .slice(-MAX_DISCARDS);
  } catch {
    return [];
  }
}

function writeDiscards(userId: string, list: DiscardRecord[]): void {
  try {
    localStorage.setItem(discardKey(userId), JSON.stringify(list.slice(-MAX_DISCARDS)));
  } catch {
    /* storage unavailable: nothing more we can do on this device */
  }
}

/** Every workout discarded on this device (the logger never restores these). */
export function discardedWorkoutIds(userId: string): string[] {
  return readDiscards(userId).map((d) => d.id);
}

/** Discarded workouts whose server copy may still exist. */
export function pendingDiscards(userId: string): string[] {
  return readDiscards(userId)
    .filter((d) => !d.done)
    .map((d) => d.id);
}

/** Record a discard; `serverDeleted` when the server copy is already gone. */
export function rememberDiscard(userId: string, clientId: string, serverDeleted = false): void {
  writeDiscards(userId, [...readDiscards(userId).filter((d) => d.id !== clientId), { id: clientId, done: serverDeleted }]);
}

/** Deletes the server copies of workouts discarded offline. Returns how many were removed. */
export async function retryPendingDiscards(userId: string, discard: (clientId: string) => Promise<{ ok: boolean }>): Promise<number> {
  let removed = 0;
  for (const id of pendingDiscards(userId)) {
    const res = await discard(id).catch(() => ({ ok: false }));
    if (res.ok) {
      writeDiscards(userId, readDiscards(userId).map((d) => (d.id === id ? { ...d, done: true } : d)));
      removed++;
    }
  }
  return removed;
}
