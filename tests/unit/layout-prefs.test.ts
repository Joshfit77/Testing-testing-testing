import { describe, expect, it } from "vitest";
import type { PrimaryGoal } from "@/lib/domain/types";
import { DEFAULT_HIDDEN_HOME, defaultHomeOrder, HOME_MODULES, homeLayout, isMinor, NUTRITION_SECTIONS, parseLayoutPrefs, sectionLayout, TRAIN_SECTIONS, type HomeProfile } from "@/lib/layout-prefs";

const base: HomeProfile = { goal: null, experience: null, daysPerWeek: 4, sessionMinutes: 45, faithEnabled: true, homeScripture: true };

describe("Home layout by member", () => {
  it("starts every member with today's workout, nutrition and Faith", () => {
    expect(defaultHomeOrder(base).slice(0, 3)).toEqual(["workout", "nutrition", "faith"]);
  });
  const goals: (PrimaryGoal | null)[] = [null, "lose_fat", "general_health", "build_muscle", "build_strength", "improve_conditioning", "athletic_performance", "combat_sports"];
  it.each(goals)("puts today's workout first for goal %s, on any schedule and with Faith on or off", (goal) => {
    for (const schedule of [{ daysPerWeek: 4, sessionMinutes: 45 }, { daysPerWeek: 3, sessionMinutes: 25 }, { daysPerWeek: null, sessionMinutes: null }]) {
      for (const faithEnabled of [true, false]) {
        const p = { ...base, ...schedule, goal, faithEnabled };
        expect(defaultHomeOrder(p)[0]).toBe("workout");
        expect(homeLayout(p, parseLayoutPrefs(null))[0]).toBe("workout");
      }
    }
  });
  it("puts nutrition straight after the workout for fat loss and general health", () => {
    expect(defaultHomeOrder({ ...base, goal: "lose_fat" }).slice(0, 2)).toEqual(["workout", "nutrition"]);
    expect(defaultHomeOrder({ ...base, goal: "general_health" }).slice(0, 2)).toEqual(["workout", "nutrition"]);
  });
  it("raises recovery for muscle, strength and athletes", () => {
    for (const goal of ["build_muscle", "combat_sports", "athletic_performance"] as const) {
      const order = defaultHomeOrder({ ...base, goal });
      expect(order.indexOf("sleep")).toBeLessThan(order.indexOf("verse"));
    }
  });
  it("lists every module in every default order, with quick actions last", () => {
    for (const goal of goals) {
      const order = defaultHomeOrder({ ...base, goal });
      expect([...order].sort()).toEqual([...HOME_MODULES].sort());
      expect(order.at(-1)).toBe("quick");
    }
  });
  it("leaves the duplicate quick-actions module off a new member's Home", () => {
    expect(DEFAULT_HIDDEN_HOME).toEqual(["quick"]);
    for (const goal of goals) expect(homeLayout({ ...base, goal }, parseLayoutPrefs(null))).not.toContain("quick");
    expect(homeLayout({ ...base, daysPerWeek: 3, sessionMinutes: 20 }, parseLayoutPrefs({ faith: { hidden: ["themes"] } }))).not.toContain("quick");
  });
  it("keeps quick actions exactly where a member saved them", () => {
    const saved = parseLayoutPrefs({ home: { order: ["workout", "quick", "nutrition"], hidden: [] } });
    expect(homeLayout(base, saved).slice(0, 3)).toEqual(["workout", "quick", "nutrition"]);
    // Saved with other modules hidden: quick actions stay visible.
    expect(homeLayout(base, parseLayoutPrefs({ home: { order: ["faith"], hidden: ["sleep"] } }))).toContain("quick");
  });
  it("moves Faith last, never removes it, when Faith was switched off in onboarding", () => {
    const order = defaultHomeOrder({ ...base, faithEnabled: false });
    expect(order).toHaveLength(9);
    expect(order.slice(-3)).toEqual(["faith", "verse", "quick"]);
  });
  it("applies the member's own order and hidden modules, appends new modules, and never hides the workout", () => {
    const layout = homeLayout(base, { home: { order: ["faith", "nutrition"], hidden: ["sleep", "workout"] } });
    expect(layout.slice(0, 2)).toEqual(["faith", "nutrition"]);
    expect(layout).toContain("workout");
    expect(layout).not.toContain("sleep");
    expect(layout).toHaveLength(8);
  });
  it("hides the verse when the Scripture-on-Home setting is off", () => {
    expect(homeLayout({ ...base, homeScripture: false }, {})).not.toContain("verse");
  });
});

describe("stored layout preferences", () => {
  it("keeps only well-formed, known entries", () => {
    expect(parseLayoutPrefs(null)).toEqual({ home: { hidden: ["quick"] } });
    expect(parseLayoutPrefs("junk")).toEqual({ home: { hidden: ["quick"] } });
    expect(parseLayoutPrefs({ home: { order: ["quick", "bogus", "quick"], hidden: "no" }, faith: { hidden: ["themes", 3] } })).toEqual({ home: { order: ["quick"], hidden: ["quick"] }, faith: { hidden: ["themes"] } });
    expect(parseLayoutPrefs({ home: { order: ["quick"], hidden: [] } })).toEqual({ home: { order: ["quick"], hidden: [] } });
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

describe("Train and Nutrition sections", () => {
  it("keeps only known Train and Nutrition entries, de-duplicated", () => {
    const p = parseLayoutPrefs({ train: { order: ["tools", "run", "run", "nope"], hidden: ["calendar", 7] }, nutrition: { hidden: ["water", "budget"] }, faith: 3 });
    expect(p.train).toEqual({ order: ["tools", "run"], hidden: ["calendar"] });
    expect(p.nutrition).toEqual({ hidden: ["water", "budget"] });
    expect(parseLayoutPrefs({ train: { order: [] } }).train).toBeUndefined();
  });
  it("orders a tab's sections the member's way, appends the rest in their default place, and drops hidden ones", () => {
    expect(sectionLayout(TRAIN_SECTIONS, undefined)).toEqual([...TRAIN_SECTIONS]);
    expect(sectionLayout(TRAIN_SECTIONS, { order: ["tools", "exercises"], hidden: ["run"] })).toEqual(["tools", "exercises", "programs", "calendar"]);
    expect(sectionLayout(NUTRITION_SECTIONS, { hidden: ["relog", "water", "tools"] })).toEqual(["budget", "nutrients", "week", "weight", "targets", "saved"]);
  });
  it("never hides a section the tab always shows", () => {
    expect(sectionLayout(["a", "b", "c"] as const, { hidden: ["a", "b"] }, ["a"])).toEqual(["a", "c"]);
  });
});
