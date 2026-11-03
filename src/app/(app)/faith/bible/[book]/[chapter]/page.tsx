import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { ChapterReader } from "@/components/bible/chapter-reader";
import { bookBySlug, chapterHref, chapterLabel, nextChapter, previousChapter } from "@/lib/bible/books";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { bibleMeta, getChapter, lastVerse, versesWithoutText } from "@/server/bible/text";
import { loadChapterAnnotations, loadReadingState } from "@/server/services/bible";

export async function generateMetadata({ params }: { params: Promise<{ book: string; chapter: string }> }) {
  const { book: slug, chapter } = await params;
  const book = bookBySlug(slug);
  return { title: book ? `${chapterLabel(book, Number(chapter))} (BSB)` : "Bible" };
}

export default async function ChapterPage({ params, searchParams }: { params: Promise<{ book: string; chapter: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ book: slug, chapter: ch }, sp] = await Promise.all([params, searchParams]);
  const book = bookBySlug(slug);
  const chapter = /^\d{1,3}$/.test(ch) ? Number(ch) : NaN;
  const verses = book ? getChapter(book.id, chapter) : null;
  if (!book || !verses) notFound();
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [notes, state] = await Promise.all([loadChapterAnnotations(supabase, user.id, book.id, chapter), loadReadingState(supabase, user.id)]);
  const v = Number(sp.v);
  const focusVerse = Number.isInteger(v) && v >= 1 && v <= lastVerse(book.id, chapter) ? v : null;
  const prev = previousChapter(book.id, chapter);
  const next = nextChapter(book.id, chapter);
  const label = chapterLabel(book, chapter);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <BackLink href="/faith/bible">Bible</BackLink>
        <Link href="/faith/bible/search" className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="Search the Bible">
          <Search className="size-5" aria-hidden />
        </Link>
      </div>
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Berean Standard Bible</p>
          <h1 className="font-display text-[1.75rem] font-bold leading-tight">{label}</h1>
        </div>
        <Link href={`/faith/bible/${book.slug}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 text-sm font-semibold text-gold-highlight hover:border-gold-muted">
          Chapters
        </Link>
      </header>

      <ChapterReader
        key={`${book.id}.${chapter}`}
        bookId={book.id}
        chapter={chapter}
        verses={verses}
        withoutText={versesWithoutText(book.id, chapter)}
        highlights={notes.highlights}
        bookmarks={notes.bookmarks}
        chapterBookmarked={notes.chapterBookmarked}
        notes={notes.notes}
        fontScale={state?.fontScale ?? 1}
        focusVerse={focusVerse}
      />

      <nav aria-label="Chapters" className="mx-auto grid max-w-[38rem] grid-cols-2 gap-2 pt-6">
        {prev ? (
          <Link href={chapterHref(prev.book, prev.chapter)} className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-3 hover:border-gold-muted">
            <ChevronLeft className="size-5 shrink-0 text-gold" aria-hidden />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Previous</span>
              <span className="block truncate font-semibold">{chapterLabel(prev.book, prev.chapter)}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={chapterHref(next.book, next.chapter)} className="flex min-h-14 items-center justify-end gap-2 rounded-2xl border border-border bg-card px-3 text-right hover:border-gold-muted">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Next</span>
              <span className="block truncate font-semibold">{chapterLabel(next.book, next.chapter)}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </nav>
      <p className="mx-auto max-w-[38rem] pt-4 text-xs text-muted-foreground">{bibleMeta().attribution} Tap a verse to highlight, bookmark, add a note, copy or share it.</p>
    </div>
  );
}
