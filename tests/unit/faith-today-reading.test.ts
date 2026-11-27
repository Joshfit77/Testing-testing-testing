import { bookById } from "@/lib/bible/books";
import { refsIncludeChapter, todayReadingLink } from "@/lib/faith/today-reading";

const MAT = bookById("MAT")!;
const JHN = bookById("JHN")!;

const journey = (over: Partial<{ day: number | null; reading: boolean }> = {}) => ({
  day: 21,
  reading: false,
  todayPlan: { label: "Matthew 24:26–51", refs: [{ bookId: "MAT", chapter: 24, verseStart: 26, verseEnd: 51 }] },
  ...over,
});
const lastOpened = { book: JHN, chapter: 3, verse: null };

describe("todayReadingLink (F1)", () => {
  it("opens today's journey passage while today's reading is not marked complete", () => {
    const link = todayReadingLink(journey(), lastOpened);
    expect(link).toMatchObject({ kind: "journey", title: "Today's reading", detail: "Matthew 24:26–51", label: "Today's reading · Matthew 24:26–51" });
    expect(link.href).toBe(`/faith/bible/${MAT.slug}/24?v=26#v26`);
  });

  it("falls back to the last chapter opened once today's reading is done, or before Day 1", () => {
    for (const j of [journey({ reading: true }), journey({ day: null }), null]) {
      const link = todayReadingLink(j, lastOpened);
      expect(link).toMatchObject({ kind: "continue", label: "Continue reading · John 3" });
      expect(link.href).toBe(`/faith/bible/${JHN.slug}/3`);
    }
    expect(todayReadingLink(null, { book: JHN, chapter: 3, verse: 16 })).toMatchObject({ label: "Continue reading · John 3:16", href: `/faith/bible/${JHN.slug}/3?v=16#v16` });
  });

  it("sends a brand-new member to John 1, not the 66-book index", () => {
    const link = todayReadingLink(null, null);
    expect(link).toMatchObject({ kind: "start", title: "Read the Bible", label: "Read the Bible · Start with John 1" });
    expect(link.href).toBe(`/faith/bible/${JHN.slug}/1`);
    expect(todayReadingLink(journey({ reading: true }), null).kind).toBe("start");
  });
});

describe("refsIncludeChapter (F3)", () => {
  it("matches the chapters a day's references cover, including ranges across chapters", () => {
    const refs = [{ bookId: "MAT", chapter: 24, verseStart: 26 }, { bookId: "GEN", chapter: 1, chapterEnd: 3 }];
    expect(refsIncludeChapter(refs, "MAT", 24)).toBe(true);
    expect(refsIncludeChapter(refs, "MAT", 25)).toBe(false);
    expect(refsIncludeChapter(refs, "GEN", 2)).toBe(true);
    expect(refsIncludeChapter(refs, "GEN", 4)).toBe(false);
    expect(refsIncludeChapter(refs, "JHN", 1)).toBe(false);
    expect(refsIncludeChapter([], "MAT", 24)).toBe(false);
  });
});
