import Link from "next/link";
import { Brain, CheckCircle2, ChevronRight, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { MemoryAddForm } from "@/components/faith/memory-add-form";
import { bookById } from "@/lib/bible/books";
import { formatReference } from "@/lib/bible/reference";
import { isoDateInTz } from "@/lib/domain/dates";
import { formatShortDate } from "@/lib/faith/dates";
import { LEVEL_LABELS, memoryRef, type MemoryRow } from "@/lib/faith/memory";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { deleteMemoryAction } from "@/server/actions/bible";
import { passageParts } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";

export const metadata = { title: "Scripture memory" };

/** Verses the member is learning: due ones first. Private, optional, and separate from any journey. */
export default async function MemoryPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const { data } = await supabase.from("scripture_memory").select("id, book_id, chapter, verse_start, verse_end, status, level, review_count, next_review_on").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
  const rows = ((data ?? []) as MemoryRow[]).filter((r) => bookById(r.book_id));
  const due = rows.filter((r) => !r.next_review_on || r.next_review_on <= today);
  const later = rows.filter((r) => r.next_review_on && r.next_review_on > today);

  const Item = ({ r }: { r: MemoryRow }) => {
    const ref = memoryRef(r);
    return (
      <li className="flex items-start gap-1 rounded-2xl border border-border bg-card">
        <Link href={`/faith/memory/${r.id}`} className="min-w-0 flex-1 p-3">
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gold-highlight">{formatReference(ref)}</span>
            <span className="text-xs text-muted-foreground">{r.status === "memorized" ? "Memorized" : LEVEL_LABELS[r.level]}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block font-serif text-[0.9375rem] text-muted-foreground">
            <ScriptureText parts={passageParts(ref)} />
          </span>
          {r.next_review_on && r.next_review_on > today && <span className="mt-1 block text-xs text-muted-foreground">Next practice {formatShortDate(r.next_review_on)}</span>}
        </Link>
        <ActionButton action={deleteMemoryAction} fields={{ id: r.id }} variant="ghost" size="icon" aria-label={`Remove ${formatReference(ref)}`} confirmMessage="Remove this passage from memory practice?" confirmLabel="Remove">
          <Trash2 aria-hidden />
        </ActionButton>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Scripture memory" description="Hide God's word in your heart, a little at a time. Private to you, and separate from your reading journey." className="mb-2" />
      <section className="rounded-2xl border border-border bg-card p-4">
        <MemoryAddForm />
      </section>
      {rows.length === 0 ? (
        <EmptyState icon={Brain} title="No passages yet" description="Add a reference above, or tap verses while reading and choose Memorize." />
      ) : (
        <>
          <section aria-labelledby="due-title">
            <h2 id="due-title" className="mb-2 flex items-center gap-2 font-semibold">
              <Brain className="size-5 text-gold" aria-hidden /> Practise today {due.length ? `(${due.length})` : ""}
            </h2>
            {due.length ? (
              <ul className="space-y-2">{due.map((r) => <Item key={r.id} r={r} />)}</ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-gold" aria-hidden /> Nothing due today.
              </p>
            )}
          </section>
          {later.length > 0 && (
            <section aria-labelledby="later-title">
              <h2 id="later-title" className="mb-2 font-semibold">
                Coming back later
              </h2>
              <ul className="space-y-2">{later.map((r) => <Item key={r.id} r={r} />)}</ul>
            </section>
          )}
        </>
      )}
      <Link href="/faith/reminders" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight hover:underline">
        Memory practice reminders <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
