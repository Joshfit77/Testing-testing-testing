import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The complete Berean Standard Bible shipped for the reader (public/bible/bsb), built by scripts/build-bsb-bible.mjs in
 * .github/workflows/bsb-text.yml from the official bsb.txt whose SHA-256 the workflow pins. These checks run on the
 * committed files, so any edit, truncation or reordering after the build fails here.
 */
const root = path.resolve(import.meta.dirname, "../..");
const dir = path.join(root, "public/bible/bsb");
const canon = JSON.parse(readFileSync(path.join(root, "src/data/bible/books.json"), "utf8")).books as { id: string; name: string; chapters: number; testament: "OT" | "NT" }[];
const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf8"));
const books = canon.map((b) => JSON.parse(readFileSync(path.join(dir, "books", `${b.id}.json`), "utf8")) as { id: string; name: string; chapters: [number, string][][] });
const workflow = readFileSync(path.join(root, ".github/workflows/bsb-text.yml"), "utf8");
const passages = JSON.parse(readFileSync(path.join(root, "src/data/bsb-passages.json"), "utf8"));

describe("the complete BSB dataset", () => {
  it("is the 66-book Protestant canon in order: 39 + 27 books, 929 + 260 = 1,189 chapters", () => {
    expect(canon).toHaveLength(66);
    expect(canon.filter((b) => b.testament === "OT")).toHaveLength(39);
    expect(canon.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
    expect(canon.filter((b) => b.testament === "OT").reduce((n, b) => n + b.chapters, 0)).toBe(929);
    expect(canon[0]!.name).toBe("Genesis");
    expect(canon.at(-1)!.name).toBe("Revelation");
    expect(books.map((b) => b.id)).toEqual(canon.map((b) => b.id));
    expect(meta.books.map((b: { id: string }) => b.id)).toEqual(canon.map((b) => b.id));
  });

  it("comes from the pinned official file (the same file as the app's other BSB passages)", () => {
    const pinned = workflow.match(/BSB_SHA256: ([0-9a-f]{64})/)?.[1];
    expect(pinned).toBeTruthy();
    expect(meta.fileSha256).toBe(pinned);
    expect(passages.fileSha256).toBe(pinned);
    expect(meta.source).toMatch(/^https:\/\/(bereanbible\.com|berean\.bible|openbible\.com)\//);
    expect(meta.translation).toBe("BSB");
  });

  it("every book has every chapter, every chapter starts at verse 1 and its verses are in order, none empty", () => {
    const problems: string[] = [];
    canon.forEach((b, i) => {
      const book = books[i]!;
      if (book.chapters.length !== b.chapters) problems.push(`${b.name}: ${book.chapters.length} chapters`);
      const withoutText = new Set<string>(meta.books[i].withoutText);
      book.chapters.forEach((verses, c) => {
        if (!verses.length) problems.push(`${b.name} ${c + 1}: empty`);
        // Verse numbers run 1, 2, 3, ... with only the published no-text verses missing.
        let expected = 1;
        for (const [v, text] of verses) {
          while (expected < v && withoutText.has(`${c + 1}:${expected}`)) expected++;
          if (v !== expected) problems.push(`${b.name} ${c + 1}:${v} (expected ${expected})`);
          if (typeof text !== "string" || !text.trim()) problems.push(`${b.name} ${c + 1}:${v} has no text`);
          expected = v + 1;
        }
      });
    });
    expect(problems).toEqual([]);
  });

  it("totals: 31,102 verse numbers, 31,086 with text; the 16 without text are the BSB's footnoted verses, never filled in", () => {
    const verses = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0);
    expect(verses).toBe(31086);
    expect(meta.totals).toMatchObject({ books: 66, chapters: 1189, verseNumbers: 31102, verses: 31086, versesWithoutText: 16, absentVerses: 0 });
    const withoutText = meta.books.flatMap((b: { name: string; withoutText: string[] }) => b.withoutText.map((v) => `${b.name} ${v}`));
    expect(withoutText).toEqual([
      "Matthew 17:21", "Matthew 18:11", "Matthew 23:14",
      "Mark 7:16", "Mark 9:44", "Mark 9:46", "Mark 11:26", "Mark 15:28",
      "Luke 17:36", "Luke 23:17", "John 5:4",
      "Acts 8:37", "Acts 15:34", "Acts 24:7", "Acts 28:29", "Romans 16:24",
    ]);
  });

  it("the committed text is byte-for-byte what the build produced (content SHA-256)", () => {
    const h = createHash("sha256");
    for (const b of books) b.chapters.forEach((verses, c) => verses.forEach(([v, t]) => h.update(`${b.id} ${c + 1}:${v}\t${t}\n`)));
    expect(h.digest("hex")).toBe(meta.contentSha256);
  });

  it("agrees with every passage extracted independently by scripts/extract-bsb.mjs (68 references)", () => {
    const byName = new Map(canon.map((b, i) => [b.name, books[i]!]));
    byName.set("Psalm", byName.get("Psalms")!);
    const mismatches: string[] = [];
    for (const [ref, text] of Object.entries(passages.passages as Record<string, string>)) {
      const m = ref.match(/^((?:[1-3] )?[A-Za-z ]+?) (\d+):(\d+)(?:[–-](\d+))?$/)!;
      const book = byName.get(m[1]!)!;
      const chapter = book.chapters[Number(m[2]) - 1]!;
      const from = Number(m[3]);
      const to = Number(m[4] ?? m[3]);
      const joined = chapter.filter(([v]) => v >= from && v <= to).map(([, t]) => t).join(" ");
      if (joined !== text) mismatches.push(ref);
    }
    expect(Object.keys(passages.passages).length).toBeGreaterThanOrEqual(68);
    expect(mismatches).toEqual([]);
  });

  it("word counts in meta match the text (used for reading-time estimates)", () => {
    const words = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.reduce((k, [, t]) => k + (t.match(/\S+/g)?.length ?? 0), 0), 0), 0);
    expect(words).toBe(meta.totals.words);
  });
});
