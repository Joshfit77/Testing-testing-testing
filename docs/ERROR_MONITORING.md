# Production error monitoring and billing reconciliation

Added 2026-11-04. Both are **off until the owner switches them on** in the deployment; nothing here sends data to a
third party or costs money.

## Error monitoring

| Part | What it does | Where |
| --- | --- | --- |
| Server errors | Every error thrown while rendering a page, running a server action or handling a route is written to the server log as one JSON line (`scope: "server.request"`): route pattern, route type, method, error name, digest, scrubbed message. Always on (it only writes to the log the host already keeps). | `src/instrumentation.ts` |
| Browser errors | Script errors, unhandled promise rejections, the "We couldn't load this page" crash screen and **hydration failures** (React #418 and friends, reported as `kind: "hydration"`) send one small report to `/api/client-errors`, which writes it to the server log (`scope: "client.<kind>"`). At most 5 reports per page load; 30 per address per 10 minutes. | `src/lib/error-report.ts`, `src/instrumentation-client.ts`, `src/app/(app)/error.tsx`, `src/app/api/client-errors/route.ts` |
| Redaction | Messages lose emails, ids, tokens, long numbers, quoted text and URL queries, and are cut to 200 characters; paths keep only their pattern (`/train/history/:id`). The server redacts again (the browser is never trusted). Request bodies, cookies, headers, journal/prayer text, food and health values are never read. | `src/lib/error-redact.ts`, `tests/unit/error-monitoring.test.ts` |

**Switch on (owner):** set `ERROR_REPORTING=on` and `NEXT_PUBLIC_ERROR_REPORTING=on` on the deployment (the second is
built into the app, so redeploy). To be alerted, point the host's log drain or alert rule at lines with
`"level":"error"`; e.g. Vercel → Log Drains, or a free-tier log service of the owner's choosing. No vendor SDK was added,
so no third party receives anything unless the owner connects one.

**Privacy policy:** error reports contain no personal data by design (above). If the owner connects an external log
service, list it as a processor in the privacy policy.

## Billing reconciliation

`POST /api/billing/reconcile` re-reads each provider's record of recently changed subscriptions (Stripe and the App
Store via RevenueCat) and corrects the account if a webhook was missed. It existed but nothing called it.

`.github/workflows/billing-reconcile.yml` now calls it at :07 and :37 past every hour. **Dormant** until:

1. the workflow is on `main` (GitHub only runs scheduled workflows from the default branch; merging needs the owner's
   approval);
2. repository **variable** `BILLING_RECONCILE_URL` = the deployed app's `https://` address;
3. repository **secret** `CRON_SECRET` = the same value as the deployment's `CRON_SECRET` (16+ characters).

Safeguards: it skips quietly when not configured; refuses non-HTTPS and placeholder addresses; the secret is sent in a
header read from a file (never on the command line or in the log); the reply holds counts only; a non-200 reply fails
the run (GitHub emails the owner). It changes no price and charges nobody.

Check after switching on: the run log shows `HTTP 200` and counts such as `{"stripe":{"checked":3,"failed":0,...}}`.

## Activation checklist (owner; staging first)

Nothing below is switched on yet. Do it on the **staging** deployment first, then on production only after approval.

1. **Generate the secret** on your own computer: `openssl rand -base64 32` (32+ characters). Never paste it into chat,
   commits or issues.
2. **Deployment environment** (e.g. Vercel → Project → Settings → Environment Variables, staging environment):
   `CRON_SECRET` = that value; `ERROR_REPORTING=on`; `NEXT_PUBLIC_ERROR_REPORTING=on`; confirm
   `SUPABASE_SERVICE_ROLE_KEY` is set (reconciliation answers 503 without it). Redeploy (the `NEXT_PUBLIC_` value is
   built into the app).
3. **Check it from your computer** (changes nothing; the test report contains only made-up values):
   `CRON_SECRET='<the value>' node scripts/ops/activation-check.mjs --url=https://<staging address>`
   Expect: refused without a secret (401), refused with a wrong one (401), counts with the right one (200), test report
   accepted (204). Then open the deployment's logs and find the `"scope":"client.error"` line: the email, token, id
   and `?email=` must appear as `<email>`, `<token>`, `<id>` and be gone.
4. **Log alerts:** point the host's log drain or alert rule at `"level":"error"` lines (owner's choice of service; if
   it is a third party, list it in the privacy policy as a processor).
5. **Schedule:** after the owner approves merging to `main`, set repository variable `BILLING_RECONCILE_URL` and
   secret `CRON_SECRET` (GitHub → Settings → Secrets and variables → Actions); run "Billing reconciliation" once by
   hand (Actions → Run workflow) and check `HTTP 200` with counts.
6. **Switch off** at any time: unset `ERROR_REPORTING`/`NEXT_PUBLIC_ERROR_REPORTING` and redeploy; delete the
   `BILLING_RECONCILE_URL` variable (the workflow then skips quietly).

**Dry run done locally (2026-11-04, local Supabase, no Stripe or RevenueCat keys):** `scripts/ops/activation-check.mjs`
against a local production build with a throwaway `CRON_SECRET` and `ERROR_REPORTING=on`: no secret → 401, wrong
secret → 401, right secret → 200 with counts only (`{"stripe":{"checked":0,"failed":0,"skipped":true},"store":
{…"skipped":true},"webhookEvents":{"stripeFailed":4,…}}` — the 4 are failed test webhook events in the local database
that the report is meant to surface), test error report → 204 and one log line
`{"scope":"client.error","message":"Test report activation-check-<n> for <email> token <token> id <id> at https://x.test/p","path":"/train/history/:id"}`
with none of the original values anywhere in the log. Not yet run against a hosted deployment (none exists).
