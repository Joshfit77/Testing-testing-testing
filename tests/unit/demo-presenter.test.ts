import { beforeEach, describe, expect, it } from "vitest";
import { currentStep, DEMO_INTRO_ONCE_SCRIPT, DEMO_INTRO_SHOWN_KEY, PRESENTER_STEPS, STEP_COUNT } from "@/lib/demo/presenter";

describe("presenter path", () => {
  it("has the 20 stops in the agreed order", () => {
    expect(PRESENTER_STEPS.map((s) => s.title)).toEqual([
      "Opening gate",
      "Home",
      "Programs",
      "Live workout",
      "Exercise demos",
      "AI coach",
      "Nutrition",
      "Food photo",
      "Ingredients",
      "GPS",
      "Progress",
      "Health & recovery",
      "Faith dashboard",
      "Bible",
      "Journeys",
      "Prayer journal",
      "Faith challenges",
      "Notifications",
      "Free vs Pro",
      "Close on Home",
    ]);
    expect(STEP_COUNT).toBe(20);
    PRESENTER_STEPS.forEach((s, i) => expect(s.n).toBe(i + 1));
  });

  it("each stop's own link belongs to that stop", () => {
    for (const s of PRESENTER_STEPS) expect(s.match.test(s.href.split("#")[0]!), s.title).toBe(true);
  });

  it("labels the AI stops as simulated and the hardware stops as previews", () => {
    const label = (t: string) => PRESENTER_STEPS.find((s) => s.title === t)!.label;
    expect(label("AI coach")).toBe("simulated");
    expect(label("Food photo")).toBe("simulated");
    expect(label("GPS")).toBe("preview");
    expect(label("Notifications")).toBe("preview");
  });

  it("keeps the remembered stop while its page shows, follows app navigation, and spots a detour", () => {
    expect(currentStep("/home", 1).step?.n).toBe(1);
    expect(currentStep("/home", 20).step?.n).toBe(20);
    expect(currentStep("/home", null).step?.n).toBe(2);
    expect(currentStep("/faith", 17).step?.n).toBe(17);
    expect(currentStep("/faith", 16).step?.n).toBe(13);
    expect(currentStep("/train/workout", 4)).toEqual({ step: PRESENTER_STEPS[3], offPath: false });
    expect(currentStep("/nutrition/photo", 7).step?.n).toBe(8);
    expect(currentStep("/progress/sleep/night/2026-11-01", 11).step?.n).toBe(12);
    // Not a stop: keep the remembered one and offer the way back.
    expect(currentStep("/profile/preferences", 6)).toEqual({ step: PRESENTER_STEPS[5], offPath: true });
    expect(currentStep("/profile/preferences", null)).toEqual({ step: null, offPath: true });
  });
});

describe("demo opening plays once per tab", () => {
  const run = () => new Function(DEMO_INTRO_ONCE_SCRIPT)();
  beforeEach(() => {
    window.sessionStorage.clear();
    delete document.documentElement.dataset.intro;
  });

  it("lets the first opening play and remembers it", () => {
    document.documentElement.dataset.intro = "play";
    run();
    expect(document.documentElement.dataset.intro).toBe("play");
    expect(window.sessionStorage.getItem(DEMO_INTRO_SHOWN_KEY)).toBe("1");
  });

  it("turns it off on later loads in the same tab", () => {
    window.sessionStorage.setItem(DEMO_INTRO_SHOWN_KEY, "1");
    document.documentElement.dataset.intro = "play";
    run();
    expect(document.documentElement.dataset.intro).toBe("off");
  });

  it("leaves pages where the opening was already off alone, and doesn't use up the one showing", () => {
    document.documentElement.dataset.intro = "off";
    run();
    expect(document.documentElement.dataset.intro).toBe("off");
    expect(window.sessionStorage.getItem(DEMO_INTRO_SHOWN_KEY)).toBeNull();
  });
});
