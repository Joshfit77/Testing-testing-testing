import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  accountabilityErrorMessage,
  formatInviteCode,
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  inviteIsOpen,
  inviteShareText,
  isNudgeKey,
  NUDGE_KEYS,
  NUDGES_PER_DAY,
  normalizeInviteCode,
  nudgesRemaining,
  parseSummary,
  summaryLines,
} from "@/lib/domain/accountability";

/** Accountability partners (migration 067): invite codes, what a partner's summary may contain, and the nudge limit. */
const migration = readFileSync("supabase/migrations/20261113000067_accountability_partners.sql", "utf8");

describe("invite codes", () => {
  it("are 10 characters from the look-alike-free alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    }
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(INVITE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("use every letter equally (256 random values map evenly onto 32 letters)", () => {
    const seen = new Map<string, number>();
    // Feed every byte value 0..255 through the generator.
    for (let start = 0; start < 256; start += INVITE_CODE_LENGTH) {
      const code = generateInviteCode((b) => b.map((_, i) => (start + i) % 256));
      for (const ch of code) seen.set(ch, (seen.get(ch) ?? 0) + 1);
    }
    expect(seen.size).toBe(32);
  });

  it("are random (no repeats in a large sample)", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateInviteCode()));
    expect(codes.size).toBe(2000);
  });

  it("are accepted however they're typed, and anything else is rejected", () => {
    expect(normalizeInviteCode("abcde-fgh23")).toBe("ABCDEFGH23");
    expect(normalizeInviteCode(" ABCDE FGH23 ")).toBe("ABCDEFGH23");
    expect(normalizeInviteCode("ABCDEFGH2")).toBeNull(); // too short
    expect(normalizeInviteCode("ABCDEFGH234")).toBeNull(); // too long
    expect(normalizeInviteCode("ABCDEFGH1O")).toBeNull(); // look-alikes never appear in codes
    expect(normalizeInviteCode("ABCDE'; --")).toBeNull();
    expect(normalizeInviteCode("")).toBeNull();
  });

  it("match the database's own format check", () => {
    expect(migration).toContain("check (code ~ '^[A-HJ-NP-Z2-9]{10}$')");
  });

  it("are shown in two groups and shared without any personal data", () => {
    expect(formatInviteCode("ABCDEFGH23")).toBe("ABCDE-FGH23");
    const text = inviteShareText("ABCDEFGH23", "2026-11-20T10:00:00Z");
    expect(text).toContain("ABCDE-FGH23");
    expect(text).toContain("Nov 20");
    expect(text).toContain("one use");
  });

  it("are open only while unused and unexpired", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    expect(inviteIsOpen({ expires_at: "2026-11-20T12:00:00Z", used_at: null }, now)).toBe(true);
    expect(inviteIsOpen({ expires_at: "2026-11-13T11:59:59Z", used_at: null }, now)).toBe(false);
    expect(inviteIsOpen({ expires_at: "2026-11-20T12:00:00Z", used_at: "2026-11-13T10:00:00Z" }, now)).toBe(false);
  });
});

describe("a partner's shared summary", () => {
  it("keeps only the shareable fields, with the right types", () => {
    const s = parseSummary({
      partner_name: "Sam",
      workouts_last_7_days: 4,
      streak_days: 2,
      streak_weeks: 6,
      program: { name: "Foundations", week: 3, weeks: 8 },
      // Anything else is dropped, whatever it is.
      weight_kg: 81.2,
      email: "sam@example.com",
      journal: "private",
      workouts: [{ id: "x", notes: "secret" }],
    });
    expect(s).toEqual({ partnerName: "Sam", workoutsLast7Days: 4, streakDays: 2, streakWeeks: 6, program: { name: "Foundations", week: 3, weeks: 8 } });
  });

  it("shows only what the partner shares: nothing shared means name only", () => {
    expect(parseSummary({ partner_name: "Sam" })).toEqual({ partnerName: "Sam" });
    expect(summaryLines(parseSummary({ partner_name: "Sam" })!)).toEqual([]);
    expect(summaryLines(parseSummary({ partner_name: "Sam", workouts_last_7_days: 1 })!)).toEqual([{ label: "Workouts, last 7 days", value: "1" }]);
    expect(summaryLines(parseSummary({ partner_name: "Sam", streak_days: 1, streak_weeks: 3 })!)).toEqual([{ label: "Streak", value: "1 day · 3 weeks" }]);
  });

  it("says when program progress is shared but no program is active", () => {
    const s = parseSummary({ partner_name: "Sam", program: null })!;
    expect(s.program).toBeNull();
    expect(summaryLines(s)).toEqual([{ label: "Program", value: "No active program" }]);
  });

  it("drops malformed values instead of showing them", () => {
    expect(parseSummary({ partner_name: "Sam", workouts_last_7_days: "4", streak_days: -1, streak_weeks: 2 })).toEqual({ partnerName: "Sam" });
    expect(parseSummary({ partner_name: "Sam", program: { name: "X", week: "3", weeks: 8 } })).toEqual({ partnerName: "Sam", program: null });
    expect(parseSummary({ partner_name: "  " })).toEqual({ partnerName: "Your partner" });
  });

  it("is nothing at all for a stranger or an ended partnership (the database returns null)", () => {
    expect(parseSummary(null)).toBeNull();
    expect(parseSummary([])).toBeNull();
    expect(parseSummary("x")).toBeNull();
  });

  it("is built in the database from the share switches, never from raw rows of food, weight, sleep, photos or journal", () => {
    const fn = migration.slice(migration.indexOf("create or replace function public.accountability_summary"), migration.indexOf("create or replace function public.accept_accountability_invite"));
    expect(fn).toContain("security definer");
    expect(fn).toMatch(/v_share\.share_workouts/);
    expect(fn).toMatch(/v_share\.share_streak/);
    expect(fn).toMatch(/v_share\.share_program_progress/);
    for (const table of ["meals", "meal_items", "weight_entries", "measurement_entries", "sleep_sessions", "body_scans", "progress_photos", "faith_journal_entries", "ai_messages", "bible_notes"]) {
      expect(fn, table).not.toMatch(new RegExp(`public\\.${table}\\b`));
    }
  });
});

describe("encouragements", () => {
  it("are a fixed list that matches the database check", () => {
    expect(NUDGE_KEYS.length).toBeGreaterThan(3);
    for (const k of NUDGE_KEYS) expect(migration).toContain(`'${k}'`);
    const check = migration.match(/message_key in \(([^)]*)\)/)![1]!;
    expect(check.split(",").map((s) => s.trim().replace(/'/g, "")).sort()).toEqual([...NUDGE_KEYS].sort());
    expect(isNudgeKey("proud")).toBe(true);
    expect(isNudgeKey("hello there")).toBe(false);
    expect(isNudgeKey("__proto__")).toBe(false);
  });

  it("are limited to 3 per partner in any 24 hours", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    expect(NUDGES_PER_DAY).toBe(3);
    expect(nudgesRemaining([], now)).toBe(3);
    expect(nudgesRemaining(["2026-11-13T11:00:00Z"], now)).toBe(2);
    expect(nudgesRemaining(["2026-11-13T11:00:00Z", "2026-11-13T08:00:00Z", "2026-11-12T13:00:00Z"], now)).toBe(0);
    // Older than 24 hours no longer counts.
    expect(nudgesRemaining(["2026-11-13T11:00:00Z", "2026-11-13T08:00:00Z", "2026-11-12T11:59:00Z"], now)).toBe(1);
    expect(nudgesRemaining(Array(5).fill("2026-11-13T11:00:00Z"), now)).toBe(0);
    expect(migration).toMatch(/interval '24 hours'\) >= 3/);
  });
});

describe("database errors", () => {
  it("map to plain messages, exactly (inviter_partner_limit is not partner_limit)", () => {
    expect(accountabilityErrorMessage("partner_limit")).toMatch(/You already have 3 partners/);
    expect(accountabilityErrorMessage("inviter_partner_limit")).toMatch(/Your friend already has 3 partners/);
    expect(accountabilityErrorMessage("invite_expired")).toMatch(/expired/);
    expect(accountabilityErrorMessage("new row violates row-level security policy")).toBeNull();
    expect(accountabilityErrorMessage(undefined)).toBeNull();
    expect(accountabilityErrorMessage("constructor")).toBeNull();
  });
});
