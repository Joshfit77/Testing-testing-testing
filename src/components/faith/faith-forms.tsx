"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bot, Lock } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useDraft } from "@/lib/use-draft";
import { DraftRestoredNotice } from "@/components/drafts/draft-notice";
import { THEME_LABELS } from "@/data/content";
import { JOURNAL_KIND_LABELS, JOURNAL_KINDS, type JournalKind } from "@/lib/domain/journal";
import { cn } from "@/lib/utils";
import { createCustomPracticeAction, markPrayerAnsweredAction, saveJournalEntryAction } from "@/server/actions/faith";

export interface JournalEntryInput {
  id: string;
  entry_date: string;
  kind: JournalKind;
  theme: string | null;
  scripture_ref: string | null;
  title: string | null;
  body: string;
  share_with_coach: boolean;
}

const BODY_LABEL: Record<JournalKind, string> = { reflection: "Reflection", request: "Prayer", praise: "Praise" };

/** New or edit prayer-journal entry. Unsaved text is kept as a device-only draft until it is saved. */
export function JournalForm({ today, entry, defaultRef, onSaved }: { today: string; entry?: JournalEntryInput; defaultRef?: string; onSaved?: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(saveJournalEntryAction, initialActionState);
  const id = entry?.id ?? "new";
  // Blank = the values the form opens with, so an untouched form stores nothing.
  const blank = useMemo(
    () => ({
      entryDate: entry?.entry_date ?? today,
      kind: (entry?.kind ?? "reflection") as JournalKind,
      theme: entry?.theme ?? "",
      scriptureRef: entry?.scripture_ref ?? defaultRef ?? "",
      title: entry?.title ?? "",
      body: entry?.body ?? "",
      share: entry?.share_with_coach ?? false,
    }),
    [entry, today, defaultRef],
  );
  const draft = useDraft(`faith.journal.${id}`, blank);
  const v = draft.value;
  const set = (k: Exclude<keyof typeof blank, "share">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    draft.setValue((d) => ({ ...d, [k]: e.target.value }));
  const clearDraft = draft.clear;
  useEffect(() => {
    if (state.ok && state.at) {
      clearDraft();
      router.refresh();
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.at, clearDraft]);
  const kind = v.kind && (JOURNAL_KINDS as readonly string[]).includes(v.kind) ? v.kind : "reflection";
  return (
    <form action={action} className="space-y-3">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {draft.restored && <DraftRestoredNotice label="Unsaved journal entry restored" onDiscard={draft.clear} onDismiss={draft.dismissRestored} />}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Type</legend>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Entry type">
          {JOURNAL_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold leading-tight focus-within:ring-2 focus-within:ring-gold-highlight",
                kind === k ? "border-gold bg-gold/12 text-gold-highlight" : "border-border bg-elevated/50 text-muted-foreground",
              )}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => draft.setValue((d) => ({ ...d, kind: k }))} className="sr-only" />
              {k === "praise" ? "Praise" : JOURNAL_KIND_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor={`j-title-${id}`}>Title (optional)</Label>
        <Input id={`j-title-${id}`} name="title" maxLength={120} value={v.title} onChange={set("title")} placeholder={kind === "request" ? "e.g. Mum's recovery" : undefined} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`j-body-${id}`}>{BODY_LABEL[kind]}</Label>
        <Textarea id={`j-body-${id}`} name="body" required maxLength={10000} value={v.body} onChange={set("body")} className="min-h-32" aria-invalid={Boolean(state.fieldErrors?.body)} />
        <FieldError message={state.fieldErrors?.body} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`j-ref-${id}`}>Scripture (optional)</Label>
          <Input id={`j-ref-${id}`} name="scriptureRef" maxLength={80} value={v.scriptureRef} onChange={set("scriptureRef")} placeholder="e.g. Galatians 6:9" />
        </div>
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
      </div>
      <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-elevated/40 p-3 text-sm">
        <input
          type="checkbox"
          name="shareWithCoach"
          checked={Boolean(v.share)}
          onChange={(e) => draft.setValue((d) => ({ ...d, share: e.target.checked }))}
          className="mt-0.5 size-5 shrink-0 accent-[#C9A54C]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-semibold">
            <Bot className="size-4 text-gold" aria-hidden /> Share with AI Coach
          </span>
          <span className="block text-xs text-muted-foreground">
            Off by default. When on, the coach can read this entry (a short excerpt) to encourage you. You can turn it off any time.
          </span>
        </span>
      </label>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden /> {v.share ? "Visible to you and, as you chose, the AI coach. Never to administrators." : "Private to you. Never visible to administrators or the AI coach."}
      </p>
      <FormMessage state={state} />
      <SubmitButton>{entry ? "Update entry" : "Save entry"}</SubmitButton>
    </form>
  );
}

export function AnsweredForm({ id, today }: { id: string; today: string }) {
  const router = useRouter();
  const [state, action] = useActionState(markPrayerAnsweredAction, initialActionState);
  useEffect(() => {
    if (state.ok && state.at) router.refresh();
  }, [state.ok, state.at, router]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="max-w-48 space-y-1">
        <Label htmlFor={`ans-date-${id}`}>Answered on</Label>
        <Input id={`ans-date-${id}`} name="answeredOn" type="date" defaultValue={today} max={today} required />
        <FieldError message={state.fieldErrors?.answeredOn} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`ans-note-${id}`}>How was it answered? (optional)</Label>
        <Textarea id={`ans-note-${id}`} name="note" maxLength={2000} className="min-h-20" />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Mark answered</SubmitButton>
    </form>
  );
}

export function CustomPracticeForm() {
  const router = useRouter();
  const [state, action] = useActionState(createCustomPracticeAction, initialActionState);
  useEffect(() => {
    if (state.ok && state.at) router.refresh();
  }, [state.ok, state.at, router]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.at : "new"}>
      <div className="min-w-44 flex-1 space-y-1">
        <Label htmlFor="practice-custom">Add your own</Label>
        <Input id="practice-custom" name="title" required maxLength={120} placeholder="e.g. Memorise a verse" />
      </div>
      <SubmitButton variant="secondary">Add</SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Edit an existing entry, then return to its page. */
export function EditJournalEntry({ entry, today }: { entry: JournalEntryInput; today: string }) {
  const router = useRouter();
  return <JournalForm today={today} entry={entry} onSaved={() => router.replace(`/faith/journal/${entry.id}`)} />;
}
