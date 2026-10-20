import { describe, expect, it } from "vitest";
import { MAIN_TABS, activeTab, isTabActive } from "@/components/shell/nav-config";

describe("bottom navigation", () => {
  it("has exactly five tabs in the specified order", () => {
    expect(MAIN_TABS.map((i) => i.label)).toEqual(["Home", "Train", "Run", "Food", "Faith"]);
    expect(MAIN_TABS.map((i) => i.href)).toEqual(["/home", "/train", "/run", "/nutrition", "/faith"]);
  });
  it("lights up the owning tab for nested routes", () => {
    expect(activeTab("/train/exercises/back-squat")?.label).toBe("Train");
    expect(activeTab("/train/programs/foo")?.label).toBe("Train");
    expect(activeTab("/train/workout")?.label).toBe("Train");
    expect(activeTab("/nutrition/supplements")?.label).toBe("Food");
    expect(activeTab("/run/history")?.label).toBe("Run");
    expect(activeTab("/faith")?.label).toBe("Faith");
  });
  it("keeps My Progress and the calendar under Home", () => {
    expect(activeTab("/progress")?.label).toBe("Home");
    expect(activeTab("/progress/badges")?.label).toBe("Home");
    expect(activeTab("/calendar")?.label).toBe("Home");
  });
  it("leaves Coach and Profile without a tab and avoids prefix collisions", () => {
    expect(activeTab("/coach")).toBeNull();
    expect(activeTab("/profile/billing")).toBeNull();
    expect(isTabActive("/training", MAIN_TABS[1]!)).toBe(false);
    expect(isTabActive("/home", MAIN_TABS[1]!)).toBe(false);
  });
});
