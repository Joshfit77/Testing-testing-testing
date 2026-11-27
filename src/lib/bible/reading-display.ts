import type { CSSProperties } from "react";

/**
 * Bible reading display: the Red Letters setting and the reading page (dark or light). Display only: the Bible text is
 * never changed, and copy, share, notes and AI prompts always use the plain text.
 *
 * Colours come from here so the reader, the offline reader (public/bible-offline.html, checked by a test) and the
 * contrast tests use the same values. Every text colour is at least 4.5:1 against its page and against each highlight
 * colour laid over it (tests/unit/reading-display.test.ts).
 */
export type BiblePageTheme = "dark" | "light";

export interface ReadingPalette {
  page: string;
  text: string;
  /** Words of Jesus. */
  redLetter: string;
  verseNumber: string;
  /** Bookmarks, note buttons. */
  accent: string;
  muted: string;
  border: string;
}

export const READING_PALETTES: Record<BiblePageTheme, ReadingPalette> = {
  // The app's own tokens (src/app/globals.css): the dark page looks exactly as before.
  dark: { page: "#070707", text: "#ffffff", redLetter: "#f0736a", verseNumber: "#c9a54c", accent: "#e2c477", muted: "#b3b0aa", border: "#2b2824" },
  // A warm paper page with a deep red.
  light: { page: "#f8f4ea", text: "#1c1915", redLetter: "#9b1c24", verseNumber: "#6f4f12", accent: "#6f4f12", muted: "#57524a", border: "#d9cfbb" },
};

/** Highlight colours (as in the reader) and how strongly they're laid over the page. */
export const HIGHLIGHT_SWATCHES = { gold: "#C9A54C", sage: "#7FA37A", sky: "#6E9CC4", rose: "#C47A86" } as const;
export const HIGHLIGHT_ALPHA = 0.25;

/** Device keys the offline reader reads (it has no account); the app keeps them in step with the account. */
export const RED_LETTERS_KEY = "ngf.bible.redLetters";
export const PAGE_THEME_KEY = "ngf.bible.pageTheme";

/** Words of Jesus in their normal text colour: `color: var(--red-letter)` resolves to the inherited colour. */
export const RED_LETTERS_OFF_CLASS = "red-letters-off";

/**
 * CSS custom properties for a reading page. The nearest ancestor that sets --red-letter wins, so the reader can switch
 * instantly while the rest of the page still carries the saved setting.
 */
export function readingVars(theme: BiblePageTheme, redLetters: boolean): CSSProperties {
  const p = READING_PALETTES[theme];
  return {
    "--red-letter": redLetters ? p.redLetter : "currentColor",
    "--reader-page": p.page,
    "--reader-text": p.text,
    "--reader-verse": p.verseNumber,
    "--reader-accent": p.accent,
    "--reader-muted": p.muted,
    "--reader-border": p.border,
  } as CSSProperties;
}

/**
 * Applies the account's setting to <html> (for Scripture shown outside the page wrapper, such as dialogs) and keeps
 * this device's copy for the offline reader.
 */
export function applyBibleDisplay(redLetters: boolean, pageTheme: BiblePageTheme) {
  document.documentElement.classList.toggle(RED_LETTERS_OFF_CLASS, !redLetters);
  try {
    localStorage.setItem(RED_LETTERS_KEY, redLetters ? "1" : "0");
    localStorage.setItem(PAGE_THEME_KEY, pageTheme);
  } catch {
    /* storage unavailable */
  }
}
