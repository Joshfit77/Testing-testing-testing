/**
 * Prayer journal (SPEC §12). Entries are private: owner-only RLS, never shown to administrators, and
 * NOT shared with the AI coach unless the user ticks "Share with AI Coach" on that entry (off by default).
 */

export const JOURNAL_KINDS = ["reflection", "request", "praise"] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

export const JOURNAL_KIND_LABELS: Record<JournalKind, string> = {
  reflection: "Reflection",
  request: "Prayer request",
  praise: "Praise / thanksgiving",
};

export const JOURNAL_FILTERS = ["all", "request", "open", "answered", "praise", "reflection", "shared"] as const;
export type JournalFilter = (typeof JOURNAL_FILTERS)[number];

export const JOURNAL_FILTER_LABELS: Record<JournalFilter, string> = {
  all: "All",
  request: "Requests",
  open: "Still praying",
  answered: "Answered",
  praise: "Praise",
  reflection: "Reflections",
  shared: "Shared with coach",
};

export function parseJournalFilter(v: string | undefined): JournalFilter {
  return v && (JOURNAL_FILTERS as readonly string[]).includes(v) ? (v as JournalFilter) : "all";
}

/**
 * Turn free text into a safe PostgREST `ilike` pattern: strips characters that have meaning in the
 * filter syntax (`,()%*\`) and caps the length. Returns null for an empty search.
 */
export function journalSearchPattern(q: string | undefined): string | null {
  const clean = (q ?? "").replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean ? `%${clean}%` : null;
}

export interface JournalRowForCoach {
  entry_date: string;
  kind: string | null;
  title: string | null;
  scripture_ref: string | null;
  body: string;
  answered_on: string | null;
  share_with_coach: boolean | null;
}

export interface SharedJournalEntry {
  date: string;
  kind: JournalKind;
  title: string | null;
  scriptureRef: string | null;
  excerpt: string;
  answeredOn: string | null;
}

/** Most entries the coach ever sees, and how much of each. */
export const COACH_JOURNAL_LIMIT = 5;
export const COACH_JOURNAL_EXCERPT = 400;

/**
 * The only path from journal rows to the AI coach. Anything not explicitly shared (`share_with_coach`
 * strictly true) is dropped, so entries are excluded by default.
 */
export function journalEntriesForCoach(rows: readonly JournalRowForCoach[] | null | undefined): SharedJournalEntry[] {
  return (rows ?? [])
    .filter((r) => r.share_with_coach === true)
    .slice(0, COACH_JOURNAL_LIMIT)
    .map((r) => {
      const body = r.body.replace(/\s+/g, " ").trim();
      return {
        date: r.entry_date,
        kind: (JOURNAL_KINDS as readonly string[]).includes(r.kind ?? "") ? (r.kind as JournalKind) : "reflection",
        title: r.title,
        scriptureRef: r.scripture_ref,
        excerpt: body.length > COACH_JOURNAL_EXCERPT ? `${body.slice(0, COACH_JOURNAL_EXCERPT - 1)}…` : body,
        answeredOn: r.answered_on,
      };
    });
}
