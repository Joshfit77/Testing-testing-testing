# Narrow Gate Biblical AI

*Rooted in Scripture. Centered on Christ.* Know the Word. Defend the Truth. Grow in Christ.

**One assistant.** Members meet one knowledgeable Bible study assistant: no teacher profiles, directory, menus or
modes. Scripture (BSB), the original languages (Hebrew, Aramaic and Greek words, Strong's numbers, morphology, the
lexicons and the concordance), cross references, history and archaeology, and approved, licensed Christian teaching
are retrieved on the server. They are synthesised into one Scripture-centered answer, with Scripture as the final
authority. The eleven approved teachers are internal knowledge sources, managed only in the admin backend
(SOURCES.md).

Biblical AI is a Scripture study companion inside the Faith section. It sits behind the strict server-side feature flag
`biblical_ai`, which is **off by default**: while it is off, every Biblical AI page answers "not found" and nothing of it
shows in the app. It was built on `claude/narrow-gate-biblical-ai` from the verified baseline
`7fe42f8146ed233417bda03347ea48ada4531625` (`claude/sharp-cray-8y0uuv`).

Other documents:

- [READINESS.md](READINESS.md): release gates and status.
- [SOURCES.md](SOURCES.md): data, licences and the eleven teachers (internal knowledge sources).
- [COST_PROJECTIONS.md](COST_PROJECTIONS.md): costs.
- [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md): decisions for the founder.

## How it fits the existing app (reused, not duplicated)

| Existing | How Biblical AI uses it |
|---|---|
| BSB in `public/bible/bsb` (`src/server/bible/text.ts`) | The only English Scripture. Retrieval, validation and display all read from it; the model's wording is never shown as Scripture. |
| Reference parser (`src/lib/bible/reference.ts`) and reference finder (`src/lib/bible/ai.ts`) | Find and validate every reference |
| `withAiRequest` (`src/server/services/ai-coach.ts`) | Each request goes through it, which applies consent, the AI kill switch and the member and global money budgets (monthly and daily). It also applies the in-flight limits and cost recording. One optional parameter was added: `AllowanceOverride`, used for the Free tier. |
| `reserve_bible_ai_usage` / `bible_ai_usage` | Per-minute, daily and monthly question counters, shared with the existing helper. New columns record the feature, depth, latency and check failures. |
| Feature flags (`src/server/flags.ts`) | `biblical_ai` (strict: off unless the row is on) |
| Reader (`chapter-reader.tsx`) | A "Study" action on selected verses. A "peek" mode (`from=ai`) opens a reference without moving the reading position, and shows a link back. |
| Journal | An explicit "Ask Biblical AI" link on an entry. The entry is shown, removable, and sent only when the member presses Ask. |
| Admin (MFA required) | Admin → Biblical AI: aggregate metrics, sources and reports |
| Account export and deletion, AI retention | New tables included (`USER_TABLES`, `ai-retention.ts`); verified by the deletion-closure and isolation sweeps |

New data, server-only and never sent to browsers in bulk:

- `data/original-languages`: STEPBible Hebrew, Aramaic and Greek words, lexicons, morphology and a concordance.
  9.8 MB gzipped.
- `data/cross-references`: OpenBible.info cross references.

Both are rebuilt reproducibly by `scripts/build-original-languages.mjs` and `scripts/build-cross-references.mjs`.

## Architecture of one question

1. **Route.** `POST /api/biblical-ai/ask`:
   - cookie session (same-origin only) or bearer token;
   - body at most 16 KB, checked with a zod schema;
   - streams status as NDJSON;
   - closing the request cancels the provider call.
2. **Checks** (`askBiblicalAi` in `src/server/services/biblical-ai.ts`):
   - flag on; AI configured; not demo mode;
   - AI kill switch and the member's AI data-sharing consent;
   - the plan allows the depth;
   - a valid question, study area and passage.
3. **Idempotency.** A `requestId` already answered returns the saved answer; nothing is asked or counted again.
   The database enforces uniqueness per member.
4. **Retrieval** (`retrieveScripture`), capped per depth:
   - passages the question names, or the passage being studied;
   - verses matching its distinctive words;
   - top cross references;
   - for deep and language questions, the original-language words of the key verses with their lexicon entries;
   - approved knowledge documents (licensed teaching and history), of which there are none until a source is
     approved.
5. **Provider call.** A forced tool call, `submit_study`, with structured fields: answer, Scripture, context,
   original language, labelled history, the knowledge documents relied on (`knowledge_used`), application, reflection,
   further study, uncertainty and safety.
   The system prompt is in `src/lib/biblical-ai/prompt.ts`.
   - Quick and standard use Haiku; deep (Pro) asks for Sonnet within the larger-model share.
   - Output limits: 900, 1,800 and 3,600 tokens.
6. **Deterministic checks** (`validateAnswer` in `src/lib/biblical-ai/answer.ts`), on every free-text field (answer,
   title, notes, context, explanations, history, application, questions, further study, uncertainty):
   - every reference exists in the BSB, including the last verse of a range, and invented book names are marked;
   - a quotation in the Scripture list is the BSB wording of its reference;
   - quoted wording in prose (double or single quotes) must match the reference cited in the same sentence, or a
     passage given when none is cited. An ellipsis may join parts of at least three words, skipping at most 20 words.
     Over-long quotations are removed;
   - Strong's numbers occur in the verse (STEP's prefix codes are refused), and the original word shown comes from
     the data, never from the model;
   - knowledge documents only from those provided. Nothing of them is shown except a credit that a source's licence
     requires;
   - one voice: a sentence naming an approved teacher is removed unless the member's question asks about that teacher
     and a provided document by them was used. Attributions to well-known teachers outside the approved eleven are
     always removed. Possessive and "view/position" forms count;
   - crisis guidance (988 and the local emergency number) is fixed server text. It is shown whenever the model flags
     a safety concern or the question itself mentions suicide, self-harm, abuse or danger.

   On failure, the model is asked **once** more with the list. The corrective answer replaces the first only if it
   is at least as good, and a refusal on the second attempt keeps the first. An answer cut off at the output limit is
   asked again with 1.6× the room. What still fails is removed, and the member is told what was removed. If nothing
   usable remains, the member gets the verified passages instead (never unchecked text), and that question isn't
   counted.
7. **Save.** Conversation, question and answer, with the request id. The usage row records depth, latency and
   check failures. Scripture for display comes from the BSB.

Personalized studies (`generateStudyPlan`, Pro) work the same way:

- tool `submit_plan`;
- exact day count;
- every reading a real passage of at most 60 verses;
- no reading repeated on consecutive days;
- the same prose checks on titles, explanations, questions, application and prayers;
- idempotent by request id (database unique index); stopped at 170 seconds, so a cut-off request isn't counted.

**Cancelling and time-outs.** Cancelling stops the provider call. A question already sent to the AI still counts
(status `cancelled`), so cancelling can't be used to spend the AI budget freely. A time-out (140 seconds) isn't
counted. Either way the request id is released and the member can try again. A reservation left by a request that
died stops counting after 10 minutes.

## Screens

- **Faith:** a black-and-gold Biblical AI card with "Ask a Biblical Question" and "Continue previous study". The
  existing "Ask" shortcut points to Biblical AI while it is on.
- **`/faith/biblical-ai`:**
  - title and subtitle;
  - six study areas, folded: Study Scripture, Gospel and Doctrine, Apologetics and Evangelism, Original Languages,
    History and Archaeology, Personal Study;
  - consent, limits, recent studies (rename and delete), saved studies, new personalized study.
- **`/faith/biblical-ai/ask`:** the conversation.
  - Depth: Quick, Standard, or Deep (Pro).
  - Status while working, Cancel, and Try again with the same request id.
  - Answers fold by section. Scripture comes from the BSB, and every reference opens the reader.
  - Copy, Save, Bookmark, Share and Report.
- **`/faith/biblical-ai/saved`** and **`/saved/[id]`:** saved answers with private notes (never sent to the AI).
- **`/faith/biblical-ai/studies/new`** and **`/studies/[id]`:** personalized studies with day-by-day progress.
- **`/faith/bible/words/[book]/[chapter]/[verse]`:** every original word of a verse.
  - Hebrew and Aramaic are right to left with `lang`.
  - Transliteration, gloss, Strong's number, parsing, lexicon entry, other occurrences, disputed-text notes and
    edition variants.
  - No AI is involved.
- **Reader:** select verses, then Study, which offers eight passage actions and the original words.
- **`/admin/biblical-ai`:** aggregates only, sources with audited status changes, and inaccuracy reports that
  members chose to send.

## Security and privacy

- **Row-level security.** Members read and delete only their own conversations, messages, saved studies and
  reports. No member or browser can insert or update them; the server does, filtered by the member. Sources,
  documents and the audit trail have no member access.
- **Attack surface.** Same-origin protection on the route; bearer tokens for native clients. The request body is
  read in chunks and refused past 16 KB, even without a Content-Length. Rate
  limits: per-minute, daily and monthly counters plus the app-wide limits.
- **Data handling.** Every retrieved or member text is wrapped and labelled as data, and closing tags are
  neutralised. No HTML from the model is ever rendered (React text only). External links must be `https`, from
  approved documents, opened with `noopener noreferrer nofollow`.
- **Links back.** The reader's "back" link accepts only `/faith/biblical-ai` paths, so it can't be used as an open
  redirect.
- **What reaches the AI.** Only the question, the retrieved Scripture and data, and text the member explicitly chose
  to share. The journal, notes and prayers are never sent automatically. A journal entry can be attached only with
  the separate journal permission (the same one the AI Coach needs); without it the entry isn't loaded.
- **Admin access.** Administrators never see conversations; the metrics function returns counts only. An inaccuracy
  report holds the question and answer only because the member chose to send them, and the screen says so.
- **Retention and deletion.** Messages follow `AI_CHAT_RETENTION_DAYS`. The question and answer copies in reports
  follow it too, and "Delete all history" clears them. Account deletion removes everything (verified by the
  deletion-closure test).

## Turning it on (after the release gates)

1. Apply migration `20261128000100_biblical_ai.sql`. It is additive. Run `npm run db:verify`.
2. Set `FOUNDER_USER_IDS` if teacher sources will be approved. Optionally set the limit overrides
   (`.env.example`).
3. Admin → Feature flags → `biblical_ai` → on. It takes effect immediately.
4. Watch Admin → Biblical AI and Admin → AI costs.

**Rollback:** turn the flag off; the pages disappear at once. To remove it entirely, follow the rollback SQL at the
top of the migration. Nothing else depends on it, and the existing Bible helper is untouched.

## Tests

- `tests/unit/biblical-ai-validation.test.ts` (30): answer checks against the real BSB and the original-language
  data, including 10 adversarial cases from the independent accuracy review.
- `tests/unit/biblical-ai-data.test.ts`: the data layers, retrieval, links and study plans.
- `tests/unit/biblical-ai-eval-set.test.ts`: the 320-question evaluation set (including "One voice": no teacher
  lists, personas or endorsement) and retrieval measured on it.
- `tests/unit/biblical-ai-teachers-internal.test.ts`: the teacher list is server-only, no other source file names a
  teacher, and no browser code imports it.
- `tests/integration/biblical-ai.test.ts` (26): the server path against the real database with a stand-in for the
  AI API. It covers cancelling, time-outs, the same request sent twice at once, cut-off answers, a refused or worse
  second attempt, the fallback not counting, crisis guidance, stale reservations and plan idempotency. It also checks
  that approved teacher material informs an answer without the teacher being named, and that members can't read the
  source inventory.
- `e2e/biblical-ai.spec.ts`: the browser flow against the production build.
- The existing deletion-closure, isolation, function-surface, retention, env and safe-transition guards cover the
  new tables and code.
