import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import { CHRONOLOGICAL, JOURNEY_DURATIONS, MIN_VERSES_PER_DAY, PLAN_KINDS, planTracks, TOPICS, type PlanSpec } from "@/lib/bible/plans";
import { parseReference } from "@/lib/bible/reference";
import { bsbVerseSource, journeyPlan, planOptions } from "@/server/bible/plans";
import { getChapter, getPassage } from "@/server/bible/text";

/** Expand a day's references to "BOOK c:v" keys using the verified text. */
function expand(refs: Parameters<typeof getPassage>[0][]): string[] {
  return refs.flatMap((r) => getPassage(r).map((v) => `${v.bookId} ${v.chapter}:${v.verse}`));
}

const SPECS: PlanSpec[] = [
  ...PLAN_KINDS.filter((k) => k !== "book" && k !== "topic").map((kind) => ({ kind })),
  { kind: "book", param: "JHN" },
  { kind: "book", param: "PSA" },
  { kind: "book", param: "ROM" },
  ...Object.keys(TOPICS).map((param) => ({ kind: "topic" as const, param })),
];

describe("reading plans", () => {
  it.each(SPECS.flatMap((s) => JOURNEY_DURATIONS.map((d) => [s, d] as const)))("%o over %i days: complete, in order, one reading per day", (spec, days) => {
    const plan = journeyPlan(spec, days);
    const tracks = planTracks(spec, bsbVerseSource)!;
    expect(tracks).not.toBeNull();
    const feasible = tracks.every((t) => t.length >= days * MIN_VERSES_PER_DAY);
    if (!feasible) {
      expect(plan).toBeNull();
      return;
    }
    expect(plan).not.toBeNull();
    expect(plan!.schedule).toHaveLength(days);
    expect(plan!.schedule.map((d) => d.day)).toEqual(Array.from({ length: days }, (_, i) => i + 1));
    for (const d of plan!.schedule) {
      expect(d.refs.length).toBeGreaterThan(0);
      expect(d.words).toBeGreaterThan(0);
      expect(d.minutes).toBeGreaterThan(0);
    }
    // Every verse of every track, exactly once, in order.
    const covered = plan!.schedule.flatMap((d) => expand(d.refs));
    const expected = spec.kind === "guided" ? null : tracks[0]!.map((v) => `${v.bookId} ${v.chapter}:${v.verse}`);
    if (expected) expect(covered).toEqual(expected);
    else {
      // Guided: three tracks read side by side; together they cover each track completely.
      const all = tracks.flat().map((v) => `${v.bookId} ${v.chapter}:${v.verse}`);
      expect([...covered].sort()).toEqual([...all].sort());
      expect(new Set(covered).size).toBe(covered.length);
    }
  });

  it("whole-Bible plans cover all 1,189 chapters; with at least one chapter per day, days end at chapter ends", () => {
    for (const days of JOURNEY_DURATIONS) {
      const plan = journeyPlan({ kind: "full_bible" }, days)!;
      const keys = plan.schedule.flatMap((d) => expand(d.refs));
      expect(new Set(keys.map((k) => k.split(":")[0])).size).toBe(1189);
      expect(keys.length).toBe(31086);
      // Whole chapters only: no day's reading names verses.
      expect(plan.schedule.every((d) => d.refs.every((r) => r.verseStart === undefined))).toBe(true);
    }
  });

  it("the daily load scales with the duration: 30 days is far more per day than 365 (shown before enrolling)", () => {
    const opts = planOptions({ kind: "full_bible" });
    const d30 = opts.find((o) => o.days === 30)!;
    const d365 = opts.find((o) => o.days === 365)!;
    expect(d30.avgChapters).toBeGreaterThan(35);
    expect(d30.avgMinutes).toBeGreaterThan(100);
    expect(d365.avgChapters).toBeGreaterThan(3);
    expect(d365.avgChapters).toBeLessThan(4);
    expect(d365.avgMinutes).toBeLessThan(15);
    // Days are balanced: no day is more than ~3x the average (long chapters such as Psalm 119 are the outliers).
    const p = journeyPlan({ kind: "full_bible" }, 365)!;
    expect(p.maxMinutes).toBeLessThan(p.avgMinutes * 4);
  });

  it("short plans split chapters at verse boundaries (the Gospels over a year)", () => {
    const p = journeyPlan({ kind: "gospels" }, 365)!;
    expect(p.schedule.some((d) => d.refs.some((r) => r.verseStart !== undefined))).toBe(true);
    expect(p.schedule[0]!.label).toMatch(/^Matthew 1/);
    expect(p.schedule.at(-1)!.label).toMatch(/^John 21/);
  });

  it("a book too short for the duration is not offered (Philemon has 25 verses)", () => {
    expect(journeyPlan({ kind: "book", param: "PHM" }, 30)).toBeNull();
    expect(planOptions({ kind: "book", param: "PHM" })).toEqual([]);
    expect(planOptions({ kind: "book", param: "PSA" }).map((o) => o.days)).toEqual([30, 60, 90, 180, 365]);
    expect(journeyPlan({ kind: "book", param: "XYZ" }, 30)).toBeNull();
    expect(journeyPlan({ kind: "full_bible" }, 45)).toBeNull();
  });

  it("the chronological order lists every chapter of all 66 books exactly once", () => {
    const seen = new Map<string, number>();
    for (const [b, a, z] of CHRONOLOGICAL) for (let c = a; c <= z; c++) seen.set(`${b} ${c}`, (seen.get(`${b} ${c}`) ?? 0) + 1);
    const all = BIBLE_BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => `${b.id} ${i + 1}`));
    expect([...seen.keys()].sort()).toEqual([...all].sort());
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
  });

  it("every topic passage is a real BSB passage", () => {
    const bad: string[] = [];
    for (const [key, t] of Object.entries(TOPICS)) {
      for (const p of t.passages) {
        const r = parseReference(p);
        if (!r || !getPassage(r).length) bad.push(`${key}: ${p}`);
        // Verse ranges inside the chapter's real length.
        if (r?.verseEnd && r.chapterEnd === undefined && r.verseEnd > getChapter(r.bookId, r.chapter)!.at(-1)![0]) bad.push(`${key}: ${p} (past the chapter end)`);
      }
    }
    expect(bad).toEqual([]);
  });
});
