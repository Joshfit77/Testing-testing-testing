import { formatAthleteContext } from "@/lib/coach/context";
import { journalEntriesForCoach, journalSearchPattern, type JournalRowForCoach } from "@/lib/domain/journal";
import { loadAthleteSnapshot } from "@/server/coach/snapshot";
import { athleteFixture, fakeSupabase } from "./fixtures/coach-fixtures";

const USER = "11111111-1111-1111-1111-111111111111";
const row = (over: Record<string, unknown> = {}): JournalRowForCoach => ({
  entry_date: "2026-10-20",
  kind: "request",
  title: "Dad's surgery",
  scripture_ref: "Philippians 4:6",
  body: "Lord, please guide the surgeons tomorrow.",
  answered_on: null,
  ...over,
} as JournalRowForCoach);

describe("prayer journal and the AI coach", () => {
  it("excludes journal entries by default (share flag false, missing or anything but true)", () => {
    expect(journalEntriesForCoach([row({ share_with_coach: false }), row({ share_with_coach: null }), { ...row(), share_with_coach: undefined as unknown as boolean }])).toEqual([]);
    expect(journalEntriesForCoach(null)).toEqual([]);
  });

  it("includes only entries the user explicitly shared, as a short excerpt", () => {
    const out = journalEntriesForCoach([row({ share_with_coach: true, body: "x".repeat(1000) }), row({ share_with_coach: false, title: "Private" })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("Dad's surgery");
    expect(out[0]!.excerpt.length).toBeLessThanOrEqual(400);
  });

  it("the context has no journal text unless entries were shared", () => {
    const base = athleteFixture();
    const text = formatAthleteContext(base);
    expect(text).not.toMatch(/journal/i);
    expect(text).not.toContain("surgeons");
    const shared = formatAthleteContext({ ...base, sharedJournal: journalEntriesForCoach([row({ share_with_coach: true })]) });
    expect(shared).toMatch(/Journal entries the athlete chose to share/);
    expect(shared).toContain("surgeons");
  });

  it("the snapshot loader asks only for shared entries and drops anything unshared it gets back", async () => {
    const { client, log } = fakeSupabase({
      // Even if the database returned unshared rows, they must not reach the coach.
      faith_journal_entries: { data: [row({ share_with_coach: false }), row({ share_with_coach: false, body: "secret" })], error: null },
    });
    const snap = await loadAthleteSnapshot(client, USER);
    expect(snap.sharedJournal).toEqual([]);
    expect(formatAthleteContext(snap)).not.toMatch(/surgeons|secret/);
    const q = log.find((l) => l.table === "faith_journal_entries");
    expect(q?.calls).toEqual(expect.arrayContaining([["eq", ["share_with_coach", true]], ["eq", ["user_id", USER]]]));
  });
});

describe("journal search", () => {
  it("makes a safe ilike pattern", () => {
    expect(journalSearchPattern("  healing ")).toBe("%healing%");
    expect(journalSearchPattern("a,b(c)%*")).toBe("%a b c%");
    expect(journalSearchPattern("   ")).toBeNull();
    expect(journalSearchPattern(undefined)).toBeNull();
  });
});
