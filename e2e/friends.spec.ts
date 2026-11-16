import { expect, test, type Browser, type Page } from "@playwright/test";
import { LOCAL_SERVICE_KEY, PASSWORD, serviceRest, SUPABASE_URL, uniqueEmail } from "./helpers";

/**
 * Friends (migrations 076 to 078) in the real app, with two members in two browsers: hidden while the flag is off;
 * choosing a username; finding a friend by username; request, accept, the friend's profile (name only until the friend
 * switches workouts on); switching sharing on and off; removing.
 * Members are created through the local auth admin API with onboarding already finished.
 */
const FLAG = "friends_challenges";
const SHOTS = process.env.FRIENDS_SHOTS_DIR;
const tag = `${Date.now().toString(36)}`.slice(-7);

async function setFlag(enabled: boolean) {
  await serviceRest(`feature_flags?key=eq.${FLAG}`, { method: "PATCH", body: { enabled } });
}

async function createMember(name: string): Promise<{ id: string; email: string }> {
  const email = uniqueEmail("friends");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: LOCAL_SERVICE_KEY, Authorization: `Bearer ${LOCAL_SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } }),
  });
  if (!res.ok) throw new Error(`createMember: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  await serviceRest(`profiles?id=eq.${id}`, { method: "PATCH", body: { onboarding_completed_at: new Date().toISOString(), timezone: "UTC" } });
  return { id, email };
}

async function deleteMember(id: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: LOCAL_SERVICE_KEY, Authorization: `Bearer ${LOCAL_SERVICE_KEY}` } });
}

async function signedInPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
  return page;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  // Let the page's entrance fade and any toast settle, so the picture shows the finished screen.
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test.describe.configure({ mode: "serial" });

test.describe("friends", () => {
  let jordan: { id: string; email: string };
  let sam: { id: string; email: string };
  let flagBefore = false;
  const jordanName = `jordan_${tag}`;
  const samName = `sam_${tag}`;

  test.beforeAll(async () => {
    flagBefore = (await serviceRest<{ enabled: boolean }[]>(`feature_flags?key=eq.${FLAG}&select=enabled`))[0]?.enabled === true;
    [jordan, sam] = await Promise.all([createMember("Jordan Reyes"), createMember("Sam Carter")]);
    // Sam already uses Friends (with the default switches: workouts not shared) and trained three days running.
    await serviceRest("social_profiles", { method: "POST", body: { user_id: sam.id, username: samName } });
    const now = Date.now();
    await serviceRest("workout_sessions", {
      method: "POST",
      body: [0, 1, 2].map((d) => ({ user_id: sam.id, client_id: crypto.randomUUID(), name: "Session", status: "completed", started_at: new Date(now - d * 86_400_000 - 3_600_000).toISOString(), ended_at: new Date(now - d * 86_400_000).toISOString() })),
    });
  });

  test.afterAll(async () => {
    await setFlag(flagBefore);
    await Promise.all([deleteMember(jordan.id), deleteMember(sam.id)]);
  });

  test("hidden while the flag is off", async ({ browser }) => {
    await setFlag(false);
    const page = await signedInPage(browser, jordan.email);
    await page.goto("/profile");
    await expect(page.getByRole("link", { name: /My Progress/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Friends/ })).toHaveCount(0);
    const res = await page.goto("/friends");
    expect(res?.status()).toBe(404);
    await page.context().close();
  });

  test("username, search, request, accept, profile, privacy, remove", async ({ browser }) => {
    test.setTimeout(120_000);
    await setFlag(true);
    const jp = await signedInPage(browser, jordan.email);

    // You > Friends > choose a username.
    await jp.goto("/profile");
    await jp.getByRole("link", { name: /^Friends/ }).click();
    await expect(jp.getByRole("heading", { name: "Choose your username" })).toBeVisible();
    await shot(jp, "01-choose-username");
    await jp.getByRole("textbox", { name: "Username" }).fill("ad");
    await jp.getByRole("button", { name: "Get started" }).click();
    await expect(jp.locator("p[role=alert]")).toContainText("at least 3");
    await jp.getByRole("textbox", { name: "Username" }).fill(samName);
    await jp.getByRole("button", { name: "Get started" }).click();
    await expect(jp.locator("p[role=alert]")).toContainText("taken");
    await jp.getByRole("textbox", { name: "Username" }).fill(jordanName);
    await jp.getByRole("button", { name: "Get started" }).click();
    await expect(jp.getByRole("heading", { name: "Your friends" })).toBeVisible();
    await expect(jp.getByText("No friends yet")).toBeVisible();
    await noSidewaysScroll(jp);
    await shot(jp, "02-friends-empty");

    // Find Sam by username: the result shows the username only, never Sam's name.
    await jp.getByLabel("Search by username").fill(`sam_${tag}`.slice(0, 6));
    await jp.getByRole("button", { name: "Search" }).click();
    const results = jp.getByTestId("friend-search-results");
    await expect(results).toContainText(`@${samName}`);
    await expect(results).not.toContainText("Sam Carter");
    await shot(jp, "03-search-result");
    await results.getByRole("button", { name: "Add" }).click();
    await expect(results).toContainText("Request sent");
    await expect(jp.getByTestId("friend-requests-outgoing")).toContainText(`@${samName}`);
    await shot(jp, "04-request-sent");

    // Sam sees the request (username only) and accepts.
    const sp = await signedInPage(browser, sam.email);
    await sp.goto("/friends");
    const incoming = sp.getByTestId("friend-requests-incoming");
    await expect(incoming).toContainText(`@${jordanName}`);
    await expect(incoming).not.toContainText("Jordan Reyes");
    await shot(sp, "05-incoming-request");
    await incoming.getByRole("button", { name: "Accept" }).click();
    await expect(sp.getByTestId("friends-list")).toContainText("Jordan Reyes");
    await shot(sp, "06-friends-list");

    // Jordan opens Sam's profile: name and username only. Becoming friends shares no training by itself.
    await jp.reload();
    await jp.getByTestId("friends-list").getByRole("link", { name: /Sam Carter/ }).click();
    await expect(jp.getByRole("heading", { name: "Sam Carter", level: 1 })).toBeVisible();
    await expect(jp.getByTestId("friend-private")).toContainText("keeps their training private");
    await expect(jp.getByTestId("friend-stats")).toHaveCount(0);
    await shot(jp, "07a-friend-profile-default");

    // Sam opens Privacy & sharing: workouts are off, and only the switches that do something are offered.
    await sp.goto("/friends/privacy");
    await expect(sp.getByRole("heading", { name: "What friends can see" })).toBeVisible();
    await expect(sp.getByTestId("privacy-profile_visible")).toHaveAttribute("data-state", "checked");
    await expect(sp.getByTestId("privacy-show_workouts")).toHaveAttribute("data-state", "unchecked");
    await expect(sp.getByTestId("privacy-searchable")).toHaveAttribute("data-state", "checked");
    for (const hidden of ["show_records", "show_in_leaderboards", "show_body", "show_nutrition", "show_faith"]) {
      await expect(sp.getByTestId(`privacy-${hidden}`)).toHaveCount(0);
    }
    await expect(sp.getByTestId("privacy-not-shared")).toHaveText("Weight, measurements, nutrition and Faith activity are not shared with friends at all.");
    await noSidewaysScroll(sp);

    // Sam switches workouts on: Jordan now sees the training numbers.
    await sp.getByTestId("privacy-show_workouts").click();
    await expect(sp.getByTestId("privacy-show_workouts")).toHaveAttribute("data-state", "checked");
    await expect.poll(async () => (await serviceRest<{ show_workouts: boolean }[]>(`social_profiles?user_id=eq.${sam.id}&select=show_workouts`))[0]?.show_workouts).toBe(true);
    await jp.reload();
    const stats = jp.getByTestId("friend-stats");
    await expect(stats).toContainText("Workouts, last 7 days");
    await expect(stats).toContainText("3 days");
    await expect(jp.getByTestId("friend-private")).toHaveCount(0);
    await noSidewaysScroll(jp);
    await shot(jp, "07-friend-profile");

    // Sam switches workouts off again: Jordan's view changes on the next load.
    await shot(sp, "08-privacy");
    if (SHOTS) {
      await sp.getByRole("heading", { name: "Finding you" }).scrollIntoViewIfNeeded();
      await sp.evaluate(() => window.scrollBy(0, 400));
      await sp.waitForTimeout(300);
      await sp.screenshot({ path: `${SHOTS}/08b-privacy-lower.png` });
    }
    await sp.getByTestId("privacy-show_workouts").click();
    await expect(sp.getByTestId("privacy-show_workouts")).toHaveAttribute("data-state", "unchecked");
    await expect.poll(async () => (await serviceRest<{ show_workouts: boolean }[]>(`social_profiles?user_id=eq.${sam.id}&select=show_workouts`))[0]?.show_workouts).toBe(false);
    await jp.reload();
    await expect(jp.getByTestId("friend-private")).toContainText("keeps their training private");
    await expect(jp.getByTestId("friend-stats")).toHaveCount(0);
    await shot(jp, "09-friend-profile-private");

    // The report sheet opens with its fixed reasons (not sent here).
    await jp.getByRole("button", { name: "Report" }).click();
    await expect(jp.getByRole("dialog")).toContainText("Reports go to the Narrow Gate Fitness team");
    await shot(jp, "10-report");
    await jp.getByRole("button", { name: "Cancel" }).click();

    // Jordan removes Sam: gone from both lists, and the profile no longer exists for Jordan.
    await jp.getByRole("button", { name: "Remove friend" }).click();
    await jp.getByRole("dialog").getByRole("button", { name: "Remove friend" }).click();
    await jp.waitForURL(/\/friends$/);
    await expect(jp.getByText("No friends yet")).toBeVisible();
    expect((await jp.goto(`/friends/${sam.id}`))?.status()).toBe(404);
    await sp.goto("/friends");
    await expect(sp.getByText("No friends yet")).toBeVisible();
    await jp.context().close();
    await sp.context().close();
  });

  test("an invite link makes two members friends", async ({ browser }) => {
    test.setTimeout(90_000);
    await setFlag(true);
    const sp = await signedInPage(browser, sam.email);
    await sp.goto("/friends");
    await sp.getByTestId("friend-invite-create").click();
    const link = (await sp.getByTestId("friend-invites").locator("p").first().innerText()).trim();
    expect(link).toMatch(/\/friends\/invite\/[A-HJ-NP-Z2-9]{10}$/);
    await shot(sp, "11-invite-link");
    const path = new URL(link).pathname;

    // Signed out, the link goes to sign-in and then back to the invite.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(path);
    await page.waitForURL(/\/login\?next=/);
    await page.getByLabel("Email").fill(jordan.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(new RegExp(`${path}$`), { timeout: 30_000 });
    await shot(page, "12-invite-landing");
    await page.getByTestId("friend-invite-accept").click();
    await expect(page.getByText("You're friends now.").first()).toBeVisible();
    await page.getByRole("link", { name: "All friends" }).click();
    await expect(page.getByTestId("friends-list")).toContainText("Sam Carter");
    // The link can't be used twice.
    await page.goto(path);
    await page.getByTestId("friend-invite-accept").click();
    await expect(page.locator("p[role=alert]")).toContainText(/already/);
    await context.close();
    await sp.context().close();
  });
});
