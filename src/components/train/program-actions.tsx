"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Bookmark, Lock, Play } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/action-state";
import { saveProgramAction, startProgramAction } from "@/server/actions/programs";

export function ProgramActions({
  programId,
  locked,
  isActive,
  isSaved,
  pausedWeek = null,
}: {
  programId: string;
  locked: boolean;
  isActive: boolean;
  isSaved: boolean;
  /** Set when this program is paused: it resumes at this week (or can be restarted). */
  pausedWeek?: number | null;
}) {
  const [saveState, saveAction] = useActionState(saveProgramAction, initialActionState);
  const [startState, startAction] = useActionState(startProgramAction, initialActionState);
  if (locked) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button asChild>
          <Link href="/profile/billing">
            <Lock aria-hidden /> Upgrade to unlock
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">This program is part of the Plus library.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Button asChild>
            <Link href="/home">
              <Play aria-hidden /> Continue program
            </Link>
          </Button>
        ) : pausedWeek ? (
          <>
            <form action={startAction}>
              <input type="hidden" name="programId" value={programId} />
              <SubmitButton pendingLabel="Resuming…">
                <Play aria-hidden /> Resume (week {pausedWeek})
              </SubmitButton>
            </form>
            <form action={startAction}>
              <input type="hidden" name="programId" value={programId} />
              <input type="hidden" name="restart" value="1" />
              <SubmitButton variant="secondary" pendingLabel="Restarting…">
                Restart from week 1
              </SubmitButton>
            </form>
          </>
        ) : (
          <form action={startAction}>
            <input type="hidden" name="programId" value={programId} />
            <SubmitButton pendingLabel="Starting…">
              <Play aria-hidden /> Start program
            </SubmitButton>
          </form>
        )}
        {!isSaved && !isActive && (
          <form action={saveAction}>
            <input type="hidden" name="programId" value={programId} />
            <SubmitButton variant="secondary" pendingLabel="Saving…" disabled={saveState.ok}>
              <Bookmark aria-hidden /> {saveState.ok ? "Saved" : "Save"}
            </SubmitButton>
          </form>
        )}
      </div>
      <FormMessage state={startState.message ? startState : saveState} />
    </div>
  );
}
