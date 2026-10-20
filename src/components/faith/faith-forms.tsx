"use client";

import { useActionState, useEffect, useMemo } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useDraft } from "@/lib/use-draft";
import { DraftRestoredNotice } from "@/components/drafts/draft-notice";
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
  const id = entry?.id ?? "new";
  // The unsaved entry is kept as a draft on this device only (journal text never leaves it until you
  // save). Saving clears it. Blank = the values the form opens with, so an untouched form stores nothing.
  const blank = useMemo(
    () => ({
      entryDate: entry?.entry_date ?? today,
      theme: entry?.theme ?? "",
      scriptureRef: entry?.scripture_ref ?? defaultRef ?? "",
      title: entry?.title ?? "",
      body: entry?.body ?? "",
    }),
    [entry, today, defaultRef],
  );
  const draft = useDraft(`faith.journal.${id}`, blank);
  const v = draft.value;
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    draft.setValue((d) => ({ ...d, [k]: e.target.value }));
  const clearDraft = draft.clear;
  useEffect(() => {
    if (state.ok && state.at) clearDraft();
  }, [state.ok, state.at, clearDraft]);
  return (
    <form action={action} className="space-y-3">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {draft.restored && <DraftRestoredNotice label="Unsaved journal entry restored" onDiscard={draft.clear} onDismiss={draft.dismissRestored} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`j-date-${id}`}>Date</Label>
          <Input id={`j-date-${id}`} name="entryDate" type="date" value={v.entryDate} onChange={set("entryDate")} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`j-theme-${id}`}>Theme</Label>
          <NativeSelect id={`j-theme-${id}`} name="theme" value={v.theme} onChange={set("theme")}>
            <option value="">None</option>
            {Object.entries(THEME_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`j-ref-${id}`}>Scripture</Label>
          <Input id={`j-ref-${id}`} name="scriptureRef" maxLength={80} value={v.scriptureRef} onChange={set("scriptureRef")} placeholder="e.g. Galatians 6:9" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`j-title-${id}`}>Title (optional)</Label>
        <Input id={`j-title-${id}`} name="title" maxLength={120} value={v.title} onChange={set("title")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`j-body-${id}`}>Reflection</Label>
        <Textarea id={`j-body-${id}`} name="body" required maxLength={10000} value={v.body} onChange={set("body")} className="min-h-32" aria-invalid={Boolean(state.fieldErrors?.body)} />
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
