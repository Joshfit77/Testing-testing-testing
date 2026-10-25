/**
 * Unsent-form drafts kept on this device (localStorage), namespaced per signed-in user so a shared
 * device never shows one account's draft to another. Drafts are a convenience copy only: they never
 * sync, they expire after DRAFT_MAX_AGE_MS, and they are removed as soon as the form is submitted
 * successfully. See docs/DATA.md.
 *
 * Every storage access is wrapped: in private windows, with blocked site data or during server
 * rendering the functions quietly do nothing and the form simply starts empty.
 */

import { GPS_RECORDING_PREFIX } from "@/lib/opening";

export const DRAFT_PREFIX = "ngf.draft.";
/** Drafts older than this are ignored and removed (30 days). */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Upper bound for one stored draft, so a runaway form can't fill the quota. */
const MAX_DRAFT_CHARS = 100_000;

interface StoredDraft<T> {
  v: 1;
  at: number;
  value: T;
}

export function draftStorageKey(userId: string, key: string): string {
  return `${DRAFT_PREFIX}${userId || "anon"}.${key}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Reads a draft, or null when there is none, it is malformed or it has expired. */
export function readDraft<T>(userId: string, key: string, now = Date.now()): { value: T; savedAt: number } | null {
  const s = storage();
  if (!s) return null;
  const k = draftStorageKey(userId, key);
  try {
    const raw = s.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft<T>> | null;
    if (!parsed || parsed.v !== 1 || typeof parsed.at !== "number" || !("value" in parsed)) {
      s.removeItem(k);
      return null;
    }
    if (now - parsed.at > DRAFT_MAX_AGE_MS) {
      s.removeItem(k);
      return null;
    }
    return { value: parsed.value as T, savedAt: parsed.at };
  } catch {
    return null;
  }
}

/** Saves a draft. Returns false when storage is unavailable or full. */
export function writeDraft<T>(userId: string, key: string, value: T, now = Date.now()): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const raw = JSON.stringify({ v: 1, at: now, value } satisfies StoredDraft<T>);
    if (raw.length > MAX_DRAFT_CHARS) return false;
    s.setItem(draftStorageKey(userId, key), raw);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(userId: string, key: string): void {
  try {
    storage()?.removeItem(draftStorageKey(userId, key));
  } catch {
    /* ignore */
  }
}

/**
 * Removes every draft on this device (all users when `userId` is omitted), and any run or walk still being recorded
 * (its raw GPS fixes live under the same user's key): used on sign-out and after account deletion, so the next
 * person on a shared device finds nothing of the last one.
 */
export function clearAllDrafts(userId?: string): number {
  const s = storage();
  if (!s) return 0;
  const prefixes = userId ? [`${DRAFT_PREFIX}${userId}.`, `${GPS_RECORDING_PREFIX}${userId}`] : [DRAFT_PREFIX, GPS_RECORDING_PREFIX];
  const doomed: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) doomed.push(k);
    }
    for (const k of doomed) s.removeItem(k);
  } catch {
    return 0;
  }
  return doomed.length;
}

const CLEANUP_KEY = "ngf.cleanup.user";

/**
 * Remembers (for this tab only) that `userId` is signing out, so the next page can clear anything written to this
 * device after the sign-out began. See src/components/platform/device-cleanup.tsx.
 */
export function markDeviceCleanup(userId: string): void {
  try {
    sessionStorage.setItem(CLEANUP_KEY, userId);
  } catch {
    /* storage unavailable: the immediate clean-up on sign-out still ran */
  }
}

/** The user id left by markDeviceCleanup, removed as it is read; null when there is none. */
export function takeDeviceCleanup(): string | null {
  try {
    const id = sessionStorage.getItem(CLEANUP_KEY);
    if (id) sessionStorage.removeItem(CLEANUP_KEY);
    return id || null;
  } catch {
    return null;
  }
}

/** True when a value holds nothing worth keeping (empty strings, empty arrays, or equal to the blank form). */
export function isBlankDraft(value: unknown, blank?: unknown): boolean {
  if (blank !== undefined && JSON.stringify(value) === JSON.stringify(blank)) return true;
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every((v) => isBlankDraft(v));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every((v) => typeof v === "boolean" || isBlankDraft(v));
  return false;
}
