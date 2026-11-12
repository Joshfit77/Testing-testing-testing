"use client";

/**
 * On-screen keyboard handling.
 *
 * Native (Capacitor): capacitor.config.ts sets Keyboard.resize = "native", so the web view itself
 * shrinks above the keyboard and fixed bottom bars move up with it. We additionally listen to the
 * plugin's show/hide events to flag `html[data-keyboard="open"]`.
 *
 * Web (mobile Safari/Chrome): the layout viewport often does not shrink; only the visual viewport
 * does. We measure the covered height from window.visualViewport and expose it as CSS variables:
 *   --keyboard-inset  px covered by the keyboard at the bottom of the layout viewport
 *   --vv-height       visible height
 *   --vv-top          visual viewport offset from the top of the layout viewport
 * plus `data-keyboard="open"` on <html>; src/components/platform/keyboard.css uses them to hide the
 * bottom tab bar and lift bottom sheets. Focused fields are scrolled into view when covered.
 */

/** Below this many covered pixels we assume a toolbar/URL bar change rather than a keyboard. */
export const KEYBOARD_THRESHOLD_PX = 120;

export function keyboardInset(layoutHeight: number, vv: { height: number; offsetTop: number } | null | undefined): number {
  if (!vv) return 0;
  const covered = layoutHeight - vv.height - vv.offsetTop;
  return covered > KEYBOARD_THRESHOLD_PX ? Math.round(covered) : 0;
}

export function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const nonText = ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"];
    return !nonText.includes(el.type) && !el.readOnly && !el.disabled;
  }
  return el instanceof HTMLSelectElement;
}

/** True when the element's box is (partly) below the visible area or above it. */
export function isCovered(rect: { top: number; bottom: number }, visibleTop: number, visibleBottom: number, margin = 16): boolean {
  return rect.bottom > visibleBottom - margin || rect.top < visibleTop + margin;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.dataset.motion === "reduce") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
