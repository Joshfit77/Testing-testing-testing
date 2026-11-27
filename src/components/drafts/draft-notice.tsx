"use client";

import { History, X } from "lucide-react";

/** Small "Draft restored" line shown above a form whose unsent values were brought back from this device. */
export function DraftRestoredNotice({ onDiscard, onDismiss, label = "Draft restored" }: { onDiscard: () => void; onDismiss?: () => void; label?: string }) {
  return (
    <div role="status" data-testid="draft-restored" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gold-muted/50 bg-gold/5 px-3 py-2 text-sm">
      <History className="size-4 shrink-0 text-gold" aria-hidden />
      <span className="flex-1">{label}. It&apos;s saved on this device until you send it.</span>
      <button type="button" onClick={onDiscard} className="min-h-11 rounded-lg px-2 font-semibold text-gold-highlight hover:underline">
        Discard draft
      </button>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Hide this notice" className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
