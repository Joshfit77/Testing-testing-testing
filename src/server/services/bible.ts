import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bookById, type BibleBook } from "@/lib/bible/books";
import type { ReaderNote } from "@/components/bible/chapter-reader";
import type { HighlightColor } from "@/server/actions/bible";

/** The member's own highlights, bookmarks and notes for one chapter (RLS plus an explicit user filter). */
export async function loadChapterAnnotations(supabase: SupabaseClient, userId: string, bookId: string, chapter: number) {
  const [h, b, n] = await Promise.all([
    supabase.from("bible_highlights").select("verse, color").eq("user_id", userId).eq("book_id", bookId).eq("chapter", chapter),
    supabase.from("bible_bookmarks").select("verse").eq("user_id", userId).eq("book_id", bookId).eq("chapter", chapter),
    supabase.from("bible_notes").select("id, verse_start, verse_end, body, updated_at").eq("user_id", userId).eq("book_id", bookId).eq("chapter", chapter).order("verse_start"),
  ]);
  const highlights: Record<number, HighlightColor> = {};
  for (const r of h.data ?? []) highlights[r.verse as number] = r.color as HighlightColor;
  const marks = (b.data ?? []).map((r) => r.verse as number | null);
  const notes: ReaderNote[] = (n.data ?? []).map((r) => ({ id: r.id as string, verseStart: r.verse_start as number, verseEnd: r.verse_end as number, body: r.body as string, updatedAt: r.updated_at as string }));
  return { highlights, bookmarks: marks.filter((v): v is number => v !== null), chapterBookmarked: marks.includes(null), notes };
}

export interface ReadingPosition {
  book: BibleBook;
  chapter: number;
  verse: number | null;
  fontScale: number;
  updatedAt: string;
}

export async function loadReadingState(supabase: SupabaseClient, userId: string): Promise<ReadingPosition | null> {
  const { data } = await supabase.from("bible_reading_state").select("book_id, chapter, verse, font_scale, updated_at").eq("user_id", userId).maybeSingle();
  const book = data ? bookById(data.book_id as string) : undefined;
  if (!data || !book) return null;
  return { book, chapter: data.chapter as number, verse: (data.verse as number | null) ?? null, fontScale: Number(data.font_scale), updatedAt: data.updated_at as string };
}
