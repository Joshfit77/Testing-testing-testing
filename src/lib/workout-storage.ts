"use client";
import { migrateDraft, type WorkoutDraft } from "@/lib/domain/workout-draft";

/** Local persistence of the in-progress workout, keyed per user so shared devices don't mix accounts. */
const key = (userId: string) => `ngf.workout.draft.${userId}`;
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

/** A discard the server has not confirmed yet (it was offline): finished on the next visit, and the draft it names is
 *  never restored from the server in the meantime. */
const discardKey = (userId: string) => `ngf.workout.discard.${userId}`;

export function loadPendingDiscard(userId: string): string | null {
  try {
    return localStorage.getItem(discardKey(userId));
  } catch {
    return null;
  }
}

export function savePendingDiscard(userId: string, clientId: string): void {
  try {
    localStorage.setItem(discardKey(userId), clientId);
  } catch {
    /* ignore */
  }
}

export function clearPendingDiscard(userId: string): void {
  try {
    localStorage.removeItem(discardKey(userId));
  } catch {
    /* ignore */
  }
}
