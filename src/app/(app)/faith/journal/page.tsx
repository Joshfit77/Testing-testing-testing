import Link from "next/link";
import { Lock, Plus, Search } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { JournalEntryCard } from "@/components/faith/journal-entry-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOURNAL_FILTER_LABELS, JOURNAL_FILTERS, journalSearchPattern, parseJournalFilter } from "@/lib/domain/journal";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { JOURNAL_SELECT, type JournalRow } from "@/server/services/faith";

export const metadata = { title: "Prayer journal" };

const PAGE = 50;

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const filter = parseJournalFilter(sp.filter);
  const q = (sp.q ?? "").slice(0, 80);
  const pattern = journalSearchPattern(q);

  let query = supabase.from("faith_journal_entries").select(JOURNAL_SELECT).eq("user_id", user.id);
  if (filter === "request" || filter === "praise" || filter === "reflection") query = query.eq("kind", filter);
  if (filter === "open") query = query.eq("kind", "request").is("answered_on", null);
  if (filter === "answered") query = query.eq("kind", "request").not("answered_on", "is", null);
  if (filter === "shared") query = query.eq("share_with_coach", true);
  if (pattern) query = query.or(`title.ilike.${pattern},body.ilike.${pattern},scripture_ref.ilike.${pattern},answered_note.ilike.${pattern}`);
  const { data, error } = await query.order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(PAGE + 1);
  const rows = (data ?? []) as unknown as JournalRow[];
  const entries = rows.slice(0, PAGE);

  const href = (f: string) => {
    const p = new URLSearchParams();
    if (f !== "all") p.set("filter", f);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/faith/journal${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader
        title="Prayer journal"
        description={
          <span className="flex items-center gap-1.5">
            <Lock className="size-4 shrink-0" aria-hidden /> Private to you. Shared with the AI coach only when you tick it on an entry.
          </span>
        }
        className="mb-2"
        actions={
          <Button asChild size="sm">
            <Link href="/faith#journal-new">
              <Plus aria-hidden /> New entry
            </Link>
          </Button>
        }
      />

      <form role="search" action="/faith/journal" className="flex gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <label htmlFor="journal-q" className="sr-only">
          Search your journal
        </label>
        <Input id="journal-q" name="q" type="search" defaultValue={q} placeholder="Search titles, prayers, Scripture" maxLength={80} className="flex-1" />
        <Button type="submit" variant="secondary" aria-label="Search">
          <Search aria-hidden />
        </Button>
      </form>

      <nav aria-label="Filter entries" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
        {JOURNAL_FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f)}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold",
              filter === f ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground",
            )}
          >
            {JOURNAL_FILTER_LABELS[f]}
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Couldn&apos;t load your journal. Please try again.
        </p>
      ) : entries.length ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {q ? `${entries.length}${rows.length > PAGE ? "+" : ""} matching “${q}”` : `${entries.length}${rows.length > PAGE ? "+" : ""} entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {entries.map((e) => (
              <li key={e.id}>
                <JournalEntryCard entry={e} />
              </li>
            ))}
          </ul>
          {rows.length > PAGE && <p className="text-sm text-muted-foreground">Showing the newest {PAGE}. Search to find older entries.</p>}
        </>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {q || filter !== "all" ? "No entries match. Try another word or filter." : "No entries yet. Write your first prayer on the Faith tab."}
        </p>
      )}
    </div>
  );
}
