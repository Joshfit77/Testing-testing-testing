import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { bookById, chapterHref, chapterLabel, BIBLE_BOOKS } from "@/lib/bible/books";
import { selectionReference, verseRange } from "@/lib/bible/format";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { deleteBibleNoteFormAction, removeBookmarkAction, removeHighlightAction } from "@/server/actions/bible";
import { getChapter, wordsOfJesus } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";

export const metadata = { title: "My Bible" };

const TABS = { bookmarks: "Bookmarks", highlights: "Highlights", notes: "Notes" } as const;
type Tab = keyof typeof TABS;
const LIMIT = 300;
const order = new Map(BIBLE_BOOKS.map((b) => [b.id, b.order]));
const verseText = (bookId: string, chapter: number, verse: number) => getChapter(bookId, chapter)?.find(([v]) => v === verse)?.[1] ?? "";
const COLOR_DOT: Record<string, string> = { gold: "bg-[#C9A54C]", sage: "bg-[#7FA37A]", sky: "bg-[#6E9CC4]", rose: "bg-[#C47A86]" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "bookmarks";
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();

  let body: React.ReactNode;
  if (tab === "bookmarks") {
    const { data } = await supabase.from("bible_bookmarks").select("id, book_id, chapter, verse, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(LIMIT);
    const rows = data ?? [];
    body = rows.length ? (
      <ul className="space-y-2">
        {rows.map((r) => {
          const book = bookById(r.book_id as string)!;
          const verse = r.verse as number | null;
          return (
            <li key={r.id as string} className="flex items-start gap-1 rounded-2xl border border-border bg-card">
              <Link href={chapterHref(book, r.chapter as number, verse ?? undefined)} className="min-w-0 flex-1 p-3">
                <span className="block text-sm font-semibold text-gold-highlight">{verse ? selectionReference(book.id, r.chapter as number, [verse]) : chapterLabel(book, r.chapter as number)}</span>
                {verse && (
                  <span className="mt-0.5 line-clamp-2 block font-serif text-[0.9375rem] text-muted-foreground">
                    <ScriptureText text={verseText(book.id, r.chapter as number, verse)} jesus={wordsOfJesus(book.id, r.chapter as number, verse)} />
                  </span>
                )}
              </Link>
              <ActionButton action={removeBookmarkAction} fields={{ id: r.id as string }} variant="ghost" size="icon" aria-label="Remove bookmark">
                <Trash2 aria-hidden />
              </ActionButton>
            </li>
          );
        })}
      </ul>
    ) : (
      <EmptyState title="No bookmarks yet" description="Tap a verse while reading, then Bookmark. Or bookmark a whole chapter from the top of the page." />
    );
  } else if (tab === "highlights") {
    const { data } = await supabase.from("bible_highlights").select("book_id, chapter, verse, color").eq("user_id", user.id).limit(2000);
    const rows = (data ?? []).sort((a, b) => order.get(a.book_id as string)! - order.get(b.book_id as string)! || (a.chapter as number) - (b.chapter as number) || (a.verse as number) - (b.verse as number));
    body = rows.length ? (
      <ul className="space-y-2">
        {rows.slice(0, LIMIT).map((r) => {
          const book = bookById(r.book_id as string)!;
          return (
            <li key={`${r.book_id}.${r.chapter}.${r.verse}`} className="flex items-start gap-1 rounded-2xl border border-border bg-card">
              <Link href={chapterHref(book, r.chapter as number, r.verse as number)} className="min-w-0 flex-1 p-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-gold-highlight">
                  <span className={cn("size-3 rounded-full", COLOR_DOT[r.color as string])} aria-hidden />
                  {selectionReference(book.id, r.chapter as number, [r.verse as number])}
                </span>
                <span className="mt-0.5 line-clamp-3 block font-serif text-[0.9375rem]">
                  <ScriptureText text={verseText(book.id, r.chapter as number, r.verse as number)} jesus={wordsOfJesus(book.id, r.chapter as number, r.verse as number)} />
                </span>
              </Link>
              <ActionButton action={removeHighlightAction} fields={{ bookId: book.id, chapter: String(r.chapter), verse: String(r.verse) }} variant="ghost" size="icon" aria-label="Remove highlight">
                <Trash2 aria-hidden />
              </ActionButton>
            </li>
          );
        })}
      </ul>
    ) : (
      <EmptyState title="No highlights yet" description="Tap a verse while reading and choose a colour." />
    );
  } else {
    const { data } = await supabase.from("bible_notes").select("id, book_id, chapter, verse_start, verse_end, body, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(LIMIT);
    const rows = data ?? [];
    body = rows.length ? (
      <ul className="space-y-2">
        {rows.map((r) => {
          const book = bookById(r.book_id as string)!;
          return (
            <li key={r.id as string} className="flex items-start gap-1 rounded-2xl border border-border bg-card">
              <Link href={chapterHref(book, r.chapter as number, r.verse_start as number)} className="min-w-0 flex-1 p-3">
                <span className="block text-sm font-semibold text-gold-highlight">{selectionReference(book.id, r.chapter as number, verseRange(r.verse_start as number, r.verse_end as number))}</span>
                <span className="mt-0.5 line-clamp-4 block whitespace-pre-wrap text-[0.9375rem]">{r.body as string}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{new Date(r.updated_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </Link>
              <ActionButton action={deleteBibleNoteFormAction} fields={{ id: r.id as string }} variant="ghost" size="icon" aria-label="Delete note" confirmMessage="Delete this note?" confirmLabel="Delete">
                <Trash2 aria-hidden />
              </ActionButton>
            </li>
          );
        })}
      </ul>
    ) : (
      <EmptyState title="No notes yet" description="Tap a verse while reading, then Note. Notes are private to you." />
    );
  }

  return (
    <div className="space-y-4">
      <BackLink href="/faith/bible">Bible</BackLink>
      <PageHeader title="My Bible" description="Your bookmarks, highlights and notes. Private to you." className="mb-2" />
      <nav aria-label="Saved" className="flex flex-wrap gap-2">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/faith/bible/saved?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", tab === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}
          >
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {body}
    </div>
  );
}
