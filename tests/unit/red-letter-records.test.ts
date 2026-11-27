import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RED_LETTER_REVIEW, SCAN_REVIEWED_NEW_TESTAMENT } from "@/data/bible/red-letter-review";
import { scanUnmarkedSpeech, segmentRows, segmentsCsv, verificationMarkdown, type RedLetterData } from "@/lib/bible/red-letter-records";
import { checkBookRedLetter } from "@/lib/bible/red-letter-verify";

const DIR = "public/bible/bsb";
const data = JSON.parse(readFileSync(`${DIR}/wj.json`, "utf8")) as RedLetterData;
const load = (id: string) => JSON.parse(readFileSync(`${DIR}/books/${id}.json`, "utf8")).chapters;
const { rows, continuationGaps } = segmentRows(data, load);
const scan = scanUnmarkedSpeech(data, load);

describe("red letter: every stretch checked against the BSB's own quotation marks", () => {
  it("all stretches are verified, and no speech of His is left open into an unmarked verse", () => {
    expect(rows).toHaveLength(data.totals.stretches);
    expect(rows.filter((r) => r.status !== "verified").map((r) => `${r.reference}: ${r.notes.join("; ")}`)).toEqual([]);
    expect(continuationGaps).toEqual([]);
  });

  // The checker must be able to fail: each of these is a wrong marking it has to catch.
  const one = (text: string, spans: [number, number][], next?: [number, string]) =>
    checkBookRedLetter([[[1, text], ...(next ? [next] : [])]], { 1: { 1: spans } });
  it("catches a stretch that starts in narration", () => {
    const t = "Jesus said, “Follow Me.”";
    expect(one(t, [[0, t.length]]).segments[0]!.status).toBe("review");
    expect(one(t, [[12, t.length]]).segments[0]!.status).toBe("verified");
  });
  it("catches a stretch that runs past the end of the quotation", () => {
    const t = "“Follow Me,” He said.";
    expect(one(t, [[0, t.length]]).segments[0]!.notes).toContain("runs past the end of a quotation in the BSB text");
  });
  it("catches a stretch that stops part-way through a quotation", () => {
    const t = "“Follow Me, and I will make you fishers of men.”";
    expect(one(t, [[0, 11]]).segments[0]!.notes).toContain("stops while the BSB quotation continues in the verse");
  });
  it("catches His speech left open into a verse that isn't marked", () => {
    const r = one("He said, “Blessed are the meek,", [[9, 31]], [2, "for they will inherit the earth.”"]);
    expect(r.continuationGaps).toEqual([{ chapter: 1, verse: 1 }]);
  });
  it("accepts quotations three levels deep and apostrophes", () => {
    const t = "“The son said, ‘Father, I have sinned; make me like one of your servants.”’ And the father’s heart was moved.";
    expect(one(t, [[0, t.length]]).segments[0]!.status).toBe("review"); // narration after the close
    const u = "“The son said, ‘Father, I have sinned.’ His father’s servants heard it.”";
    expect(one(u, [[0, u.length]]).segments[0]!.status).toBe("verified");
  });
});

describe("red letter: the records (docs/faith/red-letter)", () => {
  it("segments.csv is up to date: reference, offsets, basis, status and words for every stretch", () => {
    expect(readFileSync("docs/faith/red-letter/segments.csv", "utf8")).toBe(segmentsCsv(rows));
  });
  it("VERIFICATION.md is up to date", () => {
    expect(readFileSync("docs/faith/red-letter/VERIFICATION.md", "utf8")).toBe(
      verificationMarkdown(data, rows, continuationGaps, scan, RED_LETTER_REVIEW, SCAN_REVIEWED_NEW_TESTAMENT),
    );
  });
  it("each recorded stretch is exactly the words at its offsets", () => {
    for (const r of rows.slice(0, 400)) {
      const verse = (load(r.bookId)[r.chapter - 1] as [number, string][]).find(([v]) => v === r.verse)![1];
      expect(verse.slice(r.start, r.end)).toBe(r.text);
    }
  });
});

describe("red letter: the whole-Bible review", () => {
  it("scans all 66 books", () => {
    expect(scan.versesScanned).toBe(31086);
  });
  it("every New Testament verse the scan flags has been read and attributed (none is Jesus unmarked)", () => {
    expect([...scan.newTestament].sort()).toEqual(Object.keys(SCAN_REVIEWED_NEW_TESTAMENT).sort());
  });
  it("Old Testament appearances are listed for review, never marked", () => {
    expect(scan.oldTestament.length).toBeGreaterThan(20);
    expect(Object.keys(data.books).some((b) => ["GEN", "EXO", "JOS", "JDG", "ZEC", "PSA", "ISA"].includes(b))).toBe(false);
    expect(RED_LETTER_REVIEW.find((i) => i.topic === "old testament")).toMatchObject({ shown: "plain", status: "awaiting review" });
  });
  it("the register covers the disputed passages the owner named", () => {
    const refs = RED_LETTER_REVIEW.map((i) => i.reference).join(" | ");
    for (const r of ["John 3:16–21", "1 Timothy 5:18", "Revelation 1:8", "Revelation 21:5–8", "Revelation 22:14–15", "Hebrews 2:12–13", "Hebrews 10:5–9", "Acts 10:13"]) expect(refs).toContain(r);
  });
  it("nothing awaiting review was added by the app: what's shown is the publisher's marking", () => {
    const red = (id: string, c: number, v: number) => Boolean(data.books[id]?.[c]?.[v]);
    expect(red("1TI", 5, 18)).toBe(false);
    expect(red("REV", 1, 8)).toBe(false);
    expect(red("HEB", 2, 12)).toBe(false);
    expect(red("JHN", 3, 16) && red("JHN", 3, 21)).toBe(true);
  });
});
