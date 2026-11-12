import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinVerseParts, redLetterParts, redLetterWordFlags, sliceParts, type TextPart } from "@/lib/bible/red-letter";
import { maskWords } from "@/lib/faith/memory";

const DIR = "public/bible/bsb";
const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8")) as { contentSha256: string; books: { id: string }[] };
const wj = JSON.parse(readFileSync(`${DIR}/wj.json`, "utf8")) as {
  source: string;
  sourceSha256: string;
  bibleContentSha256: string;
  totals: { verses: number; stretches: number };
  books: Record<string, Record<string, Record<string, [number, number][]>>>;
};
const books = new Map<string, { chapters: [number, string][][] }>();
const verse = (id: string, c: number, v: number) => {
  if (!books.has(id)) books.set(id, JSON.parse(readFileSync(`${DIR}/books/${id}.json`, "utf8")));
  return books.get(id)!.chapters[c - 1]!.find(([n]) => n === v)![1];
};
/** The verse with His words in ⟦…⟧, for readable expectations. */
const marked = (id: string, c: number, v: number) => {
  const t = verse(id, c, v);
  return redLetterParts(t, wj.books[id]?.[c]?.[v])
    .map((p) => (p.jesus ? `⟦${p.text}⟧` : p.text))
    .join("");
};
const joined = (parts: TextPart[]) => parts.map((p) => p.text).join("");

describe("red letter: splitting text", () => {
  it("splits at the spans and never loses or changes a character", () => {
    const t = "Jesus said, “Come and see.” And they went.";
    const parts = redLetterParts(t, [[12, 27]]);
    expect(parts).toEqual([
      { text: "Jesus said, ", jesus: false },
      { text: "“Come and see.”", jesus: true },
      { text: " And they went.", jesus: false },
    ]);
    expect(joined(parts)).toBe(t);
  });

  it("ignores spans that overlap, run backwards or fall outside the text, leaving the words plain", () => {
    const t = "abcdefghij";
    for (const spans of [[[8, 20]], [[5, 3]], [[-1, 2]], [[0, 4], [2, 6]], [[1.5, 3]]] as [number, number][][]) {
      const parts = redLetterParts(t, spans);
      expect(joined(parts)).toBe(t);
    }
    expect(redLetterParts(t, [[0, 4], [2, 6]]).filter((p) => p.jesus).map((p) => p.text)).toEqual(["abcd"]);
    expect(redLetterParts(t, [[8, 20]]).some((p) => p.jesus)).toBe(false);
  });

  it("joins verses with a space like passageText, keeping red across the gap only when both sides are His words", () => {
    const parts = joinVerseParts([
      { text: "Ask, and it will be given.", jesus: [[0, 26]] },
      { text: "For everyone who asks receives.", jesus: [[0, 31]] },
      { text: "Then the crowd left." },
    ]);
    expect(parts).toEqual([
      { text: "Ask, and it will be given. For everyone who asks receives.", jesus: true },
      { text: " Then the crowd left.", jesus: false },
    ]);
  });

  it("slices parts to a stretch of their text (for excerpts)", () => {
    const parts: TextPart[] = [
      { text: "He said, ", jesus: false },
      { text: "“Follow Me.”", jesus: true },
    ];
    expect(sliceParts(parts, 3, 16)).toEqual([
      { text: "said, ", jesus: false },
      { text: "“Follow", jesus: true },
    ]);
  });

  it("flags words the same way memory practice splits them", () => {
    const parts = joinVerseParts([{ text: "Jesus answered, “I am the way.”", jesus: [[16, 31]] }]);
    const text = joined(parts);
    const flags = redLetterWordFlags(parts);
    const words = maskWords(text, 0);
    expect(flags).toHaveLength(words.length);
    expect(words.filter((_, i) => flags[i]).map((w) => w.word)).toEqual(["“I", "am", "the", "way.”"]);
  });
});

describe("red letter: the data (public/bible/bsb/wj.json)", () => {
  it("comes from the pinned publisher USFM and was built for exactly the Bible text the app ships", () => {
    expect(wj.source).toBe("https://bereanbible.com/bsb_usfm.zip");
    const workflow = readFileSync(".github/workflows/bsb-text.yml", "utf8");
    expect(workflow).toContain(`BSB_USFM_SHA256: ${wj.sourceSha256}`);
    expect(wj.bibleContentSha256).toBe(meta.contentSha256);
  });

  it("has well-formed spans: inside the verse, in order, not overlapping, not starting or ending with a space", () => {
    let verses = 0;
    let stretches = 0;
    for (const [id, chapters] of Object.entries(wj.books)) {
      for (const [c, vs] of Object.entries(chapters)) {
        for (const [v, spans] of Object.entries(vs)) {
          const t = verse(id, Number(c), Number(v));
          expect(spans.length, `${id} ${c}:${v}`).toBeGreaterThan(0);
          let at = 0;
          for (const [s, e] of spans) {
            expect(s >= at && e > s && e <= t.length, `${id} ${c}:${v} [${s}, ${e}]`).toBe(true);
            expect(/\s/.test(t[s]!) || /\s/.test(t[e - 1]!), `${id} ${c}:${v} edge space`).toBe(false);
            at = e;
            stretches++;
          }
          verses++;
        }
      }
    }
    expect(verses).toBe(wj.totals.verses);
    expect(stretches).toBe(wj.totals.stretches);
    expect(verses).toBeGreaterThan(1900);
  });

  it("marks only New Testament books, where Jesus speaks", () => {
    const nt = meta.books.slice(39).map((b) => b.id);
    expect(Object.keys(wj.books).every((b) => nt.includes(b))).toBe(true);
    for (const b of ["MAT", "MRK", "LUK", "JHN", "ACT", "REV"]) expect(Object.keys(wj.books)).toContain(b);
  });

  it("colours His words and not the narration around them", () => {
    expect(marked("MAT", 5, 3)).toBe("⟦“Blessed are the poor in spirit, for theirs is the kingdom of heaven.⟧");
    expect(marked("MRK", 1, 15)).toBe("⟦“The time is fulfilled,”⟧ He said, ⟦“and the kingdom of God is near. Repent and believe in the gospel!”⟧");
    expect(marked("LUK", 23, 34)).toBe("Then Jesus said, ⟦“Father, forgive them, for they do not know what they are doing.”⟧ And they divided up His garments by casting lots.");
    expect(marked("JHN", 19, 30)).toBe("When Jesus had received the sour wine, He said, ⟦“It is finished.”⟧ And bowing His head, He yielded up His spirit.");
    expect(marked("ACT", 9, 5)).toBe("“Who are You, Lord?” Saul asked. ⟦“I am Jesus, whom you are persecuting,”⟧ He replied.");
    expect(marked("2CO", 12, 9)).toMatch(/^But He said to me, ⟦“My grace is sufficient for you, for My power is perfected in weakness\.”⟧ Therefore I will boast/);
  });

  it("leaves narration and other speakers plain", () => {
    expect(marked("MAT", 1, 1)).not.toContain("⟦");
    expect(marked("JHN", 11, 35)).toBe("Jesus wept.");
    expect(marked("REV", 1, 8)).not.toContain("⟦"); // "says the Lord God": not marked in the publisher's edition
    expect(marked("GEN", 1, 3)).not.toContain("⟦");
  });
});
