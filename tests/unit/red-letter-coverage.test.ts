import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinVerseParts, redLetterParts } from "@/lib/bible/red-letter";

const DIR = "public/bible/bsb";
const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, "utf8")) as { books: { id: string }[] };
const wj = JSON.parse(readFileSync(`${DIR}/wj.json`, "utf8")) as { books: Record<string, Record<string, Record<string, [number, number][]>>> };
const cache = new Map<string, [number, string][][]>();
const chapters = (id: string) => {
  if (!cache.has(id)) cache.set(id, JSON.parse(readFileSync(`${DIR}/books/${id}.json`, "utf8")).chapters);
  return cache.get(id)!;
};
const text = (id: string, c: number, v: number) => chapters(id)[c - 1]!.find(([n]) => n === v)![1];
const spans = (id: string, c: number, v: number) => wj.books[id]?.[c]?.[v];
const red = (id: string, c: number, v: number) => redLetterParts(text(id, c, v), spans(id, c, v)).filter((p) => p.jesus).map((p) => p.text).join(" | ");
const fullyRed = (id: string, c: number, v: number) => {
  const t = text(id, c, v);
  const s = spans(id, c, v);
  return Boolean(s && s.length === 1 && s[0]![0] === 0 && s[0]![1] === t.length);
};
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const marked = (id: string) => Object.values(wj.books[id] ?? {}).reduce((n, vs) => n + Object.keys(vs).length, 0);

describe("red letter coverage: the Gospels", () => {
  it("each Gospel has substantial coverage", () => {
    expect(marked("MAT")).toBeGreaterThan(600);
    expect(marked("MRK")).toBeGreaterThan(250);
    expect(marked("LUK")).toBeGreaterThan(550);
    expect(marked("JHN")).toBeGreaterThan(400);
  });

  it("the Sermon on the Mount is His from 5:3 to 7:27, across three chapters; the setting is narration", () => {
    expect(spans("MAT", 5, 1)).toBeUndefined();
    expect(spans("MAT", 5, 2)).toBeUndefined();
    for (const v of range(4, 48)) expect(fullyRed("MAT", 5, v), `Matthew 5:${v}`).toBe(true);
    for (const v of range(1, 34)) expect(fullyRed("MAT", 6, v), `Matthew 6:${v}`).toBe(true);
    for (const v of range(1, 27)) expect(fullyRed("MAT", 7, v), `Matthew 7:${v}`).toBe(true);
    expect(spans("MAT", 7, 28)).toBeUndefined();
  });

  it("the Upper Room discourse runs across chapters, and the disciples' questions stay plain", () => {
    for (const v of range(1, 27)) expect(fullyRed("JHN", 15, v), `John 15:${v}`).toBe(true);
    for (const v of range(1, 26)) expect(spans("JHN", 17, v), `John 17:${v}`).toBeDefined();
    expect(red("JHN", 14, 5)).toBe(""); // Thomas
    expect(red("JHN", 14, 8)).toBe(""); // Philip
    expect(red("JHN", 14, 22)).toBe(""); // Judas (not Iscariot)
    expect(fullyRed("JHN", 14, 31)).toBe(true);
  });

  it("John 3:16–21 is red, inside the BSB's own quotation that closes at 3:21", () => {
    for (const v of range(16, 21)) expect(fullyRed("JHN", 3, v), `John 3:${v}`).toBe(true);
    expect(text("JHN", 3, 21).endsWith("”")).toBe(true);
    expect(spans("JHN", 3, 22)).toBeUndefined();
  });
});

describe("red letter coverage: word level", () => {
  it("mixed verses colour only His words; narration and other speakers stay plain", () => {
    expect(red("MRK", 1, 15)).toBe("“The time is fulfilled,” | “and the kingdom of God is near. Repent and believe in the gospel!”");
    expect(red("JHN", 21, 17)).toBe("“Simon son of John, do you love Me?” | “Do you love Me?” | “Feed My sheep.");
    expect(text("JHN", 21, 17)).toContain("“Lord, You know all things,” he replied.");
    expect(red("JHN", 21, 17)).not.toContain("Lord, You know all things");
    expect(red("MAT", 27, 46)).toBe("“Eli, Eli, lema sabachthani?” | “My God, My God, why have You forsaken Me?”");
  });

  it("what He quotes is His speech too (owner's policy): Scripture He recites and His parables' dialogue", () => {
    expect(red("MAT", 4, 4)).toContain("‘Man shall not live on bread alone");
    expect(fullyRed("LUK", 15, 21)).toBe(true); // the son, in His parable
    expect(fullyRed("LUK", 15, 32)).toBe(true);
  });

  it("when others quote Him, only His words are red", () => {
    expect(red("MAT", 27, 43)).toBe("‘I am the Son of God.’");
    expect(red("MRK", 5, 31)).toBe("‘Who touched Me?’");
  });
});

describe("red letter coverage: Acts, the letters and Revelation", () => {
  it("the risen Jesus speaking in Acts", () => {
    for (const [c, v] of [[1, 7], [1, 8], [9, 4], [9, 5], [9, 6], [18, 9], [20, 35], [26, 14], [26, 18]] as const) expect(spans("ACT", c, v), `Acts ${c}:${v}`).toBeDefined();
    expect(red("ACT", 9, 5)).toBe("“I am Jesus, whom you are persecuting,”");
  });
  it("His words quoted in the letters: the Lord's Supper and Paul's thorn", () => {
    expect(red("1CO", 11, 24)).toBe("“This is My body, which is for you; do this in remembrance of Me.”");
    expect(spans("1CO", 11, 25)).toBeDefined();
    expect(red("2CO", 12, 9)).toBe("“My grace is sufficient for you, for My power is perfected in weakness.”");
  });
  it("the letters to the seven churches and the closing words of Revelation", () => {
    for (const c of [2, 3]) for (const [v] of chapters("REV")[c - 1]!) expect(spans("REV", c, v), `Revelation ${c}:${v}`).toBeDefined();
    for (const v of [17, 18, 19, 20]) expect(spans("REV", 1, v)).toBeDefined();
    expect(red("REV", 22, 20)).toBe("“Yes, I am coming soon.”");
    expect(text("REV", 22, 20)).toMatch(/Amen\. Come, Lord Jesus!$/);
  });
  it("evaluated but not marked (listed for review): 1 Timothy 5:18, Hebrews 2:12–13, Revelation 1:8", () => {
    expect(spans("1TI", 5, 18)).toBeUndefined();
    expect(spans("HEB", 2, 12)).toBeUndefined();
    expect(spans("REV", 1, 8)).toBeUndefined();
  });
  it("no Old Testament verse is red", () => {
    const ot = meta.books.slice(0, 39).map((b) => b.id);
    expect(Object.keys(wj.books).filter((b) => ot.includes(b))).toEqual([]);
  });
});

describe("red letter: the text is never changed", () => {
  it("every one of the 31,086 verses reads exactly the same with red letters applied", () => {
    let verses = 0;
    for (const { id } of meta.books)
      chapters(id).forEach((vs, ci) => {
        for (const [v, t] of vs) {
          expect(redLetterParts(t, spans(id, ci + 1, v)).map((p) => p.text).join("")).toBe(t);
          verses++;
        }
      });
    expect(verses).toBe(31086);
  });
  it("whole passages read exactly as the plain passage text (verses joined with a space)", () => {
    const vs = chapters("MAT")[4]!.map(([v, t]) => ({ text: t, jesus: spans("MAT", 5, v) }));
    expect(joinVerseParts(vs).map((p) => p.text).join("")).toBe(vs.map((v) => v.text).join(" "));
  });
  it("splitting every red verse in the Bible is fast (well under a frame budget per chapter)", () => {
    const t0 = performance.now();
    for (const [id, cs] of Object.entries(wj.books)) for (const [c, vs] of Object.entries(cs)) for (const v of Object.keys(vs)) redLetterParts(text(id, Number(c), Number(v)), spans(id, Number(c), Number(v)));
    expect(performance.now() - t0).toBeLessThan(250);
  });
});
