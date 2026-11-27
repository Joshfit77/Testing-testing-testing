# Remaining information needed before the legal documents can be finalised

Date: 2026-11-16. Prepared by a non-lawyer as a working list for the owner and counsel. **Not legal advice.** Nothing in the documents listed here has been reviewed or approved by an attorney, and every one of them is still a draft.

**Files covered and the short names used below**

| Short name | File |
|---|---|
| **P** | `docs/legal/PRIVACY_POLICY_DRAFT.md` |
| **T** | `docs/legal/TERMS_OF_SERVICE_DRAFT.md` |
| **M** | `docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md` |
| **IP** | `src/app/legal/privacy/page.tsx` (the placeholder page members see) |
| **IT** | `src/app/legal/terms/page.tsx` (the placeholder page members see) |

References are `file:line`, counted on 2026-11-16 after the Phase 1 revision. "×3" means three on that line. Line numbers move if the files are edited; search for the bracketed text.

## Counts

| | Count |
|---|---|
| **A. Facts the owner must supply or confirm** (bracketed blanks) | **76** in P, T and M, plus **2** date blanks and **8** "counsel to complete" blanks in IP and IT |
| **B. Owner decisions still open** (bracketed markers) | **53** markers, which reduce to **34** distinct decisions (section B) |
| **C. Attorney markers** | **66** "[ATTORNEY REVIEW …]" notes (P 19, T 39, M 8) and **7** "[DRAFT FOR ATTORNEY REVIEW]" marks: 5 provisions (C1) and 2 mentions in the revision notes at P:8 and T:8 |
| All bracketed items in P, T, M, IP and IT | **212** (5 dated "[Update …]" notes in T are not counted: they record facts and need no action) |
| Documents that do not exist yet | **7** (section D) |
| Statements that could not be verified in Phase 1 | **12** (section E) |

---

## A. Facts the owner must supply or confirm

### A1. Who operates the service

1. **Legal entity name** (the owner is currently an individual; Apple expects apps handling sensitive data to be submitted by a legal entity). 9 places: P:14, P:405; T:14, T:184, T:609, T:618, T:622; M:12, M:151.
2. **State of formation** and **entity type**. T:14 ×2.
3. **Postal address.** 7 places: P:17, P:405; T:14, T:538, T:601, T:618, T:623.

### A2. Contact addresses

4. **Privacy email.** P:16, P:290, P:314, P:405.
5. **Support email** (no support or contact address exists anywhere in the app today). T:44, T:618, T:624; M:58, M:125, M:151.
6. **Legal-notice email.** T:538, T:601, T:625.
7. **Arbitration opt-out email** (only if arbitration is kept: B6). T:574.
8. **Security contact** for coordinated disclosure. T:319.
9. **DMCA agent name and address** (and whether to register one). T:467.
10. **Toll-free number**, if counsel says one is required. P:18.
11. **A contact for people who can no longer sign in** and want their account deleted. P:266; also noted in `src/app/legal/delete-account/page.tsx`.

### A3. Dates and version labels

12. **Effective date** of each document. P:4, T:4, M:4.
13. **"Last updated" date.** P:4; IP:12; IT:8.
14. **Final version labels** to replace "[DRAFT …]". P:3, T:3, M:3. The versions members accept are set in `src/lib/legal/versions.ts` (today `2026-10-26-placeholder` for both).
15. **Plan change date** for legacy Plus and earlier Pro subscribers. T:109.

### A4. Web addresses

16. **Public URL of the Privacy Policy.** T:26.
17. **Public URL of the notices page** (`/legal/notices`). T:465.
18. **Public URL of the delete-account page** (`/legal/delete-account`). P:266; T:442.

### A5. Governing law and dispute resolution (facts that follow from decisions B5 and B6)

19. **Governing-law state**; **county and state for venue.** T:588 ×2.
20. **Arbitration provider.** T:551 ×2.
21. **Dollar threshold** for decisions on written submissions (draft shows "[US $25,000]"). T:553.

### A6. Processors and where data is held

22. **Web hosting provider.** P:212; T:428. (IP:61 names Vercel; nothing in the code confirms it.)
23. **Email delivery provider** for the two account emails. Not chosen; no production mail provider is configured in the repository. P:211; T:429.
24. **Processing regions** for Supabase, the web host and Anthropic. P:341.
25. **Whether live USDA search is switched on in production** (`USDA_FDC_API_KEY`). P:218.
26. **Whether a map-tile provider is switched on** (`NEXT_PUBLIC_MAP_TILE_URL`), and which. P:63; T:278.
27. **Whether the scheduled weekly AI report is switched on in production.** P:168.
28. **Who holds administrator, service-role and database-console access in production.** P:331.

### A7. Processor contract details

29. **Anthropic: retention period for AI inputs and outputs; whether a zero-data-retention arrangement applies; the training terms on the owner's actual account.** P:114, P:202, P:238, P:276; T:307.
30. **A signed or accepted data processing agreement with each processor** (Supabase, the host, Anthropic, Stripe, RevenueCat, the email provider). Attorney note at P:206; none is in the repository.
31. **Prices as configured in Stripe, App Store Connect and Google Play Console** (code says $17.99 and $119.99). T:82.
32. **The App Store privacy answers and Google Play Data safety form as submitted**, for comparison with the Policy. P:360.

### A8. Third-party content licences

33. **Berean Standard Bible public-domain dedication**, confirmed against the publisher's own page. T:239.
34. **USDA FoodData Central licence and citation terms**, confirmed against USDA's own pages. T:461.

### A9. Behaviour to confirm on a real phone

35. **GPS recording with the screen locked.** T:274 (attorney/owner note at P:59).
36. **What is cleared from the device on sign-out.** P:74.
37. **Menu paths for disconnecting Apple Health and Health Connect** on current iOS and Android. P:357.

### A10. Blanks on the in-app placeholder pages

38. IP:49 "[Counsel to complete.]"; IP:55 sale/sharing wording; IP:61 data processing agreements; IP:66 provider retention; IP:72 contact details.
39. IT:19 refund and consumer-law terms; IT:21 acceptable use; IT:23 limitation of liability.

---

## B. Owner decisions still open

34 distinct decisions. Decisions 1–17 are the ones the audit already listed (file 07, section 7); the rest surfaced in Phase 1.

| # | Decision | Where |
|---|---|---|
| 1 | Which legal entity operates the service | T:14 |
| 2 | Postal address to publish | A1 |
| 3 | Which contact addresses to create | A2 |
| 4 | Effective date and version label | A3 |
| 5 | Governing-law state and venue | T:588 |
| 6 | Arbitration: whether to use it at all; provider; threshold; opt-out method | T:517–574 |
| 7 | Refund policy for website purchases, including the "[X] days" option | T:387 ×2 |
| 8 | **Retention period for each data type** — 15 markers in P (P:234–237, P:239–247, P:275, P:396) under the general note at P:6 and P:230; 3 in M (M:118–120). Today nothing is deleted automatically | P §7; M §9 |
| 9 | **Geographic availability**: United States only, or wider. No geographic restriction exists in code | P:343 ×2 |
| 10 | Apple's standard EULA or a custom one | T:28, T:607 |
| 11 | Hosting provider, email provider, processing regions | A6 |
| 12 | **Age policy**: confirm the minimum stays 18, and what happens to an under-age account (no routine exists) | P:316; T:37; M:105 |
| 13 | Consent approach for sensitive data: progress photos, faith features, consumer health data; whether to extend state rights to all US members | P:128, P:138, P:294, P:298 |
| 14 | Days of notice for price changes and for changes to the Terms | T:399, T:592 |
| 15 | Whether to state the AI cost limit in dollars | T:103 |
| 16 | Date and notice for legacy Plus subscribers | T:109 |
| 17 | Whether Friends and Accountability partners launch, and under what rules | P §16; T §13.1; M |
| 18 | Response time for privacy requests (draft shows "[45 days]"), and setting up a request log, appeal and authorised-agent process (none exists) | P:290, P:292 |
| 19 | Keeping "no third-party analytics" true | P:91 |
| 20 | Whether to add a control to delete imported step counts (none exists) | P:358 |
| 21 | Friends: whether workout sharing starts off, and whether the first acceptance needs an explicit sharing step | P:382 |
| 22 | Friends: hide or reset the five switches that do nothing | P:393 |
| 23 | The Free plan highlight "The complete Faith & Discipline section, always free" in `src/lib/domain/plans.ts`: inaccurate (the AI Bible study helper is Pro) and open-ended. **Since corrected in the app** to "Bible reading, prayer journal, devotionals and reading journeys (the AI Bible study helper is part of Pro)"; the wording awaits owner and counsel approval (`docs/legal-audit-2026-11-16/21_STATEMENT_CORRECTIONS_APPLIED.md`, rows 15–22) | T:61 |
| 24 | Friends: which enforcement actions will be offered (no in-app tool exists) | T:344; M:91 |
| 25 | Friends: report review and response times | T:346; M:80–83 |
| 26 | Moderation: who reviews reports, and how staff are alerted | M:79, M:80 |
| 27 | Moderation: whether the reporter and the reported member are told anything | M:84, M:85 |
| 28 | Moderation: escalation for threats, self-harm, crime and reports about an administrator | M:103, M:104, M:106, M:107 |
| 29 | Moderation: appeal window, response time and second reviewer | M:125 ×3 |
| 30 | Whether the moderation policy also governs Accountability partners | M:14 |
| 31 | How notice of a policy change will actually be given (the app cannot send a notice email today) | P:366 |
| 32 | Whether to add a consent step or make every GPS notice say the same thing about locked-screen recording | P:59 |
| 33 | **In-app privacy page corrections** (section F): approve them together with a new version in `src/lib/legal/versions.ts` | F |
| 34 | Wording and placement of the new setting "Share Apple Health / Health Connect data with the AI Coach" | P:180 |

---

## C. Provisions that need attorney drafting or approval

### C1. New provisions drafted in Phase 1, marked "[DRAFT FOR ATTORNEY REVIEW]" (5)

1. P:343 — placeholder sentence on international use.
2. P:370 — Section 16, "Friends (not yet available)".
3. T:328 — Section 13.1, Friends conduct terms, not yet in force.
4. M:28 — prohibited usernames, display names and conduct.
5. M:125 — appeal outline.

The whole of **M** is a new draft and needs review from start to finish.

### C2. "[ATTORNEY REVIEW …]" notes (66)

**Privacy Policy draft (19):** P:59 GPS notices; P:72 Google ML Kit; P:114 "no training" statement; P:128 progress-photo consent; P:138 religious data and consumer-health consent; P:180 the Apple Health / Health Connect AI setting; P:202 Anthropic retention; P:206 data processing agreements; P:224 "we require our providers" sentence; P:238 provider retention of photos; P:292 rights process that does not exist yet; P:294 response period; P:298 which state laws apply; P:316 children; P:333 security claims; P:337 breach procedure; P:341 international scope; P:366 how notice of changes is given; P:392 consent for sharing with other members.

**Terms draft (39):** T:6 banner; T:14 contracting party; T:22 acceptance; T:28 EULA choice; T:37 minimum age; T:82 prices; T:103 AI cost limit; T:105 ×2 allowance reset and reductions; T:109 legacy subscribers; T:113 feature changes; T:127 wellness guidance; T:180 assumption of risk; T:193 release; T:251 AI usage policy; T:265 dietetics licensure; T:300 progress-photo consent; T:311 faith content and name; T:346 monitoring and response times; T:358 auto-renewal; T:387 refunds; T:402 price changes; T:412 trials; T:441 "no AI training"; T:465 ×2 notices page and Open Database License; T:467 DMCA agent; T:477 termination refund; T:487 warranty disclaimer; T:505 liability cap; T:513 indemnity; T:517 arbitration as a whole; T:538 informal resolution; T:562 jury waiver; T:570 mass filings; T:574 opt-out; T:588 governing law; T:592 changes; T:607 Apple terms.

**Moderation draft (8):** M:45 prohibited list; M:87 store expectations; M:103–106 escalation (4); M:119 reports surviving deletion; M:121 access requests.

### C3. Whole provisions that still depend on counsel

1. Dispute resolution and arbitration (T §22) — whether to have it at all.
2. Release and waiver (T §6), assumption of risk (T §5), warranty disclaimer (T §19), limitation of liability (T §20), indemnity (T §21).
3. Auto-renewal disclosures and consent (T §14) against federal and state law.
4. Refund policy (T §14.5).
5. Apple custom EULA terms (T §26), if used.
6. Consumer-health-data treatment (P §9) and sensitive-data consent (P §4).
7. Children (P §10) and the age gate.
8. Breach notification (P §12).
9. International use (P §13).
10. Everything about Friends (P §16, T §13.1, M).

---

## D. Documents that do not exist yet

1. Consumer-health-data privacy policy (Washington, Nevada).
2. Refund policy.
3. Retention schedule.
4. Incident-response and breach-notification procedure.
5. Data processing agreements with each processor.
6. Custom EULA (only if chosen).
7. Final App Store privacy answers and Google Play Data safety form matched to the final Privacy Policy.

---

## E. Statements in the drafts that could not be verified in Phase 1

1. Anything about a hosted environment: the actual host, regions, mail provider, log and backup retention, and which settings are switched on.
2. Anthropic's retention and training terms.
3. Prices configured in Stripe, App Store Connect and Google Play Console.
4. Location, sign-out and Health-disconnect behaviour on a physical phone.
5. What Google ML Kit sends to Google.
6. That deleting an account removes everything listed: the deletion code was read; its tests were not re-run in Phase 1.
7. The Friends facts: taken from audit file 08. The Friends code is not on the release branch and was not re-read.
8. The legal citations in the existing attorney notes: carried over unchanged and not checked.
9. The Berean Standard Bible and USDA licence statements.
10. The new Apple Health / Health Connect AI setting: its database column and server code were seen in progress on this branch; the on-screen switch and its wording were not.
11. That product photos are loaded by the member's device directly from Open Food Facts: taken from audit file 05, not re-checked.
12. The menu path for reporting and blocking in Friends (M §4): described from the audit, not from the screens.

---

## F. In-app privacy page: corrections identified and NOT applied

`src/app/legal/privacy/page.tsx` contains statements that do not match the code. They were not changed, because the page's text is fingerprinted in `src/lib/legal/versions.ts` (a unit test fails on any change without a new version there) and that file was outside the Phase 1 scope. The Terms placeholder page needed no factual correction.

| # | Line | Says | Correct |
|---|---|---|---|
| 1 | IP:27–28 | Health-platform data is shared with the AI provider "only as a summary, when you ask the AI coach about sleep or recovery" | It is sent only if the member has given AI consent **and** turned on the separate, default-off setting; the device name is never sent |
| 2 | IP:45 | The barcode or search text is sent to Open Food Facts and USDA | A scanned barcode or scanner product search goes to Open Food Facts; diary search text goes to USDA only if live USDA search is switched on, otherwise nothing leaves |
| 3 | IP:49 | "We do not use advertising or analytics trackers" | No advertising and no third-party analytics; the app keeps its own record of workout events |
| 4 | IP:61 | "Vercel (hosting)" | Hosting provider not confirmed; email provider not chosen |
| 5 | IP:31 | Wellness information is limitation notes and recovery check-ins | Also sleep entries and sleep check-ins; withdrawing consent does not delete sleep data |
| 6 | IP:36, IP:41 | Meal photo; AI coach, meal plans and "Ask AI about this food" | Also food-label photos, AI Bible study questions and the weekly report |
| 7 | IP:65–67 | Deleting the account removes data | Add: it cancels a website subscription but not one billed by Apple or Google |

To apply them: edit the page, then set a new version and SHA-256 for `privacy` in `src/lib/legal/versions.ts` (new versions register themselves in the database at sign-up; see `src/server/legal.ts`).
