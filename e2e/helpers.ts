import type { Page } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Poll the local Supabase Mailpit inbox for the latest email to `to` and return the first link matching `pattern`. */
export async function getEmailLink(to: string, pattern: RegExp, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const list = (await res.json()) as { messages: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0]!.ID}`)).json()) as { HTML: string; Text: string };
      const body = `${msg.HTML}\n${msg.Text}`.replace(/&amp;/g, "&");
      const link = body.match(pattern)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export const PASSWORD = "Gate-Strong-2026";

/** Sign up, confirm via email, and land on onboarding. */
export async function signUpAndConfirm(page: Page, email: string, name = "Test Athlete") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("I confirm I am 18 years of age or older.").check();
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Check your inbox").waitFor();
  const link = await getEmailLink(email, /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify[^"'\s<]+/);
  await page.goto(link);
}

export async function completeOnboarding(page: Page) {
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel("Age").fill("34");
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel("Height (ft)").fill("5");
  await page.getByLabel("Height (in)").fill("10");
  await page.getByLabel(/Bodyweight/).fill("185");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Build strength" }).click();
  await page.getByRole("button", { name: "1–3 years" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Home gym" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Build my plan" }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// The local Supabase CLI's standard demo service-role key (public, local-only). Never a real secret.
const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** Test-only: grant a plan directly in the local database (stands in for a completed Stripe checkout). */
export async function grantPlan(email: string, plan: "plus" | "pro") {
  const headers = { apikey: LOCAL_SERVICE_KEY, Authorization: `Bearer ${LOCAL_SERVICE_KEY}`, "Content-Type": "application/json" };
  const users = (await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { id: string; email: string }[] };
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user ${email}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_entitlements`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: user.id, plan, source: "admin" }),
  });
  if (!res.ok) throw new Error(`grantPlan failed: ${res.status} ${await res.text()}`);
}
