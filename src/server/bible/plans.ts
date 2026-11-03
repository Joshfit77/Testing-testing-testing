import "server-only";
import { BIBLE_BOOKS, bookById } from "@/lib/bible/books";
import { buildJourneyPlan, JOURNEY_DURATIONS, PLAN_KINDS, TOPICS, type JourneyPlan, type PlanKind, type PlanSpec, type VerseSource } from "@/lib/bible/plans";
import { chapterWords, getChapter } from "./text";

/** Plans over the verified BSB text, cached per (plan, duration) for the life of the server process. */
export const bsbVerseSource: VerseSource = {
  verses(bookId, chapter) {
    return (getChapter(bookId, chapter) ?? []).map(([verse, text]) => ({ verse, words: text.match(/\S+/g)?.length ?? 0 }));
  },
};

const cache = new Map<string, JourneyPlan | null>();

export function journeyPlan(spec: PlanSpec, days: number): JourneyPlan | null {
  if (!(PLAN_KINDS as readonly string[]).includes(spec.kind) || !(JOURNEY_DURATIONS as readonly number[]).includes(days)) return null;
  const key = `${spec.kind}:${spec.param ?? ""}:${days}`;
  if (!cache.has(key)) cache.set(key, buildJourneyPlan(spec, days, bsbVerseSource, chapterWords));
  return cache.get(key) ?? null;
}

/** Is this a plan a member can choose (a real book or topic)? */
export function validPlanSpec(kind: string, param: string | null | undefined): PlanSpec | null {
  if (!(PLAN_KINDS as readonly string[]).includes(kind)) return null;
  const k = kind as PlanKind;
  if (k === "book") return param && bookById(param) ? { kind: k, param: bookById(param)!.id } : null;
  if (k === "topic") return param && TOPICS[param] ? { kind: k, param } : null;
  return { kind: k, param: null };
}

/** For the chooser: each duration's daily load, or null where the plan is too short for it. */
export function planOptions(spec: PlanSpec): { days: number; avgMinutes: number; maxMinutes: number; avgChapters: number }[] {
  return JOURNEY_DURATIONS.map((d) => {
    const p = journeyPlan(spec, d);
    return p ? { days: d, avgMinutes: p.avgMinutes, maxMinutes: p.maxMinutes, avgChapters: p.avgChapters } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);
}

export const BOOK_CHOICES = BIBLE_BOOKS;
