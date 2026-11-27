import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { completeOnboarding, LOCAL_SERVICE_KEY, serviceRest, signUpAndConfirm, SUPABASE_URL, uniqueEmail, userIdFor } from "./helpers";

/**
 * A server that is not a demo deployment (DEMO_MODE unset, as in production) shows and allows nothing of the demo:
 * no sample-data or new-member entry, no demo bar or Free/Pro switch, no "Demo:" notes, no simulated AI label, and the
 * demo's server actions refuse even when called directly with their ids (as someone who dug them out of a build
 * could). The guard's rules themselves are unit-tested in tests/unit/demo-mode*.test.ts; this checks a running build.
 * Skipped against a demo server (npm run demo), where all of this is meant to show.
 */

const SERVICE_KEY = LOCAL_SERVICE_KEY;

/** The demo's server action ids in this checkout's build (only when the server under test runs from it). */
function demoActionIds(): Record<string, string> {
  const file = path.join(process.cwd(), ".next/server/server-reference-manifest.json");
  if (!fs.existsSync(file)) return {};
  const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as { node?: Record<string, { filename?: string; exportedName?: string }> };
  const ids: Record<string, string> = {};
  for (const [id, entry] of Object.entries(manifest.node ?? {})) if (entry.filename?.includes("actions/demo") && entry.exportedName) ids[entry.exportedName] = id;
  return ids;
}

async function isDemoServer(request: APIRequestContext) {
  return (await (await request.get("/")).text()).includes('data-testid="demo-entry"');
}

async function demoAccountCount(): Promise<number> {
  if (!SERVICE_KEY) return -1;
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const users = (await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { email: string; app_metadata?: { demo?: boolean } }[] };
  return users.users.filter((u) => u.app_metadata?.demo === true || u.email.endsWith("@demo.narrowgatefitness.invalid")).length;
}

test.describe("production: nothing of the demo", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(await isDemoServer(request), "this server is a demo deployment (npm run demo)");
  });

  test("welcome, sign-in and sign-up pages offer no demo entry", async ({ page }) => {
    for (const p of ["/", "/login", "/signup"]) {
      await page.goto(p);
      await expect(page.locator("main, body").first()).toBeVisible();
      await expect(page.getByTestId("demo-entry")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Explore with sample data|Start as a new member/ })).toHaveCount(0);
      expect(await page.content(), `${p} carries no demo markup`).not.toMatch(/demo-entry|Explore with sample data|Start as a new member/);
    }
  });

  test("the demo's server actions refuse when called directly", async ({ request, baseURL }) => {
    const ids = demoActionIds();
    test.skip(!ids.enterDemoAction || !ids.startFreshDemoAction, "the server under test isn't this checkout's build");
    const before = await demoAccountCount();
    for (const name of ["enterDemoAction", "startFreshDemoAction"]) {
      const res = await request.post("/", {
        headers: { "Next-Action": ids[name]!, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8", Origin: baseURL! },
        data: "[null]",
      });
      const body = await res.text();
      expect(body, `${name} answers with the refusal`).toContain("The demo isn't set up on this server.");
      const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
      expect(cookies.some((c) => /sb-[^=]*auth-token=[^;]/.test(c)), `${name} signs nobody in`).toBe(false);
    }
    if (before >= 0) expect(await demoAccountCount(), "no demo account was created").toBe(before);
  });

  test("a member sees no demo bar, notes or simulated-AI labels, and can't give themselves Pro", async ({ page }) => {
    const email = uniqueEmail("nodemo");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    const uid = await userIdFor(email);
    // Even an account marked as a demo account (only the service role can set app_metadata) gets nothing here.
    if (SERVICE_KEY) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
        method: "PUT",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ app_metadata: { demo: true } }),
      });
      expect(r.ok).toBe(true);
    }
    for (const p of ["/home", "/run/record", "/coach", "/progress/sleep", "/progress/body-scan", "/nutrition/photo", "/nutrition/label", "/faith/ask", "/profile/billing"]) {
      await page.goto(p);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByTestId("demo-bar"), p).toHaveCount(0);
      await expect(page.locator('[data-testid^="demo-"]'), `${p}: no demo markup`).toHaveCount(0);
      await expect(page.getByText(/^Demo:/), `${p}: no "Demo:" note`).toHaveCount(0);
    }
    // The Free/Pro switch's action, posted the way its form would post it: nothing changes.
    const ids = demoActionIds();
    if (ids.setDemoPlanAction) {
      await page.goto("/home");
      await page.evaluate(async (id) => {
        const fd = new FormData();
        fd.append(`$ACTION_ID_${id}`, "");
        fd.append("plan", "pro");
        await fetch("/home", { method: "POST", body: fd });
      }, ids.setDemoPlanAction);
      const rows = await serviceRest<{ plan: string; source: string }[]>(`user_entitlements?select=plan,source&user_id=eq.${uid}`);
      expect(rows.filter((r) => r.plan === "pro"), "no Pro entitlement").toEqual([]);
    }
  });
});
