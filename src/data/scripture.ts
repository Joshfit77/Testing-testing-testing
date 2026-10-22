/**
 * Bible translation for every verse the app shows: Home, Faith, the 40-day devotional, the welcome and
 * sign-up pages, reminders and the AI coach's list of quotable verses.
 *
 * The app uses the Berean Standard Bible (BSB, public domain). Verse text is never typed by hand: it
 * comes from src/data/bsb-passages.json, which scripts/extract-bsb.mjs builds from the official BSB
 * plain-text file linked at https://berean.bible/downloads.htm (see .github/workflows/bsb-text.yml).
 * The verse text written in content.ts and devotionals.ts must match that file exactly
 * (tests/unit/scripture.test.ts), and the test fails if any passage is missing.
 */
import bsb from "@/data/bsb-passages.json";

export type TranslationId = "KJV" | "BSB";

export interface Translation {
  id: TranslationId;
  /** Shown after a reference, e.g. "Galatians 6:9 (BSB)". */
  code: string;
  name: string;
  /** Short status shown beside the full verse on Faith. */
  license: string;
  /** Copyright notice for the app's legal and Faith pages. */
  notice: string;
  noticeUrl: string | null;
}

export const TRANSLATIONS: Record<TranslationId, Translation> = {
  KJV: {
    id: "KJV",
    code: "KJV",
    name: "King James Version",
    license: "Public domain (outside the UK)",
    notice: "Scripture quotations are from the King James Version (KJV), which is in the public domain outside the United Kingdom.",
    noticeUrl: null,
  },
  BSB: {
    id: "BSB",
    code: "BSB",
    name: "Berean Standard Bible",
    license: "Public domain",
    notice: "Scripture quotations are from the Berean Standard Bible (BSB), public domain.",
    noticeUrl: "https://berean.bible/",
  },
};

/** Official BSB text for each passage the app quotes, keyed by the reference as the app writes it. */
export const BSB_PASSAGES: Record<string, string> = (bsb as { passages: Record<string, string> }).passages;

/** Where the BSB text came from (download URL, time and the file's SHA-256), for the record. */
export const BSB_SOURCE = { source: (bsb as { source?: string }).source ?? null, downloadedAt: (bsb as { downloadedAt?: string }).downloadedAt ?? null, fileSha256: (bsb as { fileSha256?: string }).fileSha256 ?? null };

/**
 * Short quotations for reminder notifications. Each must be an exact, contiguous part of that verse's
 * BSB text (checked by tests/unit/scripture.test.ts).
 */
export const BSB_FRAGMENTS: Record<string, string> = {
  "Colossians 3:23": "Whatever you do, work at it with your whole being",
  "Galatians 6:9": "Let us not grow weary in well-doing",
  "Hebrews 12:1": "let us run with endurance the race set out for us",
};

/** The translation in use. */
export const ACTIVE_TRANSLATION_ID: TranslationId = "BSB";

export const ACTIVE_TRANSLATION: Translation = TRANSLATIONS[ACTIVE_TRANSLATION_ID];

/**
 * The verse text to show for a passage: the official BSB wording. `text` is the copy written in the
 * calling file, used only if the translation is ever switched away from BSB.
 */
export function scriptureText(reference: string, text: string): string {
  if (ACTIVE_TRANSLATION_ID !== "BSB") return text;
  const bsbText = BSB_PASSAGES[reference];
  if (!bsbText) throw new Error(`No BSB text for ${reference}`);
  return bsbText;
}

/** A short reminder quotation with its reference and translation, e.g. “…” (Galatians 6:9, BSB). */
export function scriptureFragment(reference: string, fragment: string): string {
  const text = ACTIVE_TRANSLATION_ID === "BSB" ? BSB_FRAGMENTS[reference] : fragment;
  if (!text) throw new Error(`No BSB fragment for ${reference}`);
  return `“${text}” (${reference}, ${ACTIVE_TRANSLATION.code})`;
}
