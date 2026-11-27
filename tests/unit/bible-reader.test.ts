import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS, bookBySlug, chapterHref, findBook, nextChapter, previousChapter, TOTAL_CHAPTERS } from "@/lib/bible/books";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { getChapter, getPassage, passageText, searchBible, versesWithoutText } from "@/server/bible/text";
import passages from "@/data/bsb-passages.json";

describe("book lookups", () => {
  it("66 books, 1,189 chapters; names, abbreviations and slugs resolve", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(TOTAL_CHAPTERS).toBe(1189);
    expect(findBook("1 Cor")?.id).toBe("1CO");
    expect(findBook("1cor")?.id).toBe("1CO");
    expect(findBook("First Corinthians")?.id).toBe("1CO");
    expect(findBook("II Kings")?.id).toBe("2KI");
    expect(findBook("Ps")?.id).toBe("PSA");
    expect(findBook("Psalm")?.id).toBe("PSA");
    expect(findBook("Song of Songs")?.id).toBe("SNG");
    expect(findBook("jn")?.id).toBe("JHN");
    expect(findBook("Phil")?.id).toBe("PHP");
    expect(findBook("Philemon")?.id).toBe("PHM");
    expect(findBook("Hezekiah")).toBeUndefined();
    expect(bookBySlug("song-of-solomon")?.id).toBe("SNG");
    expect(chapterHref("1CO", 13, 4)).toBe("/faith/bible/1-corinthians/13?v=4#v4");
  });

  it("previous / next chapter cross book boundaries and stop at the ends", () => {
    expect(nextChapter("GEN", 50)).toMatchObject({ book: { id: "EXO" }, chapter: 1 });
    expect(previousChapter("EXO", 1)).toMatchObject({ book: { id: "GEN" }, chapter: 50 });
    expect(nextChapter("MAL", 4)).toMatchObject({ book: { id: "MAT" }, chapter: 1 });
    expect(previousChapter("GEN", 1)).toBeNull();
    expect(nextChapter("REV", 22)).toBeNull();
  });
});

describe("references", () => {
  const cases: [string, string | null][] = [
    ["John 3:16", "John 3:16"],
    ["jn 3:16-18", "John 3:16–18"],
    ["1 Cor 13:4–7", "1 Corinthians 13:4–7"],
    ["1cor13:4", "1 Corinthians 13:4"],
    ["Ps 23", "Psalm 23"],
    ["psalms 119:105", "Psalm 119:105"],
    ["Genesis 1:1–2:3", "Genesis 1:1–2:3"],
    ["Gen 1-3", "Genesis 1–3"],
    ["Jude 3", "Jude 3"],
    ["Jude 3-5", "Jude 3–5"],
    ["Romans", "Romans 1"],
    ["Song of Songs 2:4", "Song of Solomon 2:4"],
    ["Rev 22:21", "Revelation 22:21"],
    ["Genesis 51", null],
    ["Hezekiah 1:1", null],
    ["John 3:18-16", null],
    ["", null],
  ];
  it.each(cases)("%s → %s", (input, expected) => {
    const r = parseReference(input);
    expect(r ? formatReference(r) : null).toBe(expected);
  });
});

describe("the verified text on the server", () => {
  it("chapters and passages come from the dataset; nonexistent chapters return null", () => {
    expect(getChapter("GEN", 1)?.[0]?.[0]).toBe(1);
    expect(getChapter("PSA", 119)?.length).toBe(176);
    expect(getChapter("GEN", 51)).toBeNull();
    expect(getChapter("XXX", 1)).toBeNull();
    // Agrees with the passages the app already quotes (extracted independently).
    const p = passages.passages as Record<string, string>;
    expect(passageText(parseReference("Matthew 7:13–14")!)).toBe(p["Matthew 7:13–14"]);
    expect(passageText(parseReference("Philippians 4:13")!)).toBe(p["Philippians 4:13"]);
    // A range across chapters.
    const gen = getPassage(parseReference("Genesis 1:31–2:3")!);
    expect(gen.map((v) => `${v.chapter}:${v.verse}`)).toEqual(["1:31", "2:1", "2:2", "2:3"]);
    expect(getPassage(parseReference("Genesis 1–2")!).length).toBe(getChapter("GEN", 1)!.length + getChapter("GEN", 2)!.length);
  });

  it("footnoted verses have no text and are reported, never filled in", () => {
    expect(versesWithoutText("MAT", 17)).toEqual([21]);
    expect(getChapter("MAT", 17)!.some(([v]) => v === 21)).toBe(false);
    expect(passageText(parseReference("Matthew 17:21")!)).toBeNull();
    expect(versesWithoutText("JHN", 3)).toEqual([]);
  });
});

describe("keyword search", () => {
  it("finds whole words in canonical order, counts all matches, filters by testament and book", () => {
    const r = searchBible("narrow gate");
    expect(r.total).toBeGreaterThan(0);
    expect(r.hits.some((h) => h.reference === "Matthew 7:13")).toBe(true);
    expect(r.hits.every((h) => /narrow/i.test(h.text) && /gate/i.test(h.text))).toBe(true);
    // Canonical order.
    const order = r.hits.map((h) => BIBLE_BOOKS.findIndex((b) => b.id === h.bookId));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const nt = searchBible("love", { testament: "NT", limit: 200 });
    expect(nt.hits.every((h) => BIBLE_BOOKS.find((b) => b.id === h.bookId)!.testament === "NT")).toBe(true);
    const john = searchBible("love", { bookId: "1JN" });
    expect(john.total).toBeGreaterThan(10);
    expect(john.hits.every((h) => h.bookId === "1JN")).toBe(true);
  });

  it("phrases in quotes must appear together; whole words only; limits and paging", () => {
    const phrase = searchBible('"in the beginning"');
    expect(phrase.hits[0]?.reference).toBe("Genesis 1:1");
    expect(phrase.hits.every((h) => /in the beginning/i.test(h.text))).toBe(true);
    // "love" doesn't match "beloved".
    expect(searchBible("love", { bookId: "SNG", limit: 200 }).hits.every((h) => /\blove\b/i.test(h.text))).toBe(true);
    const page1 = searchBible("Lord", { limit: 10 });
    const page2 = searchBible("Lord", { limit: 10, offset: 10 });
    expect(page1.hits).toHaveLength(10);
    expect(page2.hits[0]!.reference).not.toBe(page1.hits[0]!.reference);
    expect(page1.total).toBe(page2.total);
    expect(searchBible("a").total).toBe(0); // too short to search
    expect(searchBible("   ").total).toBe(0);
  });
});
