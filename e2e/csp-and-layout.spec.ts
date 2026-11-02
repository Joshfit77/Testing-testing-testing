import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The Content-Security-Policy runs only scripts carrying the response's nonce (src/middleware.ts): every page must
 * still work under it, with nothing blocked, while script injected into a page can't run. And a new member's Run
 * page fits the phone (it was 413 px wide on a 402 px iPhone).
 */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI || "inline"}`));
  });
  return async () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
}

function scriptSrc(csp: string | undefined | null) {
  return (csp ?? "").split("; ").find((d) => d.startsWith("script-src")) ?? "";
}

test.describe("Content-Security-Policy with a per-request nonce", () => {
  test("signed-out pages load with nothing blocked, the inline scripts run, and each response has its own nonce", async ({ page }) => {
    const violations = await recordViolations(page);
    const nonces = new Set<string>();
    for (const path of ["/", "/login", "/signup", "/legal/privacy", "/legal/terms"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      const src = scriptSrc(res?.headers()["content-security-policy"]);
      expect(src, path).toMatch(/^script-src 'self' 'nonce-[A-Za-z0-9+/]{22}==' 'strict-dynamic'$/);
      expect(src, path).not.toContain("unsafe-inline");
      nonces.add(src);
      // Every script tag the server sent carries the nonce.
      const unsigned = await page.locator("script:not([nonce])").count();
      expect(unsigned, `${path}: scripts without the nonce`).toBe(0);
      await page.waitForLoadState("networkidle");
      expect(await violations(), path).toEqual([]);
    }
    expect(nonces.size).toBe(5);
    // The root layout's inline script ran before the first paint: it decides whether the opening plays.
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-intro", /^(play|off|done|entering|leaving)$/);
  });

  test("script injected into a page's HTML doesn't run, while the page's own scripts do", async ({ page }) => {
    // Stands in for stored script injection: the server's real response, with its real CSP header, plus markup an
    // attacker managed to get into the HTML (an inline script and an inline event handler, without the nonce).
    await page.route("**/login", async (route) => {
      const res = await route.fetch();
      const html = (await res.text())
        .replace("</head>", `<script>window.__pwned=1</script></head>`)
        .replace("</body>", `<img src="data:," onerror="window.__pwned2=1"><script>window.__pwned3=1</script><img src="data:," onerror="window.__pwned4=1"></body>`);
      await route.fulfill({ response: res, body: html });
    });
    const violations = await recordViolations(page);
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const flags = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return [w.__pwned, w.__pwned2, w.__pwned3, w.__pwned4];
    });
    expect(flags).toEqual([undefined, undefined, undefined, undefined]);
    expect((await violations()).filter((v) => v.startsWith("script-src-elem inline") || v.startsWith("script-src-attr inline") || v.startsWith("script-src inline")).length).toBeGreaterThan(0);
    // The page's own scripts still ran: the root layout's inline script set its attribute, and the framework started.
    await expect(page.locator("html")).toHaveAttribute("data-intro", /^(play|off|done|entering|leaving)$/);
    await page.waitForFunction(() => Boolean((window as unknown as { next?: { version?: string } }).next?.version));
  });

  test("a new member's main screens load with nothing blocked", async ({ page }) => {
    const violations = await recordViolations(page);
    await signUpAndConfirm(page, uniqueEmail("csp"));
    await completeOnboarding(page);
    for (const path of ["/home", "/train", "/run", "/nutrition", "/faith", "/progress", "/coach", "/profile"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      expect(await violations(), path).toEqual([]);
    }
  });
});

/**
 * Nothing scrolls sideways on a phone. Measured against the width set here, not window.innerWidth: a phone browser
 * widens its layout viewport to fit content that overflows, so innerWidth grows with the bug it should catch.
 */
async function overflow(page: Page, width: number) {
  return page.evaluate((w) => {
    const leaves = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > w + 0.5 && getComputedStyle(el).position !== "fixed")
      .filter((el) => ![...el.children].some((c) => c.getBoundingClientRect().right > w + 0.5))
      .slice(0, 4)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" → ${Math.round(el.getBoundingClientRect().right)} px`);
    return { scroll: document.documentElement.scrollWidth, leaves };
  }, width);
}

test.describe("phone layout", () => {
  test("a new member's screens fit phones from 320 to 430 px, the Run page and program week bars included", async ({ page }) => {
    test.setTimeout(240_000);
    await signUpAndConfirm(page, uniqueEmail("width"));
    await completeOnboarding(page);
    await page.goto("/train");
    const starter = await page.locator('a[href^="/train/programs/starter-"]').first().getAttribute("href");
    // The Run page (a Free member sees the PRO tags), and programs with 8 to 12 weeks in the week bar.
    const runOnly = ["/run"];
    const pages = ["/home", "/train", "/run?tab=log", starter!, "/train/programs/half-marathon-base-80-20", "/train/programs/10k-training", "/nutrition", "/faith", "/progress", "/progress/overview", "/coach", "/profile"];
    for (const width of [320, 360, 375, 390, 402, 412, 430]) {
      await page.setViewportSize({ width, height: 860 });
      for (const path of width === 390 || width === 320 || width === 430 ? [...runOnly, ...pages] : runOnly) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { scroll, leaves } = await overflow(page, width);
        expect(scroll, `${path} at ${width} px is ${scroll} px wide: ${leaves.join("; ")}`).toBeLessThanOrEqual(width);
      }
    }
  });
});
