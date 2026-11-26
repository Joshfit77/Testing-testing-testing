import { describe, expect, it } from "vitest";
import {
  ACTIVE_PRIVACY_OPTIONS,
  DEFAULT_PRIVACY,
  FRIENDS_NOT_SHARED_NOTE,
  friendInviteShareText,
  friendsErrorMessage,
  initials,
  inviteUrl,
  isActivePrivacyKey,
  normalizeSearch,
  normalizeUsername,
  parseFriendProfile,
  parseOverview,
  parseSearch,
  PRIVACY_OPTIONS,
  usernameProblem,
} from "@/lib/domain/friends";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("friends: usernames", () => {
  it("normalizes what a member types", () => {
    expect(normalizeUsername("  @Jordan_22 ")).toBe("jordan_22");
  });
  it("accepts 3 to 20 letters, digits and underscores", () => {
    for (const ok of ["abc", "jordan_22", "a".repeat(20), "@Sam"]) expect(usernameProblem(ok), ok).toBeNull();
  });
  it("refuses short, long and odd names, and names that pass for staff", () => {
    for (const bad of ["ab", "a".repeat(21), "jo dan", "jo-dan", "jörg", "j.d", "admin", "Support", "narrowgate", "narrowgate_team", "narrow_gate_fitness", "coach"]) expect(usernameProblem(bad), bad).not.toBeNull();
  });
  it("a search needs at least three valid characters", () => {
    expect(normalizeSearch("jo")).toBeNull();
    expect(normalizeSearch("jo%")).toBeNull();
    expect(normalizeSearch("@Jor")).toBe("jor");
  });
});

describe("friends: privacy defaults", () => {
  it("weight, nutrition, Faith and personal records start private", () => {
    expect(DEFAULT_PRIVACY).toMatchObject({ show_body: false, show_nutrition: false, show_faith: false, show_records: false });
  });
  it("every sensitive switch is off by default and every switch has a default", () => {
    for (const o of PRIVACY_OPTIONS) {
      expect(typeof DEFAULT_PRIVACY[o.key], o.key).toBe("boolean");
      if (o.sensitive) expect(DEFAULT_PRIVACY[o.key], o.key).toBe(false);
    }
  });
  it("a new member shares no activity: workouts start off, like everything else a friend could see", () => {
    expect(DEFAULT_PRIVACY.show_workouts).toBe(false);
    // The only defaults that are on among the switches a member is offered: being findable, and having a profile
    // (which by itself shows a friend the username and name only).
    expect(ACTIVE_PRIVACY_OPTIONS.filter((o) => DEFAULT_PRIVACY[o.key]).map((o) => o.key).sort()).toEqual(["profile_visible", "searchable"]);
  });
  it("only the switches something reads are offered; the rest are kept but inactive", () => {
    expect(ACTIVE_PRIVACY_OPTIONS.map((o) => o.key).sort()).toEqual(["profile_visible", "searchable", "show_workouts"]);
    expect(PRIVACY_OPTIONS.filter((o) => !o.active).map((o) => o.key).sort()).toEqual(["show_body", "show_faith", "show_in_leaderboards", "show_nutrition", "show_records"]);
    // No sensitive switch is offered.
    expect(ACTIVE_PRIVACY_OPTIONS.some((o) => o.sensitive)).toBe(false);
    for (const o of PRIVACY_OPTIONS) expect(isActivePrivacyKey(o.key), o.key).toBe(o.active);
    // Every key still has an option and a default, so the stored columns keep working.
    expect(PRIVACY_OPTIONS.map((o) => o.key).sort()).toEqual(Object.keys(DEFAULT_PRIVACY).sort());
  });
  it("the screen says what is not shared at all, and no option says a block or decline can't be detected", () => {
    expect(FRIENDS_NOT_SHARED_NOTE).toBe("Weight, measurements, nutrition and Faith activity are not shared with friends at all.");
    for (const o of ACTIVE_PRIVACY_OPTIONS) expect(`${o.label} ${o.detail}`, o.key).not.toMatch(/can't tell|never revealed|on by default/i);
  });
});

describe("friends: reading what the database returned", () => {
  it("a friend's profile keeps only the shareable fields", () => {
    const p = parseFriendProfile({ user_id: A, username: "sam", display_name: "Sam", since: "2026-11-01T00:00:00Z", profile_visible: true, workouts_last_7_days: 3, streak_days: 2, streak_weeks: 5, weight_kg: 81, email: "sam@example.com", journal: "private" });
    expect(p).toEqual({ userId: A, username: "sam", displayName: "Sam", since: "2026-11-01T00:00:00Z", profileVisible: true, workoutsLast7Days: 3, streakDays: 2, streakWeeks: 5 });
  });
  it("a hidden profile shows the name only, even if numbers were sent", () => {
    const p = parseFriendProfile({ user_id: A, username: "sam", since: "2026-11-01T00:00:00Z", profile_visible: false, workouts_last_7_days: 3, streak_days: 2, streak_weeks: 5 });
    expect(p).toEqual({ userId: A, username: "sam", displayName: "sam", since: "2026-11-01T00:00:00Z", profileVisible: false });
  });
  it("rejects anything that isn't a profile", () => {
    for (const bad of [null, "x", [], {}, { user_id: "nope", username: "sam", since: "x" }]) expect(parseFriendProfile(bad)).toBeNull();
  });
  it("drops wrong-typed numbers", () => {
    const p = parseFriendProfile({ user_id: A, username: "sam", since: "2026-11-01T00:00:00Z", profile_visible: true, workouts_last_7_days: "3", streak_days: -1, streak_weeks: 2 });
    expect(p?.workoutsLast7Days).toBeUndefined();
    expect(p?.streakDays).toBeUndefined();
  });
  it("the overview keeps well-formed entries only", () => {
    const o = parseOverview({
      friends: [{ user_id: A, username: "sam", display_name: "Sam", since: "2026-11-01T00:00:00Z", email: "x" }, { username: "no_id" }],
      incoming: [{ request_id: B, user_id: A, username: "sam", at: "2026-11-02T00:00:00Z" }, { request_id: "bad" }],
      outgoing: "nope",
      blocked: [{ user_id: A, username: null }],
    });
    expect(o).toEqual({
      friends: [{ userId: A, username: "sam", displayName: "Sam", since: "2026-11-01T00:00:00Z" }],
      incoming: [{ requestId: B, userId: A, username: "sam", at: "2026-11-02T00:00:00Z" }],
      outgoing: [],
      blocked: [{ userId: A, username: null }],
    });
    expect(parseOverview(null)).toBeNull();
  });
  it("search results keep usernames and a known relation only", () => {
    expect(parseSearch([{ user_id: A, username: "sam", relation: "none", display_name: "Sam Smith" }, { user_id: B, username: "kim", relation: "enemy" }])).toEqual([{ userId: A, username: "sam", relation: "none" }]);
  });
});

describe("friends: invites and small helpers", () => {
  it("the invite link carries the code only", () => {
    expect(inviteUrl("https://example.com/", "ABCDEFGHJK")).toBe("https://example.com/friends/invite/ABCDEFGHJK");
    expect(friendInviteShareText("https://example.com/friends/invite/ABCDEFGHJK", "2026-11-23T10:00:00Z")).toContain("valid until Nov 23");
  });
  it("initials", () => {
    expect(initials("Jordan Smith")).toBe("JS");
    expect(initials("jordan_22")).toBe("J2");
    expect(initials("sam")).toBe("SA");
    expect(initials("")).toBe("?");
  });
  it("database errors become plain sentences; unknown ones don't", () => {
    expect(friendsErrorMessage("username_taken")).toMatch(/taken/);
    expect(friendsErrorMessage("user_not_found")).toBe("That member wasn't found.");
    expect(friendsErrorMessage("relation \"x\" does not exist")).toBeNull();
    expect(friendsErrorMessage("constructor")).toBeNull();
  });
});
