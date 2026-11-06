import { describe, expect, it } from "vitest";
import { defaultHomeOrder, homeLayout, isMinor, parseLayoutPrefs, type HomeProfile } from "@/lib/layout-prefs";

const base: HomeProfile = { goal: null, experience: null, daysPerWeek: 4, sessionMinutes: 45, faithEnabled: true, homeScripture: true };

describe("Home layout by member", () => {
  it("starts every member with today's workout, nutrition, Faith and quick actions", () => {
    expect(defaultHomeOrder(base).slice(0, 4)).toEqual(["workout", "nutrition", "faith", "quick"]);
  });
  it("puts nutrition first for fat loss and general health", () => {
    expect(defaultHomeOrder({ ...base, goal: "lose_fat" })[0]).toBe("nutrition");
    expect(defaultHomeOrder({ ...base, goal: "general_health" })[0]).toBe("nutrition");
  });
  it("raises recovery for muscle and strength, and quick actions (the run) for athletes", () => {
    expect(defaultHomeOrder({ ...base, goal: "build_muscle" }).indexOf("sleep")).toBeLessThan(defaultHomeOrder({ ...base, goal: "build_muscle" }).indexOf("verse"));
    expect(defaultHomeOrder({ ...base, goal: "combat_sports" }).slice(0, 2)).toEqual(["workout", "quick"]);
    expect(defaultHomeOrder({ ...base, goal: "athletic_performance" }).slice(0, 2)).toEqual(["workout", "quick"]);
  });
  it("puts the fast paths first for a short schedule (the busy-parent pattern), whatever the goal", () => {
    expect(defaultHomeOrder({ ...base, goal: "lose_fat", daysPerWeek: 3, sessionMinutes: 25 }).slice(0, 3)).toEqual(["workout", "quick", "nutrition"]);
  });
  it("moves Faith last, never removes it, when Faith was switched off in onboarding", () => {
    const order = defaultHomeOrder({ ...base, faithEnabled: false });
    expect(order.slice(-2)).toEqual(["faith", "verse"]);
    expect(order).toHaveLength(8);
  });
  it("applies the member's own order and hidden modules, appends new modules, and never hides the workout", () => {
    const layout = homeLayout(base, { home: { order: ["faith", "nutrition"], hidden: ["sleep", "workout"] } });
    expect(layout.slice(0, 2)).toEqual(["faith", "nutrition"]);
    expect(layout).toContain("workout");
    expect(layout).not.toContain("sleep");
    expect(layout).toHaveLength(7);
  });
  it("hides the verse when the Scripture-on-Home setting is off", () => {
    expect(homeLayout({ ...base, homeScripture: false }, {})).not.toContain("verse");
  });
});

describe("stored layout preferences", () => {
  it("keeps only well-formed, known entries", () => {
    expect(parseLayoutPrefs(null)).toEqual({});
    expect(parseLayoutPrefs("junk")).toEqual({});
    expect(parseLayoutPrefs({ home: { order: ["quick", "bogus", "quick"], hidden: "no" }, faith: { hidden: ["themes", 3] } })).toEqual({ home: { order: ["quick"] }, faith: { hidden: ["themes"] } });
  });
});

describe("under-18 safeguard", () => {
  it("is true only with a birth year under 18 years ago", () => {
    const now = new Date("2026-11-06T00:00:00Z");
    expect(isMinor(2010, now)).toBe(true);
    expect(isMinor(2008, now)).toBe(false);
    expect(isMinor(null, now)).toBe(false);
  });
});
