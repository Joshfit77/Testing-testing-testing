"use client";

/**
 * Android's back button (and back gesture) closes what is open on top before it leaves the screen (O-07): a sheet,
 * dialog or confirmation closes exactly as Escape closes it; only with nothing open does Back go to the previous
 * screen. Returns true when something was closed.
 */
const OPEN_OVERLAY = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="dialog"][aria-modal="true"]';

export function closeTopOverlay(doc: Document = document): boolean {
  const open = Array.from(doc.querySelectorAll<HTMLElement>(OPEN_OVERLAY));
  const top = open.at(-1);
  if (!top) return false;
  const active = doc.activeElement;
  const target = active instanceof HTMLElement && top.contains(active) ? active : top;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
  return true;
}
