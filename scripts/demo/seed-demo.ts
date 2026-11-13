/**
 * Seeds the interactive demo: one sample member with about two months of realistic, entirely made-up history
 * (workouts, food, runs with sample routes, sleep, faith, goals), then writes the account's sign-in to a local file
 * that is never committed (.demo-credentials.local).
 *
 *   npx tsx scripts/demo/seed-demo.ts            (normally run by scripts/demo/run-demo.sh)
 *   npx tsx scripts/demo/seed-demo.ts --check-only   (only the safety checks below; changes nothing)
 *   npx tsx scripts/demo/seed-demo.ts --reset        (npm run demo:reset: put ONLY the sample account back to its
 *                                                     starting state; every other account, demo or not, is untouched)
 *
 * Safety:
 * - It only writes to the Supabase project in NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
 * - It refuses any project that isn't on this computer unless DEMO_SEED_ALLOW_REMOTE=true (a project made only for
 *   the demo), and it refuses any project that has an account not created by the demo, so it can never touch real
 *   members' data.
 * - Every account it creates carries app_metadata.demo = true, set with the service role (members can't set it).
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signupAcceptances } from "@/lib/legal/versions";
import { resetSampleAccount, seedSampleData, seedSampleProfile, setSeedClient } from "@/server/demo-seed";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL = process.env.DEMO_ACCOUNT_EMAIL || "sample-member@demo.narrowgatefitness.invalid";
const CREDENTIALS_FILE = process.env.DEMO_CREDENTIALS_FILE || ".demo-credentials.local";

let db: SupabaseClient;

function fail(message: string): never {
  console.error(`seed-demo: ${message}`);
  process.exit(1);
}

// ---------- Safety checks

async function checkTarget() {
  if (!URL || !SERVICE_KEY) fail("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).");
  const host = new globalThis.URL(URL).hostname;
  const local = host === "127.0.0.1" || host === "localhost";
  if (!local && process.env.DEMO_SEED_ALLOW_REMOTE !== "true") {
    fail(`${host} isn't on this computer. Only seed a Supabase project made just for the demo, and then set DEMO_SEED_ALLOW_REMOTE=true.`);
  }
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listing accounts: ${error.message}`);
    const others = data.users.filter((u) => u.app_metadata?.demo !== true);
    if (others.length) {
      fail(`this project has ${others.length}+ account(s) that the demo didn't create. The demo must use its own empty project; nothing was changed.`);
    }
    if (data.users.length < 200) break;
  }
}

async function removeDemoAccounts() {
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) fail(`listing accounts: ${error.message}`);
    const demo = data.users.filter((u) => u.app_metadata?.demo === true);
    if (!demo.length) return;
    for (const u of demo) {
      const { error: delErr } = await db.auth.admin.deleteUser(u.id);
      if (delErr) fail(`removing earlier demo account: ${delErr.message}`);
    }
  }
}

/** The sample account's id, or null. Matched by its email AND the demo flag, so a real account can never match. */
async function findSampleAccount(): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listing accounts: ${error.message}`);
    const hit = data.users.find((u) => u.email === EMAIL && u.app_metadata?.demo === true);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
}

// ---------- The sample member

async function createMember(password: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    app_metadata: { demo: true },
    user_metadata: { display_name: "Jordan Hayes", legal_acceptances: signupAcceptances() },
  });
  if (error || !data.user) fail(`creating the demo account: ${error?.message}`);
  const id = data.user.id;
  await seedSampleProfile(id);
  return id;
}

async function main() {
  db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  setSeedClient(db);
  await checkTarget();
  if (process.argv.includes("--check-only")) {
    console.log("seed-demo: the target holds no accounts except demo accounts.");
    return;
  }
  if (process.argv.includes("--reset")) {
    // Only the sample account, in place: same id and password, so a running demo server keeps working, and new-member
    // demo accounts (or a test using one at this moment) are never touched. The same scoped reset as the in-app
    // Reset demo button.
    const sample = await findSampleAccount();
    if (sample) {
      await resetSampleAccount(db, sample);
      console.log("seed-demo: sample account reset in place; no other account was changed.");
      return;
    }
    console.log("seed-demo: no sample account yet, so creating it (other accounts are left alone).");
  } else {
    await removeDemoAccounts();
  }
  // Re-seeding under a running demo server keeps its password (DEMO_ACCOUNT_PASSWORD); otherwise a new random one.
  // The suffix keeps every random password inside the auth policy (a lower-case letter, an upper-case letter and a
  // digit each): a 24-character random string alone failed it now and then.
  const password = process.env.DEMO_ACCOUNT_PASSWORD || `${randomBytes(18).toString("base64url")}aZ9`;
  const userId = await createMember(password);
  const { sessions, discipleship } = await seedSampleData(userId);
  writeFileSync(
    CREDENTIALS_FILE,
    `# Demo sign-in for the sample account (local file, never commit it). Created ${new Date().toISOString()}\nDEMO_ACCOUNT_EMAIL=${EMAIL}\nDEMO_ACCOUNT_PASSWORD=${password}\n`,
    { mode: 0o600 },
  );
  console.log(`seed-demo: sample account ready (${sessions} workouts, 30 days of food, 8 runs, 28 nights of sleep, faith history).`);
  console.log(`seed-demo: ${discipleship}.`);
  console.log(`seed-demo: sign-in written to ${CREDENTIALS_FILE}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
