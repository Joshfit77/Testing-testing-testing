import Link from "next/link";
import { BookOpen, Bookmark, ChevronRight, Highlighter, History, NotebookPen } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { BibleSearchForm } from "@/components/bible/search-form";
import { OfflineBible } from "@/components/bible/offline-bible";
import { chapterHref, chapterLabel, NEW_TESTAMENT, OLD_TESTAMENT, type BibleBook } from "@/lib/bible/books";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { bibleMeta, getChapter, wordsOfJesus } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";
import { loadReadingState } from "@/server/services/bible";

export const metadata = { title: "Bible" };

function BookGrid({ books, label }: { books: readonly BibleBook[]; label: string }) {
  return (
    <section aria-label={label}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-gold">{label}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((b) => (
          <li key={b.id}>
            <Link href={`/faith/bible/${b.slug}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 hover:border-gold-muted">
              <span className="min-w-0 truncate font-semibold">{b.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{b.chapters}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BiblePage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const state = await loadReadingState(supabase, user.id);
  const meta = bibleMeta();
  const preview = state ? (getChapter(state.book.id, state.chapter)?.find(([v]) => v === (state.verse ?? 1)) ?? getChapter(state.book.id, state.chapter)?.[0]) : null;

  const tools = [
    { href: "/faith/bible/saved?tab=bookmarks", label: "Bookmarks", icon: Bookmark },
    { href: "/faith/bible/saved?tab=highlights", label: "Highlights", icon: Highlighter },
    { href: "/faith/bible/saved?tab=notes", label: "Notes", icon: NotebookPen },
    { href: "/faith/bible/history", label: "History", icon: History },
  ];

  return (
    <div className="space-y-6">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Bible" description={`The complete ${meta.name}: ${meta.totals.books} books, ${meta.totals.chapters.toLocaleString("en-US")} chapters. Free to read, always.`} className="mb-2" />

      <BibleSearchForm />

      {state ? (
        <Link href={chapterHref(state.book, state.chapter, state.verse ?? undefined)} className="block rounded-2xl border border-gold-muted bg-card p-4 hover:border-gold">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Continue reading</span>
            <ChevronRight className="size-5 text-gold" aria-hidden />
          </span>
          <span className="mt-1 block font-display text-xl font-bold">
            {chapterLabel(state.book, state.chapter)}
            {state.verse ? `:${state.verse}` : ""}
          </span>
          {preview && state && (
            <span className="mt-1 line-clamp-2 block font-serif text-[0.9375rem] text-muted-foreground">
              <ScriptureText text={preview[1]} jesus={wordsOfJesus(state.book.id, state.chapter, preview[0])} />
            </span>
          )}
        </Link>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-5 text-gold" aria-hidden /> Where to begin
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { href: chapterHref("JHN", 1), label: "John 1", hint: "the life of Jesus" },
              { href: chapterHref("GEN", 1), label: "Genesis 1", hint: "the beginning" },
              { href: chapterHref("PSA", 1), label: "Psalm 1", hint: "prayer and praise" },
            ].map((s) => (
              <Link key={s.href} href={s.href} className="inline-flex min-h-11 flex-col justify-center rounded-xl border border-border px-3 py-1.5 hover:border-gold-muted">
                <span className="text-sm font-semibold text-gold-highlight">{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.hint}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav aria-label="My Bible" className="grid grid-cols-4 gap-2">
        {tools.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-xs font-semibold hover:border-gold-muted">
            <Icon className="size-5 text-gold" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <BookGrid books={OLD_TESTAMENT} label="Old Testament" />
      <BookGrid books={NEW_TESTAMENT} label="New Testament" />

      <OfflineBible bookIds={[...OLD_TESTAMENT, ...NEW_TESTAMENT].map((b) => b.id)} />

      <p className="text-xs text-muted-foreground">
        {meta.attribution} Text from {meta.source.replace(/^https?:\/\//, "")}, checked against its published checksum.
      </p>
    </div>
  );
}
