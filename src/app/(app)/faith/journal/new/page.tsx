import { Lock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { NewJournalEntry } from "@/components/faith/faith-forms";
import { BackLink } from "@/components/platform/back-link";
import { isoDateInTz } from "@/lib/domain/dates";
import { JOURNAL_KIND_LABELS, JOURNAL_KINDS, type JournalKind } from "@/lib/domain/journal";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "New prayer" };

/** Write a prayer or reflection. Opened from the journey (kind=daily) or the journal. Writing is always optional. */
export default async function NewJournalEntryPage({ searchParams }: { searchParams: Promise<{ kind?: string; ref?: string; from?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireOnboardedUser();
  const kind = sp.kind && (JOURNAL_KINDS as readonly string[]).includes(sp.kind) ? (sp.kind as JournalKind) : undefined;
  const fromJourney = sp.from === "journey";
  const returnTo = fromJourney ? "/faith/journey" : "/faith/journal";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href={returnTo}>{fromJourney ? "Journey" : "Prayer journal"}</BackLink>
      <PageHeader
        title={kind ? JOURNAL_KIND_LABELS[kind] : "New entry"}
        description={
          <span className="flex items-center gap-1.5">
            <Lock className="size-4 shrink-0" aria-hidden /> Private to you. Writing a prayer down is optional; it never decides whether a day counts.
          </span>
        }
        className="mb-2"
      />
      <section className="rounded-2xl border border-border bg-card p-4">
        <NewJournalEntry today={isoDateInTz(new Date(), profile.timezone)} kind={kind} scriptureRef={sp.ref?.slice(0, 80)} returnTo={returnTo} />
      </section>
    </div>
  );
}
