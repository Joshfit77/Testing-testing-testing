import type { Page } from "@playwright/test";

/**
 * The screen checks shared by the phone sweep (e2e/phone-sweep.spec.ts: iPhone widths, largest text) and the device
 * matrix (e2e/device-matrix.spec.ts: every iPhone and Android model in Playwright's device list).
 */

/** Every signed-in screen a member can reach without data of their own (detail screens: see detailPages). */
export const STATIC = [
  "/home", "/plan", "/calendar",
  "/train", "/train/programs", "/train/exercises", "/train/history", "/train/templates", "/train/templates/new", "/train/build", "/train/recovery", "/train/review",
  "/run", "/run?tab=log", "/run/record",
  "/nutrition", "/nutrition/diets", "/nutrition/recipes", "/nutrition/recipes/new", "/nutrition/planner", "/nutrition/grocery", "/nutrition/insights", "/nutrition/saved-meals", "/nutrition/supplements", "/nutrition/compare", "/nutrition/photo", "/nutrition/scanner",
  "/faith", "/faith/journal", "/faith/practices", "/profile/notifications",
  "/faith/bible", "/faith/bible/john", "/faith/bible/john/3", "/faith/bible/psalms/119", "/faith/bible/search?q=peace", "/faith/bible/saved", "/faith/bible/history",
  "/faith/journey", "/faith/journey/new", "/faith/journey/new?kind=book", "/faith/journey/new?kind=full_bible", "/faith/journey/new?kind=gospels&days=90",
  "/faith/journal/new?kind=daily", "/faith/memory", "/faith/studies", "/faith/studies/gospel", "/faith/studies/gospel/good-news", "/faith/ask",
  "/progress", "/progress/overview", "/progress/badges", "/progress/body-map", "/progress/body-scan", "/progress/body-scan/new",
  "/progress/sleep", "/progress/sleep/log", "/progress/sleep/checkin", "/progress/sleep/history", "/progress/sleep/debt", "/progress/sleep/energy", "/progress/sleep/schedule", "/progress/sleep/alarm", "/progress/sleep/training", "/progress/sleep/method", "/progress/sleep/settings",
  "/coach", "/coach/memory",
  "/profile", "/profile/preferences", "/profile/billing",
];

/**
 * WebKit reports a cancelled fetch as an error: leaving a page cancels the app's own route prefetches (Next.js
 * `?_rsc=` requests), and WebKit raises "… due to access control checks" for each. Chromium doesn't. Those are
 * counted (watch().cancelledPrefetches), not treated as defects; any other message, or one for another origin, is.
 */
export function isCancelledPrefetch(message: string, origin: string): boolean {
  // As Playwright reports it from WebKit: "[Fetch API cannot load ][http:]/localhost:3000/faith?_rsc=… due to access
  // control checks." (the scheme can be cut off), so the host is compared rather than the full origin.
  const m = /(\S+?)\.? due to access control checks/i.exec(message);
  const target = m && /^(?:https?:)?\/*([^/?#\s]+)[^?#\s]*\?(\S*)$/.exec(m[1]!);
  if (!target) return false;
  return target[1] === new URL(origin).host && new URLSearchParams(target[2]).has("_rsc");
}

export async function watch(page: Page, origin?: string) {
  const errors: string[] & { cancelledPrefetches?: number } = [];
  errors.cancelledPrefetches = 0;
  page.on("pageerror", (e) => {
    if (origin && isCancelledPrefetch(e.message, origin)) errors.cancelledPrefetches! += 1;
    else errors.push(`script error: ${e.message.slice(0, 160)}`);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp?: string[] }).__csp = [...((window as unknown as { __csp?: string[] }).__csp ?? []), `${e.violatedDirective} ${e.blockedURI || "inline"}`];
    });
  });
  return errors;
}

/** What's wrong with the screen as laid out at `width` (empty when nothing is). */
export async function problems(page: Page, width: number): Promise<string[]> {
  return page.evaluate(async (w) => {
    const out: string[] = [];
    const text = document.body.innerText;
    if (/Application error|Something went wrong|Unhandled Runtime Error|This page couldn.t load/i.test(text)) out.push("crash screen");
    const csp = (window as unknown as { __csp?: string[] }).__csp ?? [];
    if (csp.length) out.push(`blocked by the CSP: ${csp.slice(0, 2).join(", ")}`);
    // Sideways scroll, measured against the width set (a phone browser widens innerWidth to fit overflowing content).
    const scroll = document.documentElement.scrollWidth;
    if (scroll > w + 1) {
      const leaves = [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > w + 0.5 && getComputedStyle(el).position !== "fixed")
        .filter((el) => ![...el.children].some((c) => c.getBoundingClientRect().right > w + 0.5))
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" → ${Math.round(el.getBoundingClientRect().right)} px`);
      out.push(`${scroll} px wide: ${leaves.join("; ")}`);
    }
    // At the end of the page, the last content must sit above the fixed tab bar (and so above the home indicator).
    // (Instant: the page scrolls smoothly, and a measurement mid-scroll would see the content still under the bar.)
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const bar = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= window.innerHeight - 2 && n.getBoundingClientRect().height < 140);
    const main = document.querySelector("main");
    if (bar && main) {
      const top = bar.getBoundingClientRect().top;
      const hidden = [...main.querySelectorAll("a, button, input, select, textarea, p, h1, h2, h3, li")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          // (Screen-reader-only text, e.g. a chart's data list, is 1 px and clipped: not something the eye has to find.)
          return r.height > 1 && r.width > 1 && s.visibility !== "hidden" && s.position !== "fixed" && s.position !== "sticky" && !el.closest("[role=dialog], [data-state=closed], [aria-hidden=true], .sr-only");
        })
        .filter((el) => el.getBoundingClientRect().bottom > top + 2);
      if (hidden.length) out.push(`under the tab bar at the end of the page: ${hidden.slice(0, 2).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`).join("; ")}`);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    return out;
  }, width);
}

/**
 * page.goto, once more if a navigation the app had already started (e.g. the welcome redirect after onboarding, which
 * WebKit can finish late) interrupts it. Each retry is recorded in `retries` so a run shows how often it happened; an
 * app that kept navigating on its own would still fail, on the second attempt.
 */
export async function visit(page: Page, url: string, retries?: string[]) {
  try {
    return await page.goto(url);
  } catch (e) {
    if (!/interrupted by another navigation/i.test(String(e))) throw e;
    retries?.push(`${url}: ${String(e).split("\n")[0]!.slice(0, 140)}`);
    await page.waitForLoadState("load").catch(() => null);
    return page.goto(url);
  }
}

/** One of each kind of detail screen, found the way a member would. */
export async function detailPages(page: Page, retries?: string[]): Promise<string[]> {
  await visit(page, "/train/exercises", retries);
  const exercise = await page.locator('a[href^="/train/exercises/"]').first().getAttribute("href");
  await visit(page, "/train/programs", retries);
  const program = await page.locator('a[href^="/train/programs/"]').first().getAttribute("href");
  await visit(page, "/nutrition/recipes", retries);
  const recipe = await page.locator('a[href^="/nutrition/recipes/app/"]').first().getAttribute("href");
  return [exercise!, `${exercise!}/history`, program!, "/train/programs/half-marathon-base-80-20", recipe!].filter(Boolean);
}
