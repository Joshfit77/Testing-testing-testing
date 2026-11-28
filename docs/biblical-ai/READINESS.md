# Biblical AI: release gates and readiness

**Status: not ready to turn on for members.** The engineering work is complete and tested with the flag off. Turning
it on needs the owner actions below: a live evaluation, a theological review of its answers, privacy text, device
testing and the product decisions.

The `biblical_ai` flag is **off**. Nothing of Biblical AI is visible or reachable while it is off; every page
answers "not found" and the route answers "unavailable".

Branch: `claude/narrow-gate-biblical-ai`, built from `7fe42f8146ed233417bda03347ea48ada4531625`.

## Gates

| # | Gate | Status | Evidence / what is needed |
|---|---|---|---|
| G-1 | Off by default, server-controlled | **Passed** | Migration inserts `biblical_ai = false`; strict flag (missing = off); integration test "is off by default" |
| G-2 | BSB preserved, not rebuilt | **Passed** | No change under `public/bible/bsb`; the existing Bible integrity tests pass; every displayed verse comes from it |
| G-3 | Existing faith features and Bible helper unchanged | **Passed** | Full unit, integration and browser suites (below); `/faith/ask` untouched |
| G-4 | Pricing unchanged: Free $0, Pro $24.99 a month, $149.99 a year | **Passed** | No pricing file changed; pricing tests pass. Section 26's $19.99/$149 was not applied (PRODUCT_DECISIONS D-1) |
| G-5 | Free and Pro limits enforced on the server | **Passed** | Database counter plus money budgets; integration tests for Free 3 a day, depths, burst limit, Plus = Free |
| G-6 | Data protection: RLS, no member writes, export, deletion, retention | **Passed** | RLS and deletion integration tests; isolation, deletion-closure and function-surface guards include the new tables |
| G-7 | Independent security review findings fixed | **Passed** | See "Review findings" below |
| G-8 | Independent accuracy review findings fixed | **Passed** | 10 adversarial unit tests; 9 new integration tests |
| G-9 | Independent UX and accessibility review findings fixed | **Passed** | Touch targets of 44 px, per-word `lang`, labels, live region, focus; see below |
| G-10 | Automated suites green | **Passed** (local) | See "Test results" |
| G-11 | GitHub workflows green on the branch, nothing published | **Pending** | Dispatch CI, iOS checks and Android (publish off) on the branch |
| G-12 | Live evaluation of the 320 questions on the real model | **Not run: owner** | `scripts/eval/run-biblical-ai-eval.ts` needs an approved API key. Estimated cost: under $1 for quick and standard, about $9 for deep on Sonnet |
| G-13 | Theological review of the live answers by a qualified reviewer | **Not done: owner** | Review the eval output against each question's `expect` and `avoid` notes; fix the prompt and retest until the agreed pass rate |
| G-14 | Teacher material licensing | **Blocked: licensing** | All 11 teachers are `pending_review` with no content loaded. Biblical AI works on Scripture and the original-language data alone. Approval needs a founder (`FOUNDER_USER_IDS`) and, where the licence requires it, the credit text |
| G-19 | Teachers internal only: one assistant, no profiles, directory, menus or modes | **Passed** | Teacher list server-only; guard test; the instructions don't name teachers; the checks remove unrequested names; members can't read the inventory (integration test); no teacher names in the browser bundle (checked after build) |
| G-15 | Privacy policy and Terms mention Biblical AI | **Not done: owner** | Questions sent to the AI provider, optional journal sharing, inaccuracy reports, retention (D-11, D-12) |
| G-16 | Physical device testing (iPhone, Android) | **Not done: owner** | Not tested on a physical device. The web build and the Capacitor checks run in CI only |
| G-17 | Production database migration | **Not done: owner** | Additive migration `20261128000100_biblical_ai.sql`; apply, then `npm run db:verify`. Rollback SQL is in its header |
| G-18 | Founder decisions | **Pending: owner** | PRODUCT_DECISIONS.md D-1 to D-12 |

## Review findings and what was done

Three independent reviews (security, AI accuracy, UX and accessibility) ran against the first complete version. Every
finding was either fixed with a regression test or is listed here as accepted.

**Security**

- Journal text could be attached without the separate journal permission. It is now attached only with it; otherwise
  the member is told how to turn it on.
- Copies of questions and answers in inaccuracy reports outlived the conversations. They now follow the retention
  setting and are cleared by "Delete all history".
- The 16 KB body limit trusted Content-Length. The body is now read in chunks and refused past 16 KB.
- Teachers were named in the instructions and shown as a "Verified commentary" section, and the teacher list was in a
  module that reaches the browser. Changed per the founder's clarification: one assistant, with the teachers as
  internal knowledge only (G-19).
- Members could delete reports to hide them from review. Delete on reports is revoked; truncate, trigger and
  references privileges are revoked on every new table.
- Cancelling or provoking refusals could spend the AI budget without counting. A question already sent counts
  (`cancelled`).
- Two requests with the same id could both be paid for. The request is claimed in the database before the
  provider call; a parallel duplicate gets "already being answered".

**Accuracy**

- Only the main answer was checked. Every free-text field is now checked.
- Ellipses could stitch a passage into another meaning. Each part needs three words or more, and an ellipsis may skip
  at most 20 words.
- A quotation was accepted if it matched any passage. It must now match the reference cited in its sentence.
- Single-quoted and over-long quotations went unchecked. Both are now checked or removed.
- Attribution was checked loosely. It is now checked per sentence against the authors of cited documents, includes
  possessive and "view" forms, and blocks well-known teachers outside the approved eleven. "Comfort" as a word is no
  longer taken for Ray Comfort.
- Real books such as "Song of Solomon" and "II Kings" were flagged, and ranges past a chapter's end were accepted.
  Both fixed.
- The model's spelling of Hebrew and Greek was shown. The word now comes from the data, and STEP prefix codes are
  refused.
- The model wrote its own crisis text. It is now fixed server text (988 and the local emergency number), also shown
  when the question itself mentions suicide, self-harm, abuse or danger.
- A worse or refused second attempt replaced a usable first. The first is now kept.
- An answer cut off at the output limit failed. It is now asked again with more room.
- The passages-only fallback counted as a question. It no longer does.
- A passage cut to the retrieval cap kept its full label. The label now shows the verses actually sent.
- Study plans had no prose checks. They now get the same checks.
- Plan idempotency was a JSON lookup. It is now a unique `request_id` column.
- A plan request could outlive its page. It is now stopped at 170 seconds and not counted.

**UX and accessibility**

- Raised to 44 px: answer section links, word-study links, source links and the saved-study filters.
- `lang` is set per word on the word-study page, so Aramaic words in Daniel and Ezra are marked as Aramaic.
- The reader's selection toolbar wraps to three columns on narrow screens.
- Toggles whose label changes no longer also carry `aria-pressed`.
- Evidence labels moved out of the validation module, so zod isn't sent to the browser.
- The Faith page's last-study query runs in parallel with the others.
- Original-language books are kept in a 12-book cache, least recently used dropped first. Each lexicon loads only
  when its language is needed.

**Accepted, not changed**

- Biblical AI conversations are capped at 60 messages on screen. Older messages stay saved; a member starts a new
  study for a long thread.
- Retrieval is lexical: references, distinctive words, cross references. It has no embeddings. Its quality on the
  320 questions is measured by a unit test; answer quality needs G-12.

## Test results (local, this branch)

| Suite | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | Passed |
| Lint (`eslint .`) | Passed |
| Unit (all) | 307 files: 5,049 passed, 1 skipped (pre-existing) |
| Integration (all, local Supabase) | 103 files: 704 passed, 1 skipped (pre-existing) |
| Production build | Passed. No teacher name appears anywhere in the browser bundle (`.next/static`) |
| Browser, mocked AI (all) | 168 passed, 101 skipped (the same skips as the baseline), 1 failed: see below |

The one browser failure was `e2e/fast-logging.spec.ts` "skip exercise from the card…". It timed out after 90 s
waiting for the Complete-set button during the full run. It covers workout logging, which this branch doesn't change.
It passed in the two earlier full runs on this branch, and 3 of 3 times when rerun alone. It is recorded as an
intermittent failure under load, not fixed or weakened; CI runs it again.

The suites run against a local Supabase and a local stand-in for the AI API. No paid AI call was made.

## What turning it on involves

See README.md, "Turning it on". In short: pass G-11 to G-18, apply the migration, set `FOUNDER_USER_IDS`, turn the
flag on, and watch Admin → Biblical AI and Admin → AI costs. Turning the flag off removes it immediately.
