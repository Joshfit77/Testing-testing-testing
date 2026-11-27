"use client";

import { useEffect, useRef, useState } from "react";
import { NarrowGateOpening } from "@/components/common/narrow-gate-opening";

const playing = (state: string | undefined) => state === "play" || state === "entering" || state === "leaving";

/**
 * The full-screen opening, rendered by the root layout on every page. It is hidden unless the inline head script
 * (src/lib/opening.ts) set <html data-intro="play"> for this load, so it shows from the very first paint, and the
 * root layout keeps it mounted across in-app navigation, so tab switches never replay it. While it plays, the page
 * beneath is inert and focus is inside the dialog; when the script marks it done, it removes itself.
 */
export function AppOpeningOverlay({ verse, translation }: { verse: string; translation: string }) {
  const [mounted, setMounted] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const overlay = ref.current;
    if (!overlay || !playing(root.dataset.intro)) {
      setMounted(false);
      return;
    }
    const beneath = Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay && !el.contains(overlay));
    const wasInert = beneath.map((el) => el.inert);
    for (const el of beneath) el.inert = true;
    if (!overlay.contains(document.activeElement)) overlay.focus({ preventScroll: true });
    const restore = () => {
      observer.disconnect();
      beneath.forEach((el, i) => (el.inert = wasInert[i] ?? false));
    };
    const observer = new MutationObserver(() => {
      if (playing(root.dataset.intro)) return;
      restore();
      if (overlay.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      setMounted(false);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-intro"] });
    return restore;
  }, []);

  // Keep Tab inside the dialog (the page beneath is inert, but focus could otherwise leave for the browser's UI).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    // Only the buttons that are showing (Enter Narrow Gate appears a couple of seconds in).
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button")).filter((b) => getComputedStyle(b).visibility !== "hidden");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;
  return (
    <div ref={ref} className="ngo" role="dialog" aria-modal="true" aria-label="Narrow Gate Fitness opening" aria-describedby="ngo-verse" tabIndex={-1} onKeyDown={onKeyDown} data-testid="opening-overlay">
      <NarrowGateOpening verse={verse} translation={translation} />
    </div>
  );
}
