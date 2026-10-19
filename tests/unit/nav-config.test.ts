import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActive } from "@/components/shell/nav-config";

describe("bottom navigation", () => {
  it("has Programs and Exercises as their own tabs", () => {
    const tabs = NAV_ITEMS.filter((i) => i.primaryMobile).map((i) => i.label);
    expect(tabs).toEqual(["Home", "Programs", "Exercises", "Food", "Coach", "Progress"]);
  });
  it("highlights the most specific tab", () => {
    expect(isActive("/train/exercises", "/train/exercises")).toBe(true);
    expect(isActive("/train/exercises/back-squat", "/train/exercises")).toBe(true);
    expect(isActive("/train/exercises", "/train")).toBe(false);
    expect(isActive("/train/programs/foo", "/train")).toBe(true);
    expect(isActive("/train", "/train")).toBe(true);
    expect(isActive("/home", "/train")).toBe(false);
  });
});
