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
    // A cancelled animation rejects `finished` with an AbortError (the spec's behaviour); it has nothing left to wait
    // for, so it counts as done rather than failing the wait.
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
  }, selector);
}

/** Everything the page went through from its first moment: the opening's states, the most gates ever on the page. */
type GateLog = { states: string[]; arts: string[]; maxGates: number };
async function watchGate(page: Page) {
  await page.addInitScript(() => {
    const log = { states: [] as string[], arts: [] as string[], maxGates: 0 };
    (window as unknown as { __gate: typeof log }).__gate = log;
    // (This runs as the document is created, before it has a root element: watch the document itself.)
    const note = () => {
      const d = document.documentElement;
      if (!d) return;
      const s = d.dataset.intro ?? "";
      if (s && log.states.at(-1) !== s) log.states.push(s);
      const a = d.dataset.introArt ?? "";
      if (a && log.arts.at(-1) !== a) log.arts.push(a);
      log.maxGates = Math.max(log.maxGates, document.querySelectorAll("[data-testid=animated-narrow-door]").length);
    };
    new MutationObserver(note).observe(document, { attributes: true, childList: true, subtree: true });
    const tick = () => {
      note();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () => page.evaluate(() => (window as unknown as { __gate: GateLog }).__gate);
}
/** Enter Narrow Gate, pressed as a person would once it shows. */
async function enterGate(page: Page) {
  const enter = opening(page).getByRole("button", { name: "Enter Narrow Gate" });
  await expect(enter).toBeVisible();
  await enter.click({ force: true });
}
/** After the entrance: no overlay, and no gate anywhere on the page. */
async function inside(page: Page) {
  await expect(opening(page)).toHaveCount(0);
  await expect(page.locator("[data-testid=animated-narrow-door]")).toHaveCount(0);
  expect(await introState(page)).toBe("done");
}

type Box = { x: number; y: number; width: number; height: number };
/** What the page filmed of the move into the light after Enter Narrow Gate (see the first test). */
type Film = { frames: number; first: number; maxScale: number; maxWhite: number; animations: string[] };
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
    // Pressed as soon as it shows: the button rises in for 0.6 s and the overlay moves on at 3.85 s, which a slow
    // renderer (WebKit on a CI machine without a GPU) can reach before Playwright sees it "stable". The move is
    // filmed from inside the page, frame by frame from the press itself: a loop on the test side can miss the whole
    // 0.9 s push when each round trip to a busy browser takes hundreds of milliseconds.
    const enter = o.getByRole("button", { name: "Enter Narrow Gate" });
    await expect(enter).toBeVisible();
    await page.evaluate(() => {
      const d = document.documentElement;
      const push = document.querySelector(".ngo .ngs-push")!;
      const white = document.querySelector(".ngo-white")!;
      const sample = () => ({ scale: new DOMMatrix(getComputedStyle(push).transform).a, white: Number(getComputedStyle(white).opacity) });
      (window as unknown as { __ngFilm: Promise<Film> }).__ngFilm = new Promise<Film>((resolve) => {
        const film: Film = { frames: 0, first: NaN, maxScale: 1, maxWhite: 0, animations: [] };
        const frame = () => {
          const m = sample();
          film.frames += 1;
          if (Number.isNaN(film.first)) film.first = m.white;
          film.maxScale = Math.max(film.maxScale, m.scale);
          film.maxWhite = Math.max(film.maxWhite, m.white);
          if (d.dataset.intro === "entering" && film.frames < 600) requestAnimationFrame(frame);
          else resolve(film);
        };
        const observer = new MutationObserver(() => {
          if (d.dataset.intro !== "entering") return;
          observer.disconnect();
          film.animations = [...push.getAnimations(), ...white.getAnimations()].map((a) => (a as CSSAnimation).animationName);
          requestAnimationFrame(frame);
        });
        observer.observe(d, { attributes: true, attributeFilter: ["data-intro"] });
      });
    });
    await enter.click({ force: true });
    const film = await page.evaluate(() => (window as unknown as { __ngFilm: Promise<Film> }).__ngFilm);
    // The press starts the camera push and the light together, as a move and not a cut: on the first frame the
    // light has not yet filled the screen; by the end the scene has grown past 2.5x and the light is full.
    expect(film.animations).toEqual(expect.arrayContaining(["ngs-push-now", "ngo-flood"]));
    expect(film.frames).toBeGreaterThan(0);
    expect(film.first).toBeLessThan(0.3);
    expect(film.maxScale).toBeGreaterThan(2.5);
    expect(film.maxWhite).toBeGreaterThan(0.9);
    await expect(o).toHaveCount(0);
    expect(await introState(page)).toBe("done");

    // The five tabs: in-app navigation never replays it, and the app is usable underneath.
    const nav = page.getByRole("navigation", { name: "Main sections" }).last();
    for (const [name, url] of [
      ["Train", /\/train/],
      ["Nutrition", /\/nutrition/],
      ["Faith", /\/faith/],
      ["You", /\/profile/],
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

  test("welcome screen: the place beyond the gate (no gate of its own), brand, the verse, Start free and Sign in, nothing clipped", async ({ browser }) => {
    for (const s of [SIZES[0]!, SIZES[1]!, SIZES[2]!, SIZES[3]!, SIZES[6]!]) {
      const ctx = await quietContext(browser, { viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Narrow Gate Fitness" })).toBeVisible();
      // The opening is the only gate: the page itself draws none (the overlay, off here, is the only one on the page).
      await expect(page.locator("main [data-testid=animated-narrow-door]")).toHaveCount(0);
      await expect(page.locator("main .ngs")).toHaveCount(0);
      const quote = page.locator("main blockquote");
      await expect(quote).toHaveText(`“${VERSE}”`);
      const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(Math.abs(title.x + title.width / 2 - s.width / 2)).toBeLessThan(3);
      expect((await quote.boundingBox())!.y).toBeGreaterThan(title.y + title.height);
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

test.describe("one gate: the opening is the app's only entrance, and opens onto the right place", () => {
  const PHONE: BrowserContextOptions = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  test("a new person: the gate opens straight onto the welcome page, which draws no second gate", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const page = await ctx.newPage();
    const log = await watchGate(page);
    await page.goto("/");
    await expect(opening(page)).toBeVisible();
    await enterGate(page);
    await inside(page);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { level: 1, name: "Narrow Gate Fitness" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start free" })).toBeVisible();
    const g = await log();
    expect(g.maxGates).toBe(1);
    expect(g.states).toEqual(["play", "entering", "done"]);
    // In-app navigation (Sign in, then the logo back to the welcome page) neither replays the opening nor draws a gate.
    await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
    await page.waitForURL(/\/login/);
    await page.getByRole("link", { name: "Narrow Gate Fitness home" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByRole("link", { name: "Start free" })).toBeVisible();
    await inside(page);
    expect((await log()).maxGates).toBe(1);
    await ctx.close();
  });

  test("someone who has signed in on this phone before, signed out now: the gate opens onto sign-in; a reload doesn't replay it", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const base = test.info().project.use.baseURL ?? "http://localhost:3000";
    await ctx.addCookies([{ name: "ngf_member", value: "1", url: base }]);
    const page = await ctx.newPage();
    const log = await watchGate(page);
    await page.goto("/");
    await page.waitForURL(/\/login$/);
    await expect(opening(page)).toBeVisible();
    await enterGate(page);
    await inside(page);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect((await log()).maxGates).toBe(1);
    await page.reload();
    expect(await introState(page)).toBe("off");
    await expect(opening(page)).toHaveCount(0);
    await ctx.close();
  });

  test("signed in: the gate opens onto Home; with onboarding unfinished, onto onboarding; never twice", async ({ page }) => {
    test.setTimeout(240_000);
    // Unfinished onboarding: a confirmed account that hasn't answered the questions yet.
    await signUpAndConfirm(page, uniqueEmail("gate-onb"));
    await page.waitForURL(/\/onboarding/);
    await page.evaluate((f) => localStorage.removeItem(f), FLAG);
    await page.goto("/");
    await page.waitForURL(/\/onboarding/);
    await expect(opening(page)).toBeVisible();
    await enterGate(page);
    await inside(page);
    await expect(page.getByRole("heading", { level: 1, name: "Let's build your plan" })).toBeVisible();
    // A reload of onboarding (not a launch) doesn't replay it.
    await page.reload();
    expect(await introState(page)).toBe("off");

    // Finished onboarding: Home.
    await page.evaluate((f) => localStorage.setItem(f, "1"), FLAG);
    await completeOnboarding(page);
    await page.evaluate((f) => localStorage.removeItem(f), FLAG);
    const log = await watchGate(page);
    await page.goto("/");
    await page.waitForURL(/\/home/);
    await expect(opening(page)).toBeVisible();
    await enterGate(page);
    await inside(page);
    await expect(page.getByRole("navigation", { name: "Main sections" }).last()).toBeVisible();
    const g = await log();
    expect(g.maxGates).toBe(1);
    expect(g.states).toEqual(["play", "entering", "done"]);
    // Tab navigation never replays it.
    await page.getByRole("navigation", { name: "Main sections" }).last().getByRole("link", { name: "Train" }).click();
    await page.waitForURL(/\/train/);
    await inside(page);
  });

  test("tapping Enter Narrow Gate again and again starts one entrance only", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const page = await ctx.newPage();
    const log = await watchGate(page);
    await page.goto("/");
    const enter = opening(page).getByRole("button", { name: "Enter Narrow Gate" });
    await expect(enter).toBeVisible();
    const box = (await enter.boundingBox())!;
    for (let i = 0; i < 6; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await inside(page);
    expect((await log()).states).toEqual(["play", "entering", "done"]);
    // The taps after the overlay went landed on the welcome page, which is where they belong; no second entrance.
    expect(new URL(page.url()).pathname).toBe("/");
    await ctx.close();
  });

  test("Enter pressed while the door is still opening: the door finishes opening before the camera reaches it", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(opening(page)).toBeVisible();
    const angle = () =>
      page.evaluate(() => {
        const m = getComputedStyle(document.querySelector(".ngo .ngs-door")!).transform.match(/matrix3d\(([^)]+)\)/);
        if (!m) return 0;
        const c = m[1]!.split(",").map(Number);
        return (Math.atan2(-c[2]!, c[0]!) * 180) / Math.PI;
      });
    // Wait for the door to be part-way open, then press (the button works from the moment it exists).
    await expect.poll(angle, { timeout: 15_000, intervals: [30] }).toBeGreaterThan(5);
    const film = await page.evaluate(
      () =>
        new Promise<{ angle: number; scale: number }[]>((resolve) => {
          const door = document.querySelector(".ngo .ngs-door")!;
          const push = document.querySelector(".ngo .ngs-push")!;
          const frames: { angle: number; scale: number }[] = [];
          const read = () => {
            const m = getComputedStyle(door).transform.match(/matrix3d\(([^)]+)\)/);
            const c = m ? m[1]!.split(",").map(Number) : [1, 0, 0];
            frames.push({ angle: (Math.atan2(-c[2]!, c[0]!) * 180) / Math.PI, scale: new DOMMatrix(getComputedStyle(push).transform).a });
          };
          read();
          (document.querySelector("[data-intro-enter]") as HTMLElement).click();
          const tick = () => {
            read();
            if (frames.length < 400 && frames.at(-1)!.scale < 2 && document.documentElement.dataset.intro === "entering") requestAnimationFrame(tick);
            else resolve(frames);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(film[0]!.angle).toBeLessThan(79);
    // By the time the camera has moved in noticeably (the scene 1.5x), the door stands fully open; it never swings back.
    const near = film.find((f) => f.scale >= 1.5);
    if (near) expect(near.angle).toBeGreaterThan(78.5);
    for (let i = 1; i < film.length; i++) expect(film[i]!.angle).toBeGreaterThanOrEqual(film[i - 1]!.angle - 0.5);
    await inside(page);
    await ctx.close();
  });

  test("if the gate's pictures fail to load, a drawn gate takes their place and Enter still leads in", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const page = await ctx.newPage();
    await page.route("**/opening/gate-*.webp", (route) => route.abort());
    const log = await watchGate(page);
    await page.goto("/");
    await expect(opening(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.introArt)).toBe("missing");
    const drawn = await page.evaluate(() => getComputedStyle(document.querySelector(".ngo .ngs-scene")!, "::before").content);
    expect(drawn).not.toBe("none");
    await enterGate(page);
    await inside(page);
    await expect(page.getByRole("link", { name: "Start free" })).toBeVisible();
    expect((await log()).maxGates).toBe(1);
    await ctx.close();
  });

  test("on a slow connection the sequence waits briefly for the gate's pictures, then plays (no door opening undrawn)", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const page = await ctx.newPage();
    await page.route("**/opening/gate-*.webp", async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue().catch(() => null);
    });
    const log = await watchGate(page);
    await page.goto("/");
    await expect(opening(page)).toBeVisible();
    expect((await log()).arts[0]).toBe("loading");
    // It doesn't wait for long: the sequence starts within about a second and a quarter, pictures or not.
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.introArt), { timeout: 3000 }).toBe("ready");
    await enterGate(page);
    await inside(page);
    await ctx.close();
  });

  test("leaving the app mid-opening and coming back fades it out instead of replaying or stalling", async ({ browser }) => {
    const ctx = await freshContext(browser, PHONE);
    const page = await ctx.newPage();
    const log = await watchGate(page);
    await page.goto("/");
    await expect(opening(page)).toBeVisible();
    const setVisibility = (v: "hidden" | "visible") =>
      page.evaluate((state) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
        document.dispatchEvent(new Event("visibilitychange"));
      }, v);
    await setVisibility("hidden");
    await page.waitForTimeout(1300);
    await setVisibility("visible");
    await inside(page);
    expect((await log()).states).toEqual(["play", "leaving", "done"]);
    await expect(page.getByRole("link", { name: "Start free" })).toBeVisible();
    await ctx.close();
  });
});
