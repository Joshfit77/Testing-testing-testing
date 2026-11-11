"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { MAX_NOTES } from "@/lib/domain/activities";
import { updateGpsActivityNotesAction } from "@/server/actions/activities";

/**
 * Edit a GPS recording: notes and perceived effort only. The distance, times and route are what the phone measured,
 * so they are not offered here (and the server action ignores anything else).
 */
export function GpsNotesForm({ id, effort: initialEffort, notes: initialNotes }: { id: string; effort: string; notes: string }) {
  const router = useRouter();
  const [state, action] = useActionState(updateGpsActivityNotesAction, initialActionState);
  // Controlled, so a failed save keeps what was typed (React resets uncontrolled fields after a form action).
  const [effort, setEffort] = useState(initialEffort);
  const [notes, setNotes] = useState(initialNotes);
  const [handled, setHandled] = useState<number | undefined>(undefined);
  const err = state.fieldErrors ?? {};

  useEffect(() => {
    if (!state.ok || state.at === undefined || state.at === handled) return;
    setHandled(state.at);
    router.push(`/run/activities/${id}`);
    router.refresh();
  }, [state, handled, router, id]);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted-foreground" data-testid="gps-edit-note">
        This was recorded with GPS, so its distance, time and route stay as measured. You can change the notes and effort.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="gps-activity-effort">Perceived effort (optional)</Label>
        <select
          id="gps-activity-effort"
          name="effort"
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
          className="h-11 w-full rounded-[0.625rem] border border-border bg-elevated px-3 text-base text-foreground"
          aria-invalid={Boolean(err.effort)}
        >
          <option value="">Not rated</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
              {n === 1 ? " – very easy" : n === 5 ? " – moderate" : n === 10 ? " – maximal" : ""}
            </option>
          ))}
        </select>
        <FieldError message={err.effort} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gps-activity-notes">Notes (optional)</Label>
        <textarea
          id="gps-activity-notes"
          name="notes"
          rows={3}
          maxLength={MAX_NOTES}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-[0.625rem] border border-border bg-elevated px-3 py-2 text-base text-foreground placeholder:text-muted-foreground"
          placeholder="How did it feel? Route, weather, shoes…"
          aria-invalid={Boolean(err.notes)}
        />
        <FieldError message={err.notes} />
      </div>

      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton className="w-full sm:flex-1">Save changes</SubmitButton>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
