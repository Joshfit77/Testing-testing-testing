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
