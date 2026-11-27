/**
 * "What should I read now?" — one answer for the Faith tab and Home. Pure; client and server.
 *
 * 1. An active journey whose reading for today isn't marked complete: today's passage.
 * 2. Otherwise, the chapter the member last opened.
 * 3. Otherwise (a brand-new member): John 1, a gentle place to begin, rather than the 66-book index.
 */
import { chapterHref, chapterLabel, type BibleBook } from "@/lib/bible/books";
import type { ScriptureRef } from "@/lib/bible/reference";

/** The parts of a journey view this needs (JourneyView from src/server/services/journeys.ts fits). */
export interface TodayJourneyLike {
  /** Today's schedule day, or null before Day 1. */
  day: number | null;
  todayPlan: { refs: ScriptureRef[]; label: string } | null;
  /** Today's reading is already marked complete. */
  reading: boolean;
}

/** The parts of the saved reading position this needs (ReadingPosition from src/server/services/bible.ts fits). */
export interface ReadingPositionLike {
  book: BibleBook;
  chapter: number;
  verse: number | null;
}

export interface TodayReadingLink {
  href: string;
  /** One line, e.g. "Today's reading · Matthew 24:26–51", "Continue reading · John 3", "Read the Bible · Start with John 1". */
  label: string;
  /** The first half of `label`, for layouts that show it on its own line. */
  title: string;
  /** The second half of `label`. */
  detail: string;
  kind: "journey" | "continue" | "start";
}

/** Where a brand-new member starts: the Gospel of John. */
export const START_READING = { bookId: "JHN", chapter: 1, label: "John 1" } as const;

export function todayReadingLink(journey: TodayJourneyLike | null | undefined, reading: ReadingPositionLike | null | undefined): TodayReadingLink {
  const first = journey?.day && journey.todayPlan && !journey.reading ? journey.todayPlan.refs[0] : undefined;
  if (journey?.todayPlan && first) {
    const title = "Today's reading";
    const detail = journey.todayPlan.label;
    return { href: chapterHref(first.bookId, first.chapter, first.verseStart), label: `${title} · ${detail}`, title, detail, kind: "journey" };
  }
  if (reading) {
    const title = "Continue reading";
    const detail = `${chapterLabel(reading.book, reading.chapter)}${reading.verse ? `:${reading.verse}` : ""}`;
    return { href: chapterHref(reading.book, reading.chapter, reading.verse ?? undefined), label: `${title} · ${detail}`, title, detail, kind: "continue" };
  }
  const title = "Read the Bible";
  const detail = `Start with ${START_READING.label}`;
  return { href: chapterHref(START_READING.bookId, START_READING.chapter), label: `${title} · ${detail}`, title, detail, kind: "start" };
}

/** Whether `chapter` of `bookId` is part of any of `refs` (a ref may span chapters with `chapterEnd`). */
export function refsIncludeChapter(refs: readonly ScriptureRef[], bookId: string, chapter: number): boolean {
  return refs.some((r) => r.bookId === bookId && chapter >= r.chapter && chapter <= (r.chapterEnd ?? r.chapter));
}
