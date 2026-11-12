import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";
import { detailPages, problems, STATIC, watch } from "./screen-checks";

/**
 * Every signed-in screen a member can reach, at iPhone widths from the SE (375 pt) to the Pro Max (440 pt), plus a
 * 320 pt pass (an SE with Display Zoom) and the largest in-app text size with reduced motion. On each screen: it loads,
 * no script error or blocked script, no crash screen, nothing scrolls sideways, and the end of the page can be scrolled
 * clear of the tab bar. Pro member, so the Pro screens are reached too; the Free view of Run is in csp-and-layout.
 */
test.describe("every signed-in screen on iPhone sizes", () => {
  test.setTimeout(900_000);

  test("loads cleanly and fits, from the SE to the Pro Max, with the largest text and reduced motion", async ({ page }) => {
    const email = uniqueEmail("sweep");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    const errors = await watch(page);

    const pages = [...STATIC, ...(await detailPages(page))];

    const found: string[] = [];
    const visit = async (label: string, width: number) => {
      for (const path of pages) {
        errors.length = 0;
        const res = await page.goto(path);
        if ((res?.status() ?? 0) >= 400) found.push(`${label} ${path}: HTTP ${res?.status()}`);
        await page.waitForLoadState("networkidle").catch(() => null);
        for (const p of [...(await problems(page, width)), ...errors]) found.push(`${label} ${path}: ${p}`);
      }
    };

    for (const [width, height] of [[375, 667], [393, 852], [440, 956]] as const) {
      await page.setViewportSize({ width, height });
      await visit(`${width} pt`, width);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await visit("320 pt", 320);

    // The largest in-app text size (Profile > Preferences), with reduced motion, on the smallest current iPhone.
    const id = await userIdFor(email);
    await serviceRest(`profiles?id=eq.${id}`, { method: "PATCH", body: { text_size: "xlarge", reduce_motion: true } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/home");
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
    await visit("375 pt, largest text", 375);

    expect(found, found.join("\n")).toEqual([]);
  });
});
