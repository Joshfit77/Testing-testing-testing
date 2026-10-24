import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import bsb from "../src/data/bsb-passages.json";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The opening plays on every full load (fresh launch, reload, reopening) and never on in-app navigation.
 * The rest of the suite switches it off with the test flag (playwright.config.ts); these tests remove it.
 */
const FLAG = "ngf.e2e.noIntro";
const VERSE = (bsb as { passages: Record<string, string> }).passages["Matthew 7:13–14"]!;
const NONE: BrowserContextOptions["storageState"] = { cookies: [], origins: [] };

const opening = (page: Page) => page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
const introState = (page: Page) => page.evaluate(() => document.documentElement.dataset.intro);

async function freshContext(browser: Browser, opts: BrowserContextOptions = {}) {
  return browser.newContext({ ...opts, storageState: NONE });
}

/** A context with the intro switched off, as in the rest of the suite. */
async function quietContext(browser: Browser, opts: BrowserContextOptions = {}) {
  const origin = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin;
  return browser.newContext({ ...opts, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: FLAG, value: "1" }] }] } });
}

/** Resolves when every animation in the overlay that has an end has finished, so the final frame can be checked. */
async function waitForAnimations(page: Page, selector: string) {
  await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`${sel} missing`);
    await Promise.all(el.getAnimations().map((a) => a.finished));
  }, selector);
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe("opening gate", () => {
  test("plays on every reload and fresh launch, never on tab navigation; Enter, Skip, Escape and the timer all end it", async ({ page, context }) => {
    test.setTimeout(240_000);
    await signUpAndConfirm(page, uniqueEmail("gate"));
    await completeOnboarding(page);
    // From onboarding to Home is in-app navigation: no intro.
    await expect(opening(page)).toHaveCount(0);
    await page.evaluate((f) => localStorage.removeItem(f), FLAG);

    // Reload: it plays, with the verse. Enter Narrow Gate moves the camera through the doorway: the scene grows,
    // the light fills the screen, then the app fades in.
    await page.reload();
    const o = opening(page);
    await expect(o).toBeVisible();
    await expect(o.getByText("Matthew 7:13–14 (BSB)")).toBeVisible();
    await expect(o.getByTestId("animated-narrow-door")).toBeVisible();
    await o.getByRole("button", { name: "Enter Narrow Gate" }).click();
    expect(await introState(page)).toBe("entering");
    // A move, not a cut: right after the press the light has not yet filled the screen.
    const first = await page.evaluate(() => Number(getComputedStyle(document.querySelector(".ngo-white")!).opacity));
    expect(first).toBeLessThan(0.3);
    let maxScale = 1;
    let maxWhite = 0;
    for (let i = 0; i < 30 && (await introState(page)) === "entering"; i++) {
      const m = await page.evaluate(() => {
        const push = document.querySelector(".ngs-push");
        const white = document.querySelector(".ngo-white");
        return push && white ? { scale: new DOMMatrix(getComputedStyle(push).transform).a, white: Number(getComputedStyle(white).opacity) } : null;
      });
      if (m) {
        maxScale = Math.max(maxScale, m.scale);
        maxWhite = Math.max(maxWhite, m.white);
      }
      await page.waitForTimeout(40);
    }
    expect(maxScale).toBeGreaterThan(2.5);
    expect(maxWhite).toBeGreaterThan(0.9);
    await expect(o).toHaveCount(0);
    expect(await introState(page)).toBe("done");

    // The five tabs: in-app navigation never replays it, and the app is usable underneath.
    const nav = page.getByRole("navigation", { name: "Main sections" }).last();
    for (const [name, url] of [
      ["Train", /\/train/],
      ["Run", /\/run/],
      ["Food", /\/nutrition/],
      ["Faith", /\/faith/],
      ["Home", /\/home/],
    ] as const) {
      await nav.getByRole("link", { name }).click();
      await page.waitForURL(url);
      await expect(o).toHaveCount(0);
      expect(await introState(page)).toBe("done");
    }

    // Reload again: plays again; Skip dismisses.
    await page.reload();
    await expect(o).toBeVisible();
    await o.getByRole("button", { name: "Skip intro" }).click();
    await expect(o).toHaveCount(0);

    // Escape dismisses.
    await page.reload();
    await expect(o).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(o).toHaveCount(0);

    // Left alone it ends by itself after about five seconds, then the app works.
    await page.reload();
    await expect(o).toBeVisible();
    const shownAt = Date.now();
    await expect(o).toHaveCount(0, { timeout: 9000 });
    const shownFor = Date.now() - shownAt;
    expect(shownFor).toBeGreaterThan(3500);
    expect(shownFor).toBeLessThan(7000);
    await nav.getByRole("link", { name: "Train" }).click();
    await page.waitForURL(/\/train/);

    // Reopening the app (a new window on the same device, still signed in) plays it too.
    const again = await context.newPage();
    await again.goto("/home");
    await expect(opening(again)).toBeVisible();
    await again.close();
  });

  test("never interrupts a workout or a GPS recording in progress, and stays off sign-in and legal pages", async ({ browser }) => {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    await page.goto("/legal/privacy");
    expect(await introState(page)).toBe("off");
    await expect(opening(page)).toHaveCount(0);
    await page.goto("/login");
    expect(await introState(page)).toBe("off");

    await page.evaluate(() => localStorage.setItem("ngf.workout.draft.user-1", JSON.stringify({ name: "Day A" })));
    await page.goto("/");
    expect(await introState(page)).toBe("off");
    await expect(opening(page)).toHaveCount(0);
    await page.evaluate(() => localStorage.removeItem("ngf.workout.draft.user-1"));

    const track = (status: string) => JSON.stringify({ track: { version: 2, status, startedAt: Date.now() - 600_000 }, guidedDayId: null });
    await page.evaluate((t) => localStorage.setItem("run.recording.user-1", t), track("recording"));
    await page.goto("/");
    expect(await introState(page)).toBe("off");
    await page.evaluate((t) => localStorage.setItem("run.recording.user-1", t), track("finished"));
    await page.goto("/");
    expect(await introState(page)).toBe("play");
    await expect(opening(page)).toBeVisible();
    await ctx.close();
  });

  const SIZES = [
    { name: "iPhone SE", width: 375, height: 667, dpr: 2 },
    { name: "iPhone SE (1st gen)", width: 320, height: 568, dpr: 2 },
    { name: "iPhone 15", width: 393, height: 852, dpr: 3 },
    { name: "iPhone 15 Pro Max", width: 430, height: 932, dpr: 3 },
    { name: "iPhone landscape", width: 844, height: 390, dpr: 3 },
    { name: "iPad", width: 820, height: 1180, dpr: 2 },
    { name: "desktop", width: 1440, height: 900, dpr: 1 },
  ];

  for (const s of SIZES) {
    test(`${s.name}: the door opens and Matthew 7:13–14 is fully readable`, async ({ browser }) => {
      const ctx = await freshContext(browser, { viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr, isMobile: s.width < 1000, hasTouch: s.width < 1000 });
      const page = await ctx.newPage();
      await page.goto("/");
      const o = opening(page);
      await expect(o).toBeVisible();

      // The door is a real 3D swing: closed at first, rotated 80° (inward, about its hinge) at the end.
      const door = o.getByTestId("gate-door");
      const swings = await door.evaluate((el) => el.getAnimations().map((a) => (a.effect as KeyframeEffect).getKeyframes().map((k) => String(k.transform))));
      expect(swings).toHaveLength(1);
      expect(swings[0]![0]).toMatch(/rotateY\(0(deg)?\)/);
      expect(swings[0]!.at(-1)).toMatch(/rotateY\(80deg\)/);
      await waitForAnimations(page, "[data-testid=gate-door]");
      const m = await door.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
      expect(m.m11).toBeCloseTo(Math.cos((80 * Math.PI) / 180), 3);
      expect(m.m13).toBeCloseTo(-Math.sin((80 * Math.PI) / 180), 3);

      // The verse: the verified BSB text, fully on screen, legible, not covered by the buttons.
      await waitForAnimations(page, ".ngo-verse");
      const quote = o.locator("blockquote");
      await expect(quote).toHaveText(`“${VERSE}”`);
      const vp = page.viewportSize()!;
      // The words never cover the gate: the logo sits above the arch, the verse below the doorway.
      const scene = (await o.locator(".ngs-base").boundingBox())!;
      const brand = (await o.locator(".ngo-brand").boundingBox())!;
      const verseBox = (await quote.boundingBox())!;
      if (s.width < s.height) {
        // 0.205: the top of the keystone over the arch.
        expect(brand.y + brand.height).toBeLessThanOrEqual(scene.y + 0.205 * scene.height + 4);
        expect(verseBox.y).toBeGreaterThanOrEqual(scene.y + 0.6 * scene.height - 6);
      }
      const q = (await quote.boundingBox())!;
      const cap = (await o.getByText("Matthew 7:13–14 (BSB)").boundingBox())!;
      const enter = (await o.getByRole("button", { name: "Enter Narrow Gate" }).boundingBox())!;
      const skip = (await o.getByRole("button", { name: "Skip intro" }).boundingBox())!;
      for (const b of [q, cap, enter, skip]) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
        expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
      }
      expect(overlaps(skip, q) || overlaps(skip, cap) || overlaps(skip, enter)).toBe(false);
      expect(overlaps(enter, q) || overlaps(enter, cap)).toBe(false);
      const style = await quote.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { size: parseFloat(cs.fontSize), color: cs.color, opacity: getComputedStyle(el.parentElement!).opacity };
      });
      expect(style.size).toBeGreaterThanOrEqual(15);
      expect(style.opacity).toBe("1");
      expect(style.color).toBe("rgb(242, 237, 226)");
      // Buttons are comfortable touch targets without being oversized.
      expect(enter.height).toBeGreaterThanOrEqual(44);
      expect(enter.height).toBeLessThanOrEqual(56);
      expect(skip.height).toBeGreaterThanOrEqual(44);
      await ctx.close();
    });
  }

  test("reduced motion (device or in-app setting): nothing moves, the verse is readable, it still ends by itself", async ({ browser }) => {
    for (const how of ["device", "in-app"] as const) {
      const ctx = await freshContext(browser, how === "device" ? { reducedMotion: "reduce" } : {});
      const page = await ctx.newPage();
      if (how === "in-app") {
        await page.goto("/legal/privacy");
        await page.evaluate(() => localStorage.setItem("ngf.reduceMotion", "1"));
      }
      await page.goto("/");
      const o = opening(page);
      await expect(o).toBeVisible();
      // Only fades: no animation in the overlay changes position, size or rotation. The global reduced-motion rule
      // turns every transition into a 0.01 ms one (WebKit lists the focus ring's), which can't be seen: skip those.
      const props = await page.evaluate(() =>
        document
          .querySelector("[data-testid=opening-overlay]")!
          .getAnimations({ subtree: true })
          .filter((a) => Number(a.effect!.getTiming().duration) > 1)
          .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)))),
      );
      expect(props).toContain("opacity");
      expect(props.filter((p) => !["opacity", "visibility", "pointerEvents"].includes(p))).toEqual([]);
      // The door is shown open from the start.
      const m = await o.getByTestId("gate-door").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
      expect(m.m11).toBeCloseTo(Math.cos((80 * Math.PI) / 180), 3);
      await expect(o.locator("blockquote")).toHaveText(`“${VERSE}”`);
      await expect(o).toHaveCount(0, { timeout: 9000 });
      await ctx.close();
    }
  });

  test("screen readers and keyboards: a labelled dialog, focus inside it, the page beneath inert", async ({ browser }) => {
    const ctx = await freshContext(browser);
    const page = await ctx.newPage();
    await page.goto("/");
    const o = opening(page);
    await expect(o).toBeVisible();
    await expect(o).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("[data-testid=opening-overlay]")))).toBe(true);
    // Tab cycles between the two buttons (once Enter Narrow Gate has appeared).
    await expect(o.getByRole("button", { name: "Enter Narrow Gate" })).toBeVisible();
    const visited = new Set<string>();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      visited.add(await page.evaluate(() => (document.activeElement?.closest("[data-testid=opening-overlay]") ? document.activeElement.textContent ?? "" : "OUTSIDE")));
    }
    expect(visited.has("OUTSIDE")).toBe(false);
    expect(visited).toEqual(new Set(["Skip intro", "Enter Narrow Gate"]));
    await page.keyboard.press("Enter");
    await expect(o).toHaveCount(0);
    // Nothing beneath stays inert.
    expect(await page.evaluate(() => Array.from(document.body.children).some((el) => (el as HTMLElement).inert))).toBe(false);
    await ctx.close();
  });

  test("welcome screen: centred gate, brand, the verse beneath, Start free and Sign in, nothing clipped", async ({ browser }) => {
    for (const s of [SIZES[0]!, SIZES[1]!, SIZES[2]!, SIZES[3]!, SIZES[6]!]) {
      const ctx = await quietContext(browser, { viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Narrow Gate Fitness" })).toBeVisible();
      const gate = page.locator("main [data-testid=animated-narrow-door]");
      await expect(gate).toBeVisible();
      const g = (await gate.boundingBox())!;
      expect(Math.abs(g.x + g.width / 2 - s.width / 2)).toBeLessThan(2);
      const quote = page.locator("main blockquote");
      await expect(quote).toHaveText(`“${VERSE}”`);
      expect((await quote.boundingBox())!.y).toBeGreaterThan(g.y + g.height);
      await expect(page.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");
      // On every current iPhone (667 pt tall and up) both choices are on the first screen, without scrolling.
      if (s.height >= 667) {
        const start = (await page.getByRole("link", { name: "Start free" }).boundingBox())!;
        expect(start.y + start.height).toBeLessThanOrEqual(s.height);
      }
      await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
      // No sideways scrolling and no text cut off in the hero.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(s.width);
      const clipped = await page.evaluate(() =>
        Array.from(document.querySelectorAll("header *, main section:first-of-type *"))
          .filter((el) => el.children.length === 0 && el.textContent?.trim())
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible")
          .map((el) => el.textContent),
      );
      expect(clipped).toEqual([]);
      // The brand never wraps onto two lines.
      const brand = page.getByRole("heading", { level: 1 }).locator("span").first();
      expect((await brand.boundingBox())!.height).toBeLessThan(40);
      await page.getByRole("link", { name: "Start free" }).click();
      await page.waitForURL(/\/signup/);
      await ctx.close();
    }
  });
});
