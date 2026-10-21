import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, CheckCircle2, Lock, Pencil, Trash2, Undo2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { AnsweredForm, EditJournalEntry } from "@/components/faith/faith-forms";
import { formatJournalDate } from "@/components/faith/journal-entry-card";
import { BackLink } from "@/components/platform/back-link";
import { Button } from "@/components/ui/button";
import { THEME_LABELS, type FaithTheme } from "@/data/content";
import { isoDateInTz } from "@/lib/domain/dates";
import { JOURNAL_KIND_LABELS } from "@/lib/domain/journal";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { clearPrayerAnsweredAction, deleteJournalEntryAction, setJournalShareAction } from "@/server/actions/faith";
import { JOURNAL_SELECT, type JournalRow } from "@/server/services/faith";

export const metadata = { title: "Journal entry" };

export default async function JournalEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("faith_journal_entries").select(JOURNAL_SELECT).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  const e = data as unknown as JournalRow;
  const today = isoDateInTz(new Date(), profile.timezone);
  const editing = sp.edit === "1";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/journal">Prayer journal</BackLink>
      <PageHeader
        eyebrow={`${JOURNAL_KIND_LABELS[e.kind] ?? "Reflection"} · ${formatJournalDate(e.entry_date)}`}
        title={e.title || (e.kind === "request" ? "Prayer request" : e.kind === "praise" ? "Praise" : "Reflection")}
        className="mb-2"
      />

      {editing ? (
        <section className="rounded-2xl border border-border bg-card p-4" aria-label="Edit entry">
          <EditJournalEntry
            today={today}
            entry={{ id: e.id, entry_date: e.entry_date, kind: e.kind, theme: e.theme, scripture_ref: e.scripture_ref, title: e.title, body: e.body, share_with_coach: e.share_with_coach }}
          />
          <Link href={`/faith/journal/${e.id}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-highlight hover:underline">
            Cancel editing
          </Link>
        </section>
      ) : (
        <>
          <article className="rounded-2xl border border-border bg-card p-4">
            <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{e.body}</p>
            {(e.scripture_ref || e.theme) && (
              <p className="mt-3 text-sm text-muted-foreground">
                {[e.scripture_ref, e.theme ? THEME_LABELS[e.theme as FaithTheme] : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </article>

          {e.kind === "request" &&
            (e.answered_on ? (
              <section className="rounded-2xl border border-[#5fc49a]/40 bg-[#5fc49a]/5 p-4" aria-labelledby="answered-title">
                <h2 id="answered-title" className="flex items-center gap-2 font-semibold text-[#5fc49a]">
                  <CheckCircle2 className="size-5" aria-hidden /> Answered on {formatJournalDate(e.answered_on)}
                </h2>
                {e.answered_note && <p className="mt-2 whitespace-pre-wrap text-sm">{e.answered_note}</p>}
                <ActionButton action={clearPrayerAnsweredAction} fields={{ id: e.id }} variant="ghost" size="sm" className="mt-2" confirmMessage="Mark this prayer as not answered yet?" confirmDetail="The answered date and note will be removed.">
                  <Undo2 aria-hidden /> Not answered yet
                </ActionButton>
              </section>
            ) : (
              <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="answer-title">
                <h2 id="answer-title" className="mb-2 font-semibold">
                  Has God answered this prayer?
                </h2>
                <AnsweredForm id={e.id} today={today} />
              </section>
            ))}

          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="share-title">
            <h2 id="share-title" className="flex items-center gap-2 font-semibold">
              {e.share_with_coach ? <Bot className="size-5 text-gold" aria-hidden /> : <Lock className="size-5 text-gold" aria-hidden />}
              {e.share_with_coach ? "Shared with AI Coach" : "Private"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {e.share_with_coach
                ? "The AI coach can read a short excerpt of this entry. Administrators can't."
                : "Only you can see this entry. It isn't shared with the AI coach or administrators."}
            </p>
            <ActionButton action={setJournalShareAction} fields={{ id: e.id, share: e.share_with_coach ? "false" : "true" }} variant="secondary" size="sm" className="mt-3">
              {e.share_with_coach ? "Stop sharing with AI Coach" : "Share with AI Coach"}
            </ActionButton>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary">
              <Link href={`/faith/journal/${e.id}?edit=1`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </Button>
            <ActionButton
              action={deleteJournalEntryAction}
              fields={{ id: e.id }}
              variant="ghost"
              navigateTo="/faith/journal"
              confirmMessage="Delete this journal entry?"
              confirmDetail="It can't be recovered."
              confirmLabel="Delete"
            >
              <Trash2 aria-hidden /> Delete
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}
