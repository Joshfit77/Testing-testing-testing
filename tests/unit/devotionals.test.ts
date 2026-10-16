import { CHALLENGE_DAYS, DEVOTIONALS, DEVOTIONAL_THEME_LABELS, devotionalForDay } from "@/data/devotionals";
import { SCRIPTURES } from "@/data/content";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

describe("40-day devotional content", () => {
  it("has exactly 40 days numbered 1–40 in order", () => {
    expect(CHALLENGE_DAYS).toBe(40);
    expect(DEVOTIONALS).toHaveLength(40);
    DEVOTIONALS.forEach((d, i) => expect(d.day).toBe(i + 1));
  });

  it("has every field filled in", () => {
    for (const d of DEVOTIONALS) {
      for (const key of ["title", "reference", "scripture", "devotional", "prayer", "train", "reflection"] as const) {
        expect(d[key].trim().length, `day ${d.day} ${key}`).toBeGreaterThan(0);
      }
      expect(DEVOTIONAL_THEME_LABELS[d.theme], `day ${d.day} theme`).toBeDefined();
    }
  });

  it("keeps devotionals between 120 and 180 words", () => {
    for (const d of DEVOTIONALS) {
      const n = words(d.devotional);
      expect(n, `day ${d.day} has ${n} words`).toBeGreaterThanOrEqual(120);
      expect(n, `day ${d.day} has ${n} words`).toBeLessThanOrEqual(180);
    }
  });

  it("uses one-sentence prayers, question reflections and train prompts with a rest-day option", () => {
    for (const d of DEVOTIONALS) {
      expect(d.prayer.trim().endsWith("."), `day ${d.day} prayer`).toBe(true);
      expect(d.prayer.slice(0, -1).includes(". "), `day ${d.day} prayer is one sentence`).toBe(false);
      expect(d.reflection.trim().endsWith("?"), `day ${d.day} reflection`).toBe(true);
      expect(/rest day/i.test(d.train), `day ${d.day} train prompt mentions rest day`).toBe(true);
    }
  });

  it("has no duplicate references or titles", () => {
    expect(new Set(DEVOTIONALS.map((d) => d.reference)).size).toBe(40);
    expect(new Set(DEVOTIONALS.map((d) => d.title)).size).toBe(40);
  });

  it("formats references like the rest of the app (Book chapter:verse with en dash ranges)", () => {
    for (const d of DEVOTIONALS) expect(d.reference, `day ${d.day}`).toMatch(/^(\d )?[A-Z][a-z]+( [A-Z][a-z]+)? \d+:\d+(–\d+)?$/);
  });

  it("matches the verse text already in content.ts wherever the same reference is used", () => {
    const known = new Map(SCRIPTURES.map((s) => [s.reference, s.text]));
    let shared = 0;
    for (const d of DEVOTIONALS) {
      const text = known.get(d.reference);
      if (text) {
        shared += 1;
        expect(d.scripture, d.reference).toBe(text);
      }
    }
    expect(shared).toBeGreaterThan(10);
  });

  it("clamps devotionalForDay to 1–40", () => {
    expect(devotionalForDay(0).day).toBe(1);
    expect(devotionalForDay(41).day).toBe(40);
    expect(devotionalForDay(17).day).toBe(17);
  });
});
