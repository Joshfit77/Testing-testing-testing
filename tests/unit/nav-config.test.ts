import { describe, expect, it } from "vitest";
import { MAIN_TABS, activeTab, isTabActive } from "@/components/shell/nav-config";

describe("bottom navigation", () => {
  it("has exactly five tabs in the specified order", () => {
    expect(MAIN_TABS.map((i) => i.label)).toEqual(["Home", "Train", "Nutrition", "Faith", "You"]);
    expect(MAIN_TABS.map((i) => i.href)).toEqual(["/home", "/train", "/nutrition", "/faith", "/profile"]);
  });
  it("lights up the owning tab for nested routes", () => {
    expect(activeTab("/train/exercises/back-squat")?.label).toBe("Train");
    expect(activeTab("/train/programs/foo")?.label).toBe("Train");
    expect(activeTab("/train/workout")?.label).toBe("Train");
    expect(activeTab("/nutrition/supplements")?.label).toBe("Nutrition");
    expect(activeTab("/faith")?.label).toBe("Faith");
  });
  it("keeps running under Train, and My Progress, the AI Coach and settings under You", () => {
    expect(activeTab("/run")?.label).toBe("Train");
    expect(activeTab("/run/record")?.label).toBe("Train");
    expect(activeTab("/progress")?.label).toBe("You");
    expect(activeTab("/progress/badges")?.label).toBe("You");
    expect(activeTab("/profile/billing")?.label).toBe("You");
    expect(activeTab("/coach")?.label).toBe("You");
  });
  it("keeps the calendar, the plan and search under Home, and avoids prefix collisions", () => {
    expect(activeTab("/calendar")?.label).toBe("Home");
    expect(activeTab("/plan")?.label).toBe("Home");
    expect(activeTab("/search")?.label).toBe("Home");
    expect(activeTab("/admin")).toBeNull();
    expect(isTabActive("/training", MAIN_TABS[1]!)).toBe(false);
    expect(isTabActive("/home", MAIN_TABS[1]!)).toBe(false);
  });
});
