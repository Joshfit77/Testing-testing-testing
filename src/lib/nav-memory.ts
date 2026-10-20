"use client";

/**
 * Navigation memory for this browser tab (sessionStorage — cleared when the tab or app is closed):
 *
 * - Last location per main section, so tapping a bottom tab returns to the screen and filters you
 *   left there (`lastHrefFor`, `useTabHref`). Tapping the tab you're already in goes to its root.
 * - A small in-app history stack, so Back buttons go back only when the previous screen is inside
 *   the app and otherwise fall back to the section root (`canGoBackInApp`, `goBackOr`).
 * - Scroll positions per pathname + search (`saveScroll`, `readScroll`), used by ScrollMemory.
 * - `useSessionState`, a useState that survives tab switches (dialog tabs, search text).
 *
 * Nothing here syncs or is sent anywhere. All storage access is guarded (private mode, blocked storage).
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MAIN_TABS } from "@/components/shell/nav-config";

const LAST_PREFIX = "ngf.nav.last.";
const STACK_KEY = "ngf.nav.stack";
const SCROLL_PREFIX = "ngf.scroll.";
const STATE_PREFIX = "ngf.ui.";
const MAX_STACK = 50;
const MAX_SCROLL_ENTRIES = 60;

function session(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function get(key: string): string | null {
  try {
    return session()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    session()?.setItem(key, value);
  } catch {
    /* full or blocked */
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function within(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The main tab (by its href, e.g. "/train") that owns a pathname, or null. */
export function sectionFor(pathname: string): string | null {
  const tab = MAIN_TABS.find((t) => within(pathname, t.href) || (t.alsoMatches ?? []).some((p) => within(pathname, p)));
  return tab?.href ?? null;
}

/**
 * Screens never restored by a tab tap: live sessions have their own Resume bar, and edit/new forms
 * shouldn't reopen on their own.
 */
const TRANSIENT = [/^\/train\/workout(\/|$)/, /\/edit(\/|$)/, /\/new(\/|$)/, /\/record(\/|$)/];

export function isRememberable(pathname: string): boolean {
  return !TRANSIENT.some((r) => r.test(pathname));
}

/** Records the current location as the last one visited in its section. */
export function rememberLocation(pathname: string, search: string): void {
  const section = sectionFor(pathname);
  if (!section || !isRememberable(pathname)) return;
  const q = search && !search.startsWith("?") ? `?${search}` : search;
  set(LAST_PREFIX + section, pathname + q);
}

/**
 * Where a bottom-tab tap for `section` should go: the last screen (with its filters) visited in that
 * section during this session, or the section root. When you're already inside the section the tap
 * goes to the root, like native tab bars.
 */
export function lastHrefFor(section: string, currentPathname?: string): string {
  if (currentPathname && sectionFor(currentPathname) === section) return section;
  const saved = get(LAST_PREFIX + section);
  if (!saved || !saved.startsWith("/") || saved.startsWith("//")) return section;
  const path = saved.split("?")[0]!;
  return sectionFor(path) === section && isRememberable(path) ? saved : section;
}

/**
 * Hook for tab links: the href to use for a main tab. Renders the plain root on the server and first
 * paint (no hydration mismatch), then switches to the remembered location.
 */
export function useTabHref(section: string): string {
  const pathname = usePathname();
  const [href, setHref] = useState(section);
  useEffect(() => {
    setHref(lastHrefFor(section, pathname));
  }, [section, pathname]);
  return href;
}

/** Same as useTabHref for several tabs at once (keyed by section href). */
export function useTabHrefs(sections: string[]): Record<string, string> {
  const pathname = usePathname();
  const key = sections.join("|");
  const [hrefs, setHrefs] = useState<Record<string, string>>(() => Object.fromEntries(sections.map((s) => [s, s])));
  useEffect(() => {
    setHrefs(Object.fromEntries(key.split("|").map((s) => [s, lastHrefFor(s, pathname)])));
  }, [key, pathname]);
  return hrefs;
}

// ---------------------------------------------------------------------------
// In-app history (for Back buttons)
// ---------------------------------------------------------------------------

function readStack(): string[] {
  try {
    const raw = get(STACK_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  set(STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
}

/**
 * Updates the in-app history stack after a navigation. `kind` is "load" for a full page load,
 * "pop" for browser back/forward and "push" for in-app links.
 */
export function recordNavigation(href: string, kind: "load" | "push" | "pop"): void {
  const stack = readStack();
  const top = stack[stack.length - 1];
  if (kind === "load") {
    // Reload of the same screen keeps the stack; anything else is a fresh entry into the app.
    writeStack(top === href ? stack : [href]);
    return;
  }
  if (top === href) return;
  if (kind === "pop" && stack[stack.length - 2] === href) {
    stack.pop();
    writeStack(stack);
    return;
  }
  writeStack([...stack, href]);
}

/** True when the previous screen in this tab's history is a screen inside the app. */
export function canGoBackInApp(): boolean {
  return readStack().length > 1;
}

/** The previous screen in this tab's in-app history (pathname + search), or null. */
export function previousInAppHref(): string | null {
  const stack = readStack();
  return stack.length > 1 ? stack[stack.length - 2]! : null;
}

/**
 * For "← Parent" links on detail screens: true when the previous in-app screen is that same parent
 * (any query), so going back restores its filters and scroll instead of opening a fresh copy.
 */
export function shouldGoBackTo(href: string): boolean {
  const prev = previousInAppHref();
  if (!prev) return false;
  return prev.split("?")[0] === href.split("?")[0];
}

/** Goes back when the previous screen is in the app, otherwise to `fallback` (normally the section root). */
export function goBackOr(router: { back: () => void; push: (href: string) => void }, fallback: string): void {
  if (canGoBackInApp()) router.back();
  else router.push(fallback);
}

// ---------------------------------------------------------------------------
// Scroll positions
// ---------------------------------------------------------------------------

export function scrollKey(pathname: string, search: string): string {
  const q = search && !search.startsWith("?") ? `?${search}` : search;
  return pathname + q;
}

export function saveScroll(key: string, y: number): void {
  const s = session();
  if (!s) return;
  const k = SCROLL_PREFIX + key;
  if (y <= 0) {
    try {
      s.removeItem(k);
    } catch {
      /* ignore */
    }
    return;
  }
  set(k, String(Math.round(y)));
  pruneScroll(s);
}

export function readScroll(key: string): number | null {
  const raw = get(SCROLL_PREFIX + key);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pruneScroll(s: Storage) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(SCROLL_PREFIX)) keys.push(k);
    }
    // Insertion order isn't tracked; dropping arbitrary extras is fine for a convenience cache.
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SCROLL_ENTRIES))) s.removeItem(k);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Session-remembered UI state
// ---------------------------------------------------------------------------

/**
 * useState that is kept in sessionStorage for this browser tab, so UI choices (a dialog's tab, its
 * search text, a selected category) survive switching sections. Starts from `initial` on the server and
 * first paint, then loads the saved value.
 */
export function useSessionState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const storageKey = STATE_PREFIX + key;
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const raw = get(storageKey);
    if (raw == null) return;
    try {
      setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed */
    }
  }, [storageKey]);
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        set(storageKey, JSON.stringify(v));
        return v;
      });
    },
    [storageKey],
  );
  return [value, update];
}
