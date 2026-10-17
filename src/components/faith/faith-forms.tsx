"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { THEME_LABELS } from "@/data/content";
import { createDisciplineGoalAction, saveJournalEntryAction } from "@/server/actions/faith";

export function JournalForm({
  today,
  entry,
  defaultRef,
}: {
  today: string;
  entry?: { id: string; entry_date: string; theme: string | null; scripture_ref: string | null; title: string | null; body: string };
  defaultRef?: string;
}) {
  const [state, action] = useActionState(saveJournalEntryAction, initialActionState);
  return (
    <form action={action} className="space-y-3" key={entry ? entry.id : state.ok ? state.at : "new"}>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`j-date-${entry?.id ?? "new"}`}>Date</Label>
          <Input id={`j-date-${entry?.id ?? "new"}`} name="entryDate" type="date" defaultValue={entry?.entry_date ?? today} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`j-theme-${entry?.id ?? "new"}`}>Theme</Label>
          <NativeSelect id={`j-theme-${entry?.id ?? "new"}`} name="theme" defaultValue={entry?.theme ?? ""}>
            <option value="">None</option>
            {Object.entries(THEME_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`j-ref-${entry?.id ?? "new"}`}>Scripture</Label>
          <Input id={`j-ref-${entry?.id ?? "new"}`} name="scriptureRef" maxLength={80} defaultValue={entry?.scripture_ref ?? defaultRef ?? ""} placeholder="e.g. Galatians 6:9" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`j-title-${entry?.id ?? "new"}`}>Title (optional)</Label>
        <Input id={`j-title-${entry?.id ?? "new"}`} name="title" maxLength={120} defaultValue={entry?.title ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`j-body-${entry?.id ?? "new"}`}>Reflection</Label>
        <Textarea id={`j-body-${entry?.id ?? "new"}`} name="body" required maxLength={10000} defaultValue={entry?.body ?? ""} className="min-h-32" aria-invalid={Boolean(state.fieldErrors?.body)} />
        <FieldError message={state.fieldErrors?.body} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{entry ? "Update entry" : "Save entry"}</SubmitButton>
    </form>
  );
}

export function DisciplineGoalForm() {
  const [state, action] = useActionState(createDisciplineGoalAction, initialActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.at : "new"}>
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor="dg-title">New discipline goal</Label>
        <Input id="dg-title" name="title" required maxLength={120} placeholder="e.g. Read scripture before training" />
      </div>
      <div className="w-32 space-y-1">
        <Label htmlFor="dg-cadence">Cadence</Label>
        <NativeSelect id="dg-cadence" name="cadence" defaultValue="daily">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </NativeSelect>
      </div>
      <SubmitButton variant="secondary">Add</SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
