import Link from "next/link";
import { Bot, CheckCircle2, ChevronRight, HandHeart } from "lucide-react";
import { JOURNAL_KIND_LABELS } from "@/lib/domain/journal";
import type { JournalRow } from "@/server/services/faith";

export function formatJournalDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** One journal entry in a list; opens the entry. */
export function JournalEntryCard({ entry }: { entry: Pick<JournalRow, "id" | "entry_date" | "kind" | "title" | "body" | "scripture_ref" | "answered_on" | "share_with_coach"> }) {
  const answered = entry.kind === "request" && entry.answered_on;
  return (
    <Link href={`/faith/journal/${entry.id}`} className="flex min-h-16 items-start gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-gold">{JOURNAL_KIND_LABELS[entry.kind] ?? "Reflection"}</span>
          <span aria-hidden>·</span>
          <span>{formatJournalDate(entry.entry_date)}</span>
          {answered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#5fc49a]/50 px-2 py-0.5 font-semibold text-[#5fc49a]">
              <CheckCircle2 className="size-3" aria-hidden /> Answered
            </span>
          ) : entry.kind === "request" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
              <HandHeart className="size-3" aria-hidden /> Still praying
            </span>
          ) : null}
          {entry.share_with_coach && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold-muted/60 px-2 py-0.5">
              <Bot className="size-3" aria-hidden /> Shared with coach
            </span>
          )}
        </span>
        {entry.title ? (
          <>
            <span className="mt-1 block truncate font-semibold">{entry.title}</span>
            <span className="mt-0.5 line-clamp-2 block whitespace-pre-wrap text-sm text-muted-foreground">{entry.body}</span>
          </>
        ) : (
          <span className="mt-1 line-clamp-3 block whitespace-pre-wrap text-sm">{entry.body}</span>
        )}
        {entry.scripture_ref && <span className="mt-1 block text-xs text-gold-highlight">{entry.scripture_ref}</span>}
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 text-gold" aria-hidden />
    </Link>
  );
}
