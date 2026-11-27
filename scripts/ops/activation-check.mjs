#!/usr/bin/env node
/**
 * Checks that billing reconciliation and error monitoring are ready on a deployment, before (or right after) the owner
 * switches them on. It changes nothing: reconciliation only re-reads each provider's record (counts come back, never
 * member data), and the test error report contains only made-up values.
 *
 *   CRON_SECRET=… node scripts/ops/activation-check.mjs --url=https://staging.example.org
 *   node scripts/ops/activation-check.mjs --url=http://localhost:3000          (local dry run; http only for localhost)
 *
 * Checks:
 *  1. POST /api/billing/reconcile with no secret and with a wrong secret is refused (401), so nobody else can trigger it.
 *  2. With CRON_SECRET (read from the environment, never printed) it returns 200 and counts; 503 means the server has
 *     no service-role key; 401 means the server's CRON_SECRET differs or is shorter than 16 characters.
 *  3. POST /api/client-errors with a made-up report containing an email, a token, an id and a query string returns 204.
 *     Whether it was logged (ERROR_REPORTING=on) and redacted must be confirmed in the host's log: look for
 *     scope "client.error" with "<email>", "<token>", "<id>" in place of the values (the script prints what to look for).
 * Exit code 1 if a check fails.
 */
const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith("--url="))?.slice(6);
if (!urlArg) {
  console.error("usage: CRON_SECRET=… node scripts/ops/activation-check.mjs --url=https://your-deployment");
  process.exit(2);
}
const base = new URL(urlArg);
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
if (base.protocol !== "https:" && !local) {
  console.error("Refusing a non-https address (http is allowed only for localhost).");
  process.exit(2);
}
const secret = process.env.CRON_SECRET ?? "";
let failed = 0;
const ok = (msg) => console.log(`  PASS  ${msg}`);
const bad = (msg) => {
  failed++;
  console.log(`  FAIL  ${msg}`);
};

async function post(path, headers = {}, body) {
  const res = await fetch(new URL(path, base), { method: "POST", headers: { "content-type": "application/json", ...headers }, body, redirect: "manual" });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

console.log(`Activation check against ${base.origin}`);
console.log("Billing reconciliation (/api/billing/reconcile)");
const anon = await post("/api/billing/reconcile");
if (anon.status === 503) bad("server says it is not configured (no service-role key): set SUPABASE_SERVICE_ROLE_KEY on the deployment");
else if (anon.status === 401) ok("refused without a secret (401)");
else bad(`expected 401 without a secret, got ${anon.status}`);
const wrong = await post("/api/billing/reconcile", { authorization: "Bearer not-the-secret-0000000000" });
if (wrong.status === 401) ok("refused with a wrong secret (401)");
else if (wrong.status !== 503) bad(`expected 401 with a wrong secret, got ${wrong.status}`);
if (!secret) {
  console.log("  SKIP  authorised call: CRON_SECRET is not set in this shell");
} else if (secret.length < 16) {
  bad("CRON_SECRET in this shell is shorter than 16 characters (the app refuses it)");
} else {
  const real = await post("/api/billing/reconcile", { authorization: `Bearer ${secret}` });
  if (real.status === 200 && real.json?.stripe && real.json?.store && real.json?.webhookEvents) {
    const r = real.json;
    ok(`authorised call returned counts: Stripe ${r.stripe.skipped ? "not configured (skipped)" : `${r.stripe.checked} checked, ${r.stripe.failed} failed`}; App Store/RevenueCat ${r.store.skipped ? "not configured (skipped)" : `${r.store.checked} checked, ${r.store.failed} failed`}; webhook events failed/stuck: Stripe ${r.webhookEvents.stripeFailed}/${r.webhookEvents.stripeStuck}, RevenueCat ${r.webhookEvents.revenueCatFailed}/${r.webhookEvents.revenueCatStuck}`);
    const keys = Object.keys(r).sort().join(",");
    if (keys !== "store,stripe,webhookEvents") bad(`reply has unexpected fields (${keys}); it must hold counts only`);
  } else if (real.status === 401) bad("the deployment refused this CRON_SECRET: it differs from the server's, or the server's is unset/short");
  else bad(`authorised call returned ${real.status}`);
}

console.log("Error monitoring (/api/client-errors)");
const marker = `activation-check-${Date.now()}`;
const report = {
  kind: "error",
  name: "Error",
  message: `Test report ${marker} for jane.doe@example.com token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXRlc3Q id 123e4567-e89b-12d3-a456-426614174000 at https://x.test/p?email=a@b.co`,
  path: "/train/history/123e4567-e89b-12d3-a456-426614174000?tab=1",
};
const sent = await post("/api/client-errors", {}, JSON.stringify(report));
if (sent.status === 204) ok("test report accepted (204)");
else bad(`expected 204, got ${sent.status}`);
console.log(`  LOOK  in the deployment's log for scope "client.error" (only present when ERROR_REPORTING=on). It must read like:`);
console.log(`        message "Test report activation-check-<n> for <email> token <token> id <id> at https://x.test/p", path "/train/history/:id"`);
console.log(`        and must NOT contain the email, the token, the id or "?email=". (Marker: ${marker.replace(/\d+/, "<n>")})`);

console.log(failed ? `${failed} check(s) failed.` : "All automatic checks passed.");
process.exit(failed ? 1 : 0);
