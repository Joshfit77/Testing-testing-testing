import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Red-letter boundaries (audit 2026-11-14), on top of tests/unit/red-letter*.test.ts: a red stretch must begin and end
 * on a word boundary (never inside a word), and the passages the documented basis singles out (docs/faith/RED_LETTER.md)
 * are checked verse by verse.
 */

interface BookFile {
  chapters: [number, string][][];
}
const wj = JSON.parse(readFileSync("public/bible/bsb/wj.json", "utf8")) as { books: Record<string, Record<string, Record<string, [number, number][]>>> };
const bookCache = new Map<string, BookFile>();
const book = (id: string) => {
  let b = bookCache.get(id);
  if (!b) bookCache.set(id, (b = JSON.parse(readFileSync(`public/bible/bsb/books/${id}.json`, "utf8")) as BookFile));
  return b;
};
const text = (id: string, c: number, v: number) => book(id).chapters[c - 1]!.find(([n]) => n === v)![1];
const spans = (id: string, c: number, v: number) => wj.books[id]?.[c]?.[v];
const red = (id: string, c: number, v: number) => (spans(id, c, v) ?? []).map(([s, e]) => text(id, c, v).slice(s, e));
const LETTER = /[\p{L}\p{N}]/u;

describe("red letter: boundaries", () => {
  it("no stretch starts or ends inside a word, and none runs past the end of its verse", () => {
    const bad: string[] = [];
    let stretches = 0;
    for (const [id, chapters] of Object.entries(wj.books)) {
      for (const [c, verses] of Object.entries(chapters)) {
        for (const [v, list] of Object.entries(verses)) {
          const t = text(id, Number(c), Number(v));
          for (const [s, e] of list) {
            stretches++;
            const inside = s < 0 || e > t.length || e <= s;
            const splitsStart = s > 0 && LETTER.test(t[s - 1]!) && LETTER.test(t[s]!);
            const splitsEnd = e < t.length && LETTER.test(t[e - 1]!) && LETTER.test(t[e]!);
            if (inside || splitsStart || splitsEnd) bad.push(`${id} ${c}:${v} [${s}, ${e}]`);
          }
        }
      }
    }
    expect(stretches).toBeGreaterThan(2000);
    expect(bad).toEqual([]);
  });

  it("Gospel narration is plain; sayings are red only between their quotation marks", () => {
    for (const [id, c, v] of [["MAT", 1, 18], ["MRK", 1, 1], ["LUK", 2, 1], ["JHN", 1, 1], ["JHN", 11, 35], ["LUK", 24, 53], ["MAT", 27, 50]] as const) expect(spans(id, c, v), `${id} ${c}:${v}`).toBeUndefined();
    expect(red("JHN", 14, 6)).toEqual(["“I am the way and the truth and the life. No one comes to the Father except through Me."]);
    expect(red("JHN", 15, 5)).toEqual([text("JHN", 15, 5)]);
    expect(red("MAT", 7, 13)).toEqual([text("MAT", 7, 13)]);
    expect(red("MAT", 7, 14)).toEqual([text("MAT", 7, 14)]);
    // Narration between two parts of one saying stays plain.
    expect(text("MAT", 4, 19)).toBe("“Come, follow Me,” Jesus said, “and I will make you fishers of men.”");
    expect(red("MAT", 4, 19)).toEqual(["“Come, follow Me,”", "“and I will make you fishers of men.”"]);
  });

  it("Acts 9: only the risen Jesus' words to Saul and Ananias are red; Saul's and Ananias' replies are plain", () => {
    expect(red("ACT", 9, 4)).toEqual(["“Saul, Saul, why do you persecute Me?”"]);
    expect(red("ACT", 9, 5)).toEqual(["“I am Jesus, whom you are persecuting,”"]);
    expect(text("ACT", 9, 5).startsWith("“Who are You, Lord?” Saul asked.")).toBe(true);
    expect(spans("ACT", 9, 13)).toBeUndefined(); // Ananias answers
    expect(spans("ACT", 9, 17)).toBeUndefined(); // Ananias to Saul
    for (const v of [11, 12, 15, 16]) expect(spans("ACT", 9, v), `Acts 9:${v}`).toBeDefined();
  });

  it("Acts 20:35: Paul's own sentence is plain; only the saying he attributes to the Lord Jesus is red", () => {
    const t = text("ACT", 20, 35);
    expect(red("ACT", 20, 35)).toEqual(["‘It is more blessed to give than to receive.’"]);
    expect(t.indexOf("In everything, I showed you")).toBe(0);
    expect(spans("ACT", 20, 35)![0]![0]).toBeGreaterThan(t.indexOf("Lord Jesus Himself"));
  });

  it("Revelation 1–3 and 22 follow the publisher's marking: the Son of Man and the seven letters are red, the narrator, the angel and 1:8 are not", () => {
    for (const v of [1, 2, 3, 4, 5, 6, 7, 9, 10]) expect(spans("REV", 1, v), `Revelation 1:${v}`).toBeUndefined();
    expect(spans("REV", 1, 8)).toBeUndefined(); // "says the Lord God": listed for review, not marked
    for (const v of [17, 18, 19, 20]) expect(spans("REV", 1, v), `Revelation 1:${v}`).toBeDefined();
    // In 1:17 John's narration comes first; only the speech is red.
    expect(red("REV", 1, 17).join(" ")).not.toContain("When I saw Him");
    for (const c of [2, 3]) for (const [v] of book("REV").chapters[c - 1]!) expect(spans("REV", c, v), `Revelation ${c}:${v}`).toBeDefined();
    // Chapter 22: His sayings are red; the angel (22:6, 9–11), John (22:8) and the closing benediction (22:21) are not.
    for (const v of [7, 12, 13, 16, 20]) expect(spans("REV", 22, v), `Revelation 22:${v}`).toBeDefined();
    for (const v of [1, 2, 3, 4, 5, 6, 8, 9, 21]) expect(spans("REV", 22, v), `Revelation 22:${v}`).toBeUndefined();
    expect(red("REV", 22, 20)).toEqual(["“Yes, I am coming soon.”"]);
  });
});
