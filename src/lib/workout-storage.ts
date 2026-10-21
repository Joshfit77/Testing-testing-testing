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
