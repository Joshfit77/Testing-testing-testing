"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { isValidChapter } from "@/lib/bible/books";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { reviewOutcome, type ReviewResult } from "@/lib/faith/memory";
import { isoDateInTz } from "@/lib/domain/dates";
import { getProfile, requireUser } from "@/server/auth";
import { lastVerse } from "@/server/bible/text";
import { logError } from "@/server/log";

/*
 * Bible reader actions: reading position, reading history, highlights, bookmarks, notes and font size. Every write is
 * the signed-in member's own (RLS on each table plus an explicit user_id filter), and every reference is checked
 * against the verified BSB text before it is stored.
 */

export type BibleActionResult = { ok: true } | { ok: false; error: string };

const HIGHLIGHT_COLORS = ["gold", "sage", "sky", "rose"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

const chapterSchema = z.object({ bookId: z.string().regex(/^[1-3A-Z][A-Z0-9]{2}$/), chapter: z.number().int().min(1).max(150) }).refine((r) => isValidChapter(r.bookId, r.chapter));

/** A verse number that exists in this chapter. */
function validVerse(bookId: string, chapter: number, verse: number): boolean {
  return Number.isInteger(verse) && verse >= 1 && verse <= lastVerse(bookId, chapter);
}

const fail = (error: string): BibleActionResult => ({ ok: false, error });

/** Remember where the member is reading and add the chapter to today's reading history. Called after a chapter has been open a moment. */
export async function recordChapterViewAction(bookId: string, chapter: number, verse?: number | null): Promise<BibleActionResult> {
  const user = await requireUser();
  const ref = chapterSchema.safeParse({ bookId, chapter });
  if (!ref.success) return fail("Unknown chapter.");
  const v = verse != null && validVerse(bookId, chapter, verse) ? verse : null;
  const profile = await getProfile(user.id);
  const today = isoDateInTz(new Date(), profile?.timezone ?? "UTC");
  const supabase = await getServerSupabase();
  const now = new Date().toISOString();
  const [state, history] = await Promise.all([
    supabase.from("bible_reading_state").upsert({ user_id: user.id, book_id: bookId, chapter, verse: v, updated_at: now }, { onConflict: "user_id" }),
    supabase.from("bible_reading_history").upsert({ user_id: user.id, book_id: bookId, chapter, read_on: today, read_at: now }, { onConflict: "user_id,book_id,chapter,read_on" }),
  ]);
  if (state.error || history.error) {
    logError("bible.view", state.error ?? history.error);
    return fail("Couldn't save your place.");
  }
  return { ok: true };
}

/** Reading text size (0.8–1.8). Stored with the reading position. */
export async function setFontScaleAction(scale: number, bookId: string, chapter: number): Promise<BibleActionResult> {
  const user = await requireUser();
  const ref = chapterSchema.safeParse({ bookId, chapter });
  const s = z.number().min(0.8).max(1.8).safeParse(scale);
  if (!ref.success || !s.success) return fail("Invalid text size.");
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("bible_reading_state")
    .upsert({ user_id: user.id, book_id: bookId, chapter, font_scale: Math.round(s.data * 100) / 100, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    logError("bible.font", error);
    return fail("Couldn't save the text size.");
  }
  return { ok: true };
}

/** Highlight verses in one colour, or remove their highlight (color null). */
export async function setHighlightAction(bookId: string, chapter: number, verses: number[], color: HighlightColor | null): Promise<BibleActionResult> {
  const user = await requireUser();
  const ref = chapterSchema.safeParse({ bookId, chapter });
  if (!ref.success || !Array.isArray(verses) || verses.length === 0 || verses.length > 176) return fail("Choose verses to highlight.");
  if (!verses.every((v) => validVerse(bookId, chapter, v))) return fail("Unknown verse.");
  if (color !== null && !HIGHLIGHT_COLORS.includes(color)) return fail("Unknown colour.");
  const supabase = await getServerSupabase();
  const unique = [...new Set(verses)];
  const { error } =
    color === null
      ? await supabase.from("bible_highlights").delete().eq("user_id", user.id).eq("book_id", bookId).eq("chapter", chapter).in("verse", unique)
      : await supabase
          .from("bible_highlights")
          .upsert(
            unique.map((verse) => ({ user_id: user.id, book_id: bookId, chapter, verse, color, updated_at: new Date().toISOString() })),
            { onConflict: "user_id,book_id,chapter,verse" },
          );
  if (error) {
    logError("bible.highlight", error);
    return fail("Couldn't save the highlight.");
  }
  return { ok: true };
}

/** Bookmark a verse (or the whole chapter when verse is null); a second call removes it. */
export async function toggleBookmarkAction(bookId: string, chapter: number, verse: number | null): Promise<BibleActionResult & { bookmarked?: boolean }> {
  const user = await requireUser();
  const ref = chapterSchema.safeParse({ bookId, chapter });
  if (!ref.success || (verse !== null && !validVerse(bookId, chapter, verse))) return fail("Unknown verse.");
  const supabase = await getServerSupabase();
  let q = supabase.from("bible_bookmarks").select("id").eq("user_id", user.id).eq("book_id", bookId).eq("chapter", chapter);
  q = verse === null ? q.is("verse", null) : q.eq("verse", verse);
  const { data: existing, error: readError } = await q.limit(1);
  if (readError) {
    logError("bible.bookmark", readError);
    return fail("Couldn't update the bookmark.");
  }
  if (existing?.length) {
    const { error } = await supabase.from("bible_bookmarks").delete().eq("id", existing[0]!.id).eq("user_id", user.id);
    if (error) return fail("Couldn't remove the bookmark.");
    return { ok: true, bookmarked: false };
  }
  const { error } = await supabase.from("bible_bookmarks").insert({ user_id: user.id, book_id: bookId, chapter, verse });
  // A unique violation means a second tap raced the first: it is bookmarked either way.
  if (error && error.code !== "23505") {
    logError("bible.bookmark", error);
    return fail("Couldn't save the bookmark.");
  }
  return { ok: true, bookmarked: true };
}

export async function removeBookmarkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("bible_bookmarks").delete().eq("id", id.data).eq("user_id", user.id);
}

export async function removeHighlightAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const bookId = String(formData.get("bookId") ?? "");
  const chapter = Number(formData.get("chapter"));
  const verse = Number(formData.get("verse"));
  if (!chapterSchema.safeParse({ bookId, chapter }).success || !validVerse(bookId, chapter, verse)) return;
  const supabase = await getServerSupabase();
  await supabase.from("bible_highlights").delete().eq("user_id", user.id).eq("book_id", bookId).eq("chapter", chapter).eq("verse", verse);
}

const noteSchema = z.object({
  id: z.string().uuid().nullable(),
  bookId: z.string(),
  chapter: z.number().int(),
  verseStart: z.number().int(),
  verseEnd: z.number().int(),
  body: z.string().trim().min(1, "Write something first.").max(10000, "Notes can be up to 10,000 characters."),
});

/** Create or edit a private note on a verse or a run of verses. */
export async function saveBibleNoteAction(input: z.input<typeof noteSchema>): Promise<BibleActionResult & { id?: string }> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid note.");
  const n = parsed.data;
  if (!chapterSchema.safeParse({ bookId: n.bookId, chapter: n.chapter }).success || !validVerse(n.bookId, n.chapter, n.verseStart) || !validVerse(n.bookId, n.chapter, n.verseEnd) || n.verseEnd < n.verseStart) {
    return fail("Unknown verse.");
  }
  const supabase = await getServerSupabase();
  const row = { book_id: n.bookId, chapter: n.chapter, verse_start: n.verseStart, verse_end: n.verseEnd, body: n.body, updated_at: new Date().toISOString() };
  if (n.id) {
    const { data, error } = await supabase.from("bible_notes").update(row).eq("id", n.id).eq("user_id", user.id).select("id");
    if (error || !data?.length) {
      if (error) logError("bible.note", error);
      return fail("Couldn't save your note.");
    }
    return { ok: true, id: n.id };
  }
  const { data, error } = await supabase.from("bible_notes").insert({ ...row, user_id: user.id }).select("id").single();
  if (error || !data) {
    if (error) logError("bible.note", error);
    return fail("Couldn't save your note.");
  }
  return { ok: true, id: data.id as string };
}

export async function deleteBibleNoteAction(id: string): Promise<BibleActionResult> {
  const user = await requireUser();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return fail("Unknown note.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("bible_notes").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return fail("Couldn't delete the note.");
  return { ok: true };
}

export async function deleteBibleNoteFormAction(formData: FormData): Promise<void> {
  await deleteBibleNoteAction(String(formData.get("id") ?? ""));
}

/** Save verses to Scripture memory (a run of up to 30 verses in one chapter). */
export async function addMemoryVerseAction(bookId: string, chapter: number, verseStart: number, verseEnd: number): Promise<BibleActionResult> {
  const user = await requireUser();
  if (!chapterSchema.safeParse({ bookId, chapter }).success || !validVerse(bookId, chapter, verseStart) || !validVerse(bookId, chapter, verseEnd) || verseEnd < verseStart || verseEnd - verseStart >= 30) {
    return fail("Choose up to 30 verses in a row.");
  }
  const supabase = await getServerSupabase();
  const profile = await getProfile(user.id);
  const today = isoDateInTz(new Date(), profile?.timezone ?? "UTC");
  const { error } = await supabase
    .from("scripture_memory")
    .upsert({ user_id: user.id, book_id: bookId, chapter, verse_start: verseStart, verse_end: verseEnd, next_review_on: today }, { onConflict: "user_id,book_id,chapter,verse_start,verse_end", ignoreDuplicates: true });
  if (error) {
    logError("bible.memory", error);
    return fail("Couldn't save the verse.");
  }
  return { ok: true };
}

/** Save a passage to memory by typing its reference (one chapter, up to 30 verses). */
export async function addMemoryByReferenceAction(_prev: { ok: boolean; message?: string }, formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const raw = String(formData.get("reference") ?? "").slice(0, 60);
  const ref = parseReference(raw);
  if (!ref || ref.chapterEnd !== undefined) return { ok: false, message: "Type a reference in one chapter, like Romans 8:28 or Psalm 23:1–3." };
  const start = ref.verseStart ?? 1;
  const end = ref.verseEnd ?? ref.verseStart ?? Math.min(lastVerse(ref.bookId, ref.chapter), start + 29);
  const r = await addMemoryVerseAction(ref.bookId, ref.chapter, start, end);
  return r.ok ? { ok: true, message: `${formatReference({ ...ref, verseStart: start, verseEnd: end === start ? undefined : end })} saved.` } : { ok: false, message: r.error };
}

/** Record one practice of a memory verse; the level and next review follow src/lib/faith/memory.ts. */
export async function reviewMemoryAction(id: string, result: ReviewResult): Promise<BibleActionResult & { level?: number; status?: string; nextReviewOn?: string }> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success || (result !== "remembered" && result !== "struggled")) return fail("Invalid review.");
  const supabase = await getServerSupabase();
  const { data: row } = await supabase.from("scripture_memory").select("level, status, review_count").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) return fail("Verse not found.");
  const profile = await getProfile(user.id);
  const today = isoDateInTz(new Date(), profile?.timezone ?? "UTC");
  const out = reviewOutcome(row.level as number, result, today, row.status as "learning" | "memorized");
  const { error } = await supabase
    .from("scripture_memory")
    .update({ level: out.level, status: out.status, next_review_on: out.nextReviewOn, review_count: (row.review_count as number) + 1, last_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    logError("bible.memory.review", error);
    return fail("Couldn't save your practice.");
  }
  return { ok: true, ...out };
}

export async function deleteMemoryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("scripture_memory").delete().eq("id", id.data).eq("user_id", user.id);
}
