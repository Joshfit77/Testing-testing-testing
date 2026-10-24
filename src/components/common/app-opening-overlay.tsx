"use client";

import { useEffect, useState } from "react";
import { NarrowGateOpening } from "@/components/common/narrow-gate-opening";
import { scriptureText } from "@/data/scripture";

/** Plays on a full app load/reload, but not during client-side tab navigation. */
export function AppOpeningOverlay() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(false), 4400);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#070707]" role="dialog" aria-modal="true" aria-label="Narrow Gate Fitness opening">
      <NarrowGateOpening
        verse={scriptureText("Matthew 7:13–14", "")}
        translation="BSB"
        continueHref="#"
        continueLabel="Enter the app"
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[120] min-h-11 rounded-lg border border-gold-muted bg-[#151515] px-4 text-sm font-semibold text-gold-highlight"
      >
        Skip intro
      </button>
      <button type="button" aria-label="Continue to the app" className="absolute inset-0 -z-10" onClick={() => setOpen(false)} />
    </div>
  );
}
