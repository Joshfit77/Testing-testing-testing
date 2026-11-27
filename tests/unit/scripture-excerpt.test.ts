import { describe, expect, it } from "vitest";
import { SCRIPTURES } from "@/data/content";
import { DEVOTIONALS } from "@/data/devotionals";
import { verseExcerpt } from "@/lib/domain/scripture";

/** True when `excerpt` ends exactly at a word boundary of `full` (or is the whole of it). */
function endsOnWordBoundary(full: string, excerpt: string): boolean {
  const core = excerpt.endsWith("…") ? excerpt.slice(0, -1) : excerpt;
  if (!full.startsWith(core)) return false;
  const next = full.charAt(core.length);
  return next === "" || /[\s,;:.?!—–”’"')]/.test(next);
}

function wordCount(s: string): number {
  return s.replace(/…$/, "").trim().split(/\s+/).filter(Boolean).length;
}

describe("verseExcerpt", () => {
  it("shows a short verse whole", () => {
    expect(verseExcerpt("Be still, and know that I am God.")).toBe("Be still, and know that I am God.");
    expect(verseExcerpt("Jesus wept.")).toBe("Jesus wept.");
    expect(verseExcerpt("Whatever you do, work at it with your whole being, as for the Lord and not for men,")).toBe(
      "Whatever you do, work at it with your whole being, as for the Lord and not for men,",
    );
  });

  it("cuts a long verse at a sentence end", () => {
    const text = `${"Run the race set before you with endurance. ".repeat(4)}And finish it well, with joy and patience.`;
    const v = verseExcerpt(text, 100);
    expect(v).toBe("Run the race set before you with endurance. Run the race set before you with endurance.");
  });

  it("cuts one very long sentence at a clause or word gap, never mid-word", () => {
    const text = `Let us run, ${"and keep running with patience ".repeat(10)}to the end.`;
    const v = verseExcerpt(text, 80);
    expect(v.endsWith("…")).toBe(true);
    expect(v.length).toBeLessThanOrEqual(81);
    expect(endsOnWordBoundary(text, v)).toBe(true);
    expect(v.length).toBeGreaterThanOrEqual(40);
  });

  const all = [
    ...SCRIPTURES.map((s) => ({ reference: s.reference, text: s.text })),
    ...DEVOTIONALS.map((d) => ({ reference: `devotional ${d.reference}`, text: d.scripture })),
  ];

  it.each(all)("$reference is never a fragment", ({ text }) => {
    const v = verseExcerpt(text);
    expect(endsOnWordBoundary(text.trim(), v)).toBe(true);
    expect(wordCount(v)).toBeGreaterThanOrEqual(Math.min(6, wordCount(text)));
    expect(v.length).toBeLessThanOrEqual(221);
    // A short verse is always shown in full.
    if (text.trim().length <= 220) expect(v).toBe(text.trim());
  });

  it("keeps every verse of the day whole except the two longest passages", () => {
    const cut = SCRIPTURES.filter((s) => verseExcerpt(s.text) !== s.text.trim()).map((s) => s.reference);
    expect(cut.length).toBeLessThanOrEqual(2);
  });
});
