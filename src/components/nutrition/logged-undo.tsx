"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { UNDO_LOG_MS, type LogResult } from "@/lib/domain/diary";
import { isCovered, prefersReducedMotion } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { undoLoggedItemsAction } from "@/server/actions/nutrition";

/**
 * The confirmation after food is logged ("Logged Banana (1 medium) to breakfast.") with an "Undo" beside it for
 * about 8 seconds. Undo removes exactly the rows that log added (their ids came back from the action). The message
 * itself stays; only the button goes. Errors show as an alert with no Undo.
 */
export function LoggedUndo({ result, className, onUndone }: { result: LogResult | null; className?: string; onUndone?: () => void }) {
  if (!result?.message) return null;
  // A new result (new `at`) starts a fresh line with its own Undo window.
  return <LoggedUndoLine key={result.at ?? result.message} result={result} className={className} onUndone={onUndone} />;
}

function LoggedUndoLine({ result, className, onUndone }: { result: LogResult; className?: string; onUndone?: () => void }) {
  const [expired, setExpired] = useState(false);
  const [undone, setUndone] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const canUndo = result.ok && Boolean(result.itemIds?.length);
  const line = useRef<HTMLDivElement & HTMLParagraphElement>(null);
  // The confirmation can appear below the fold or behind the phone tab bar (a long Recent foods list puts it there):
  // bring it into view so the member sees what was logged and can reach Undo. Inside a dialog the dialog scrolls.
  // Checked again once the page settles: the refresh that follows a log re-renders the list above and can push the
  // line down after it first appeared.
  useEffect(() => {
    const reveal = () => {
      const el = line.current;
      if (!el) return;
      // The phone tab bar; the desktop sidebar shares its label but is hidden (zero size) on a phone.
      const tabBar = el.closest('[role="dialog"]')
        ? undefined
        : [...document.querySelectorAll<HTMLElement>('nav[aria-label="Main sections"]')].map((n) => n.getBoundingClientRect()).find((r) => r.height > 0 && r.bottom >= window.innerHeight - 1);
      const visibleBottom = tabBar ? tabBar.top : window.innerHeight;
      if (isCovered(el.getBoundingClientRect(), 0, visibleBottom)) el.scrollIntoView?.({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    };
    const frame = requestAnimationFrame(reveal);
    const timers = [300, 1000].map((ms) => setTimeout(reveal, ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    if (!canUndo) return;
    const t = setTimeout(() => setExpired(true), UNDO_LOG_MS);
    return () => clearTimeout(t);
  }, [canUndo]);

  if (!result.ok) {
    return (
      <p ref={line} role="alert" className={cn("text-sm text-[#f08a8a]", className)}>
        {result.message}
      </p>
    );
  }
  const shown = undone ?? result;
  return (
    <div ref={line} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <p role={shown.ok ? "status" : "alert"} className={cn("text-sm", shown.ok ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
        {shown.message}
      </p>
      {canUndo && !expired && !undone?.ok && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11"
          disabled={pending}
          aria-busy={pending}
          data-testid="undo-log"
          onClick={() =>
            start(async () => {
              const res = await undoLoggedItemsAction({ ids: result.itemIds });
              setUndone(res);
              if (res.ok) onUndone?.();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />} Undo
        </Button>
      )}
    </div>
  );
}
