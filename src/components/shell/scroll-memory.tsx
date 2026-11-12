"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readScroll, recordNavigation, rememberLocation, saveScroll, scrollKey } from "@/lib/nav-memory";

/** Links carrying this attribute (the main tabs) restore the destination's scroll position like Back does. */
export const RESTORE_SCROLL_ATTR = "data-restore-scroll";

/** How long to keep trying while the destination is still rendering (streamed data, images). */
const RESTORE_WINDOW_MS = 1500;

/**
 * Back/Forward detection. The router handles popstate and may render the new screen before a listener
 * added later in a component effect runs, so this listener is registered when the module loads, in
 * the capture phase (which runs before the router's own listener).
 */
let popPending = false;
if (typeof window !== "undefined") {
  window.addEventListener(
    "popstate",
    () => {
      popPending = true;
    },
    { capture: true },
  );
}

function currentKey(): string {
  return scrollKey(window.location.pathname, window.location.search);
}

/**
 * Remembers each screen's scroll position (per pathname + search, sessionStorage) and restores it when
 * you come back with Back/Forward or a bottom tab. Mounted once in the (app) layout. It also records
 * the in-app history (for Back buttons) and the last location per section (for tab links).
 *
 * - Restoring waits for the page to be tall enough, for up to RESTORE_WINDOW_MS, and gives up as soon
 *   as you scroll, touch or press a key, so it never fights you.
 * - URLs with a #fragment are left to the browser (in-page anchors win).
 * - Restoration is always an instant jump, never an animated scroll (fine with reduced motion).
 */
export function ScrollMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const keyRef = useRef<string | null>(null);
  /** When a main-tab link was last clicked (a navigation shortly after it restores scroll). */
  const tabRef = useRef(0);
  const firstRef = useRef(true);

  // Take scroll restoration over from the browser for in-app navigations.
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      /* ignore */
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      // Save where we are before the router starts scrolling the next screen.
      if (keyRef.current === currentKey()) saveScroll(keyRef.current, window.scrollY);
      tabRef.current = a.hasAttribute(RESTORE_SCROLL_ATTR) ? Date.now() : 0;
    };
    const onScroll = () => {
      // Ignore scrolls caused by the router after the URL already changed.
      if (keyRef.current && keyRef.current === currentKey()) saveScroll(keyRef.current, window.scrollY);
    };
    let ticking = false;
    const throttled = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    };
    const onHide = () => onScroll();
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", throttled, { passive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", throttled);
      window.removeEventListener("pagehide", onHide);
      try {
        window.history.scrollRestoration = prev;
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    const key = scrollKey(pathname, search);
    const kind = firstRef.current ? "load" : popPending ? "pop" : "push";
    const restore = kind !== "push" || Date.now() - tabRef.current < 3000;
    firstRef.current = false;
    popPending = false;
    tabRef.current = 0;
    keyRef.current = key;
    recordNavigation(key, kind);
    rememberLocation(pathname, search);

    if (!restore || window.location.hash) return;
    const target = readScroll(key);
    if (target == null) return;

    let cancelled = false;
    const stop = () => {
      cancelled = true;
    };
    const opts = { passive: true, once: true } as const;
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchstart", stop, opts);
    window.addEventListener("keydown", stop, opts);
    const started = performance.now();
    let frame = 0;
    const attempt = () => {
      if (cancelled) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target - 2) {
        window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
        return;
      }
      if (performance.now() - started > RESTORE_WINDOW_MS) {
        // Content stayed shorter than before (e.g. fewer items now): go as far as we can.
        window.scrollTo({ top: Math.max(0, max), behavior: "instant" as ScrollBehavior });
        return;
      }
      frame = requestAnimationFrame(attempt);
    };
    // Let the router finish its own scroll-to-top for the new screen first.
    frame = requestAnimationFrame(attempt);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pathname, search]);

  return null;
}
