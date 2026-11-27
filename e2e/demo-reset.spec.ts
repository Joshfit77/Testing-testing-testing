import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Demo servers only (npm run demo): Reset demo in the demo bar puts the sample account back to its seeded state
 * without signing the member out. Water is the probe: the seed holds a fixed amount for today, a tap adds 250 ml, the
 * reset takes it away again.
 */
async function isDemoServer(request: APIRequestContext) {
  const html = await (await request.get("/")).text();
  return html.includes('data-testid="demo-entry"');
}

test("Reset demo restores the sample account and keeps the member signed in", async ({ page, request }) => {
  test.skip(!(await isDemoServer(request)), "not a demo server");
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
  const water = page.getByTestId("home-water");
  const text = async () => (await page.getByTestId("home-water").innerText()).replace(/\s+/g, " ").trim();
  const before = await text();
  await water.getByRole("button", { name: /\+250 ml/ }).click();
  await expect.poll(text, { timeout: 10000 }).not.toBe(before);
  await page.getByTestId("demo-reset").click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset demo" }).click();
  await page.waitForURL(/\/home\?reset=1/, { timeout: 90000 });
  await expect.poll(text, { timeout: 15000 }).toBe(before);
  await expect(page.getByTestId("demo-bar")).toBeVisible();
});
