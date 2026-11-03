import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HIGHLIGHT_ALPHA, HIGHLIGHT_SWATCHES, READING_PALETTES, readingVars, type BiblePageTheme } from "@/lib/bible/reading-display";

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const over = (fg: string, bg: string, alpha: number) =>
  "#" + channels(fg).map((c, i) => Math.round(alpha * c + (1 - alpha) * channels(bg)[i]!).toString(16).padStart(2, "0")).join("");

describe("reading display: contrast in both page modes (WCAG AA, 4.5:1 for text)", () => {
  for (const theme of ["dark", "light"] as BiblePageTheme[]) {
    const p = READING_PALETTES[theme];
    const backgrounds = { page: p.page, ...Object.fromEntries(Object.entries(HIGHLIGHT_SWATCHES).map(([k, c]) => [`${k} highlight`, over(c, p.page, HIGHLIGHT_ALPHA)])) };
    it(`${theme} page: Scripture, red letters and verse numbers stay readable on the page and under every highlight`, () => {
      for (const [where, bg] of Object.entries(backgrounds)) {
        expect(contrast(p.text, bg), `text on ${where}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.redLetter, bg), `red letters on ${where}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.verseNumber, bg), `verse numbers on ${where}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(p.muted, p.page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.page)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("red letters are clearly a different colour from the normal text and the verse numbers", () => {
    for (const p of Object.values(READING_PALETTES)) {
      expect(p.redLetter).not.toBe(p.text);
      const [r, g, b] = channels(p.redLetter);
      expect(r! > g! * 1.5 && r! > b! * 1.5).toBe(true); // reads as red
    }
  });
});

describe("reading display: one set of colours everywhere", () => {
  it("the app's red letter token is the dark page's red", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(`--red-letter: ${READING_PALETTES.dark.redLetter};`);
    // Red Letters off: the words take the normal text colour.
    expect(css).toMatch(/\.red-letters-off\s*\{\s*--red-letter:\s*currentColor;\s*\}/);
  });

  it("the offline reader uses the same colours for both pages", () => {
    const html = readFileSync("public/bible-offline.html", "utf8");
    expect(html).toContain(`--wj: ${READING_PALETTES.dark.redLetter}`);
    const light = READING_PALETTES.light;
    for (const c of [light.redLetter, light.page, light.text, light.verseNumber, light.muted, light.border]) expect(html).toContain(c);
    expect(html).toMatch(/body\.no-wj \.text \.wj \{ color: inherit; \}/);
  });

  it("switching Red Letters off sets the words to the surrounding text colour, on restores the page's red", () => {
    expect(readingVars("dark", true)).toMatchObject({ "--red-letter": READING_PALETTES.dark.redLetter });
    expect(readingVars("light", true)).toMatchObject({ "--red-letter": READING_PALETTES.light.redLetter });
    expect(readingVars("dark", false)).toMatchObject({ "--red-letter": "currentColor" });
    expect(readingVars("light", false)).toMatchObject({ "--red-letter": "currentColor" });
  });
});
