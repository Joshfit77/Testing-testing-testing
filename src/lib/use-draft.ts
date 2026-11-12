"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import { clearDraft, isBlankDraft, readDraft, writeDraft } from "@/lib/drafts";

const DraftUserContext = createContext<string>("");

/** Supplies the signed-in user id that namespaces drafts. Mounted once in the (app) layout. */
export function DraftUserProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return createElement(DraftUserContext.Provider, { value: userId }, children);
}

export function useDraftUserId(): string {
  return useContext(DraftUserContext);
}

export interface DraftHandle<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  /** True after a saved draft was loaded into the form (until it is dismissed, discarded or cleared). */
  restored: boolean;
  /** Hide the "Draft restored" notice but keep the text. */
  dismissRestored: () => void;
  /** Forget the stored draft and reset the form to `blank`. Call after a successful submit. */
  clear: () => void;
}

/**
 * Keeps a form's unsent values in localStorage (per user, debounced) so they survive tab switches,
 * reloads and failed sends. `blank` is the empty form: matching values are never stored.
 * Pass `key = null` to disable (e.g. when editing an existing record that has its own source of truth).
 */
export function useDraft<T>(key: string | null, blank: T, opts: { debounceMs?: number } = {}): DraftHandle<T> {
  const userId = useDraftUserId();
  const debounceMs = opts.debounceMs ?? 400;
  const [value, setValueState] = useState<T>(blank);
  const [restored, setRestored] = useState(false);
  const blankRef = useRef(blank);
  blankRef.current = blank;
  const latest = useRef<{ value: T; dirty: boolean }>({ value: blank, dirty: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!key || !latest.current.dirty) return;
    latest.current.dirty = false;
    if (isBlankDraft(latest.current.value, blankRef.current)) clearDraft(userId, key);
    else writeDraft(userId, key, latest.current.value);
  }, [key, userId]);

  // Load once the component is on the client (keeps server and first client render identical).
  useEffect(() => {
    if (!key) return;
    const found = readDraft<T>(userId, key);
    if (found && !isBlankDraft(found.value, blankRef.current)) {
      const merged =
        blankRef.current && typeof blankRef.current === "object" && !Array.isArray(blankRef.current)
          ? ({ ...blankRef.current, ...(found.value as object) } as T)
          : found.value;
      latest.current = { value: merged, dirty: false };
      setValueState(merged);
      setRestored(true);
    }
  }, [key, userId]);

  // Write pending changes when the page is hidden or the form unmounts (tab switch, navigation).
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        latest.current = { value: v, dirty: true };
        return v;
      });
      if (!key) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [key, debounceMs, flush],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current = { value: blankRef.current, dirty: false };
    if (key) clearDraft(userId, key);
    setValueState(blankRef.current);
    setRestored(false);
  }, [key, userId]);

  const dismissRestored = useCallback(() => setRestored(false), []);

  return { value, setValue, restored, dismissRestored, clear };
}
