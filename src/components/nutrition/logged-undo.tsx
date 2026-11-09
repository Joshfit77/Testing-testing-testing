"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { UNDO_LOG_MS, type LogResult } from "@/lib/domain/diary";
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
  useEffect(() => {
    if (!canUndo) return;
    const t = setTimeout(() => setExpired(true), UNDO_LOG_MS);
    return () => clearTimeout(t);
  }, [canUndo]);

  if (!result.ok) {
    return (
      <p role="alert" className={cn("text-sm text-[#f08a8a]", className)}>
        {result.message}
      </p>
    );
  }
  const shown = undone ?? result;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
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
