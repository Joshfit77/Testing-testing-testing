import { describe, expect, it } from "vitest";
import { journalEntriesForCoach, journalSharingAllowed } from "@/lib/domain/journal";

/** The prayer-journal gate (migration 080): every condition must hold; anything missing means no. */
describe("journalSharingAllowed", () => {
  const on = { faith_enabled: true, ai_data_consent_at: "2026-11-17T00:00:00Z", journal_ai_consent_at: "2026-11-17T00:00:00Z" };
  it("allows only with the journal permission, the AI consent and faith features all on", () => {
    expect(journalSharingAllowed(on)).toBe(true);
    expect(journalSharingAllowed({ ...on, journal_ai_consent_at: null })).toBe(false);
    expect(journalSharingAllowed({ ...on, ai_data_consent_at: null })).toBe(false);
    expect(journalSharingAllowed({ ...on, faith_enabled: false })).toBe(false);
  });
  it("treats a missing profile or missing columns (code deployed before the migration) as no", () => {
    expect(journalSharingAllowed(null)).toBe(false);
    expect(journalSharingAllowed(undefined)).toBe(false);
    expect(journalSharingAllowed({ faith_enabled: true, ai_data_consent_at: "2026-11-17T00:00:00Z" })).toBe(false);
  });
  it("even when allowed, only entries marked shared are passed on", () => {
    const rows = [
      { entry_date: "2026-11-17", kind: "daily", title: null, scripture_ref: null, body: "private", answered_on: null, share_with_coach: false },
      { entry_date: "2026-11-16", kind: "daily", title: null, scripture_ref: null, body: "shared", answered_on: null, share_with_coach: true },
    ];
    expect(journalEntriesForCoach(rows).map((e) => e.excerpt)).toEqual(["shared"]);
  });
});
