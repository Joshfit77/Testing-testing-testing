import { canGoBackInApp, isRememberable, lastHrefFor, previousInAppHref, readScroll, recordNavigation, rememberLocation, saveScroll, scrollKey, sectionFor, shouldGoBackTo } from "@/lib/nav-memory";
import { isCovered, isTextEntry, keyboardInset } from "@/lib/keyboard";
import { choiceFromFavorite, isFavoritableKey, logItemFor } from "@/lib/domain/food-favorites";

vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));

beforeEach(() => sessionStorage.clear());

describe("section memory", () => {
  it("maps paths to their main tab", () => {
    expect(sectionFor("/train/exercises/back-squat")).toBe("/train");
    expect(sectionFor("/progress/overview")).toBe("/home");
    expect(sectionFor("/nutrition")).toBe("/nutrition");
    expect(sectionFor("/coach")).toBeNull();
  });

  it("returns to the last screen and filters used in a section", () => {
    expect(lastHrefFor("/train")).toBe("/train");
    rememberLocation("/train/exercises", "q=squat&equipment=barbell");
    expect(lastHrefFor("/train", "/nutrition")).toBe("/train/exercises?q=squat&equipment=barbell");
    // Tapping the tab you're in goes to its root.
    expect(lastHrefFor("/train", "/train/exercises")).toBe("/train");
  });

  it("never restores live sessions or edit forms", () => {
    rememberLocation("/train/programs", "goal=strength");
    rememberLocation("/train/workout", "");
    expect(isRememberable("/train/workout")).toBe(false);
    expect(isRememberable("/run/activities/abc/edit")).toBe(false);
    expect(lastHrefFor("/train", "/home")).toBe("/train/programs?goal=strength");
  });

  it("ignores tampered values", () => {
    sessionStorage.setItem("ngf.nav.last./train", "//evil.example/train");
    expect(lastHrefFor("/train", "/home")).toBe("/train");
    sessionStorage.setItem("ngf.nav.last./train", "/nutrition?date=2026-01-01");
    expect(lastHrefFor("/train", "/home")).toBe("/train");
  });
});

describe("in-app history", () => {
  it("only goes back when the previous screen is in the app", () => {
    recordNavigation("/train/exercises/back-squat", "load");
    expect(canGoBackInApp()).toBe(false);
    recordNavigation("/train/exercises/front-squat", "push");
    expect(canGoBackInApp()).toBe(true);
    expect(previousInAppHref()).toBe("/train/exercises/back-squat");
    recordNavigation("/train/exercises/back-squat", "pop");
    expect(canGoBackInApp()).toBe(false);
  });

  it("goes back to a parent list only when that's where you came from", () => {
    recordNavigation("/train/exercises?q=row", "load");
    recordNavigation("/train/exercises/barbell-row", "push");
    expect(shouldGoBackTo("/train/exercises")).toBe(true);
    expect(shouldGoBackTo("/train/programs")).toBe(false);
  });

  it("a reload keeps the stack", () => {
    recordNavigation("/home", "load");
    recordNavigation("/nutrition", "push");
    recordNavigation("/nutrition", "load");
    expect(canGoBackInApp()).toBe(true);
  });
});

describe("scroll positions", () => {
  it("stores per pathname + search", () => {
    saveScroll(scrollKey("/train/exercises", "q=squat"), 840);
    expect(readScroll("/train/exercises?q=squat")).toBe(840);
    expect(readScroll("/train/exercises")).toBeNull();
    saveScroll("/train/exercises?q=squat", 0);
    expect(readScroll("/train/exercises?q=squat")).toBeNull();
  });
});

describe("keyboard helpers", () => {
  it("measures the covered height and ignores toolbar wobble", () => {
    expect(keyboardInset(800, { height: 460, offsetTop: 0 })).toBe(340);
    expect(keyboardInset(800, { height: 740, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, null)).toBe(0);
  });

  it("knows which elements open a keyboard and when one is covered", () => {
    const text = document.createElement("input");
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isTextEntry(text)).toBe(true);
    expect(isTextEntry(box)).toBe(false);
    expect(isTextEntry(document.createElement("textarea"))).toBe(true);
    expect(isCovered({ top: 500, bottom: 540 }, 0, 460)).toBe(true);
    expect(isCovered({ top: 100, bottom: 140 }, 0, 460)).toBe(false);
  });
});

describe("food favorites", () => {
  const basis = { per100: { calories: 100, protein_g: 1, carbs_g: 2, fat_g: 3 } };
  it("accepts only stable keys", () => {
    expect(isFavoritableKey("usda:171477")).toBe(true);
    expect(isFavoritableKey("off:3017620422003")).toBe(true);
    expect(isFavoritableKey("food:6f1c1a52-6d1b-4c55-9d53-0c1b6c1e1f00")).toBe(true);
    expect(isFavoritableKey("custom")).toBe(false);
    expect(isFavoritableKey(null)).toBe(false);
  });

  it("turns rows into pickable foods and log payloads", () => {
    const usda = choiceFromFavorite({ food_key: "usda:171477", name: "Chicken", detail: null, basis, is_estimate: false })!;
    expect(usda).toMatchObject({ kind: "usda", ref: "171477", key: "usda:171477" });
    expect(logItemFor(usda, 150, "g")).toEqual({ source: "usda", fdcId: "171477", quantity: 150, unitId: "g" });
    const off = choiceFromFavorite({ food_key: "off:3017620422003", name: "Spread", detail: "OFF", basis, is_estimate: false })!;
    expect(logItemFor(off, 1, "serving")).toMatchObject({ source: "barcode", code: "3017620422003" });
    expect(choiceFromFavorite({ food_key: "usda:1", name: "Bad", detail: null, basis: { nope: 1 }, is_estimate: false })).toBeNull();
  });
});
