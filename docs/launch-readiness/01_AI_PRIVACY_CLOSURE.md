# 01. AI privacy closure: what actually reaches the AI provider

Date: 2026-11-17. Branch `claude/legal-remediation`. Builds on `docs/legal-remediation/PRIVACY_DATA_FLOW_AUDIT.md` and
`docs/legal-audit-2026-11-16/06_*`, `18_*`. Synthetic data only, local database, a local stand-in for the Messages API.
This is not legal advice.

## Method

There is one Anthropic client: `src/server/services/ai-coach.ts:96-105`. Its base URL is the real API unless
`ANTHROPIC_BASE_URL` points at this machine (`src/server/test-overrides.ts:183`), and demo mode answers in-process.
No other AI host, SDK or `fetch` call exists in `src/`, `supabase/` or the native shells. There are 8 provider call
sites and 9 entry points. Every one was driven through its real server code in
`tests/integration/ai-outgoing-payloads.test.ts`. The stand-in recorded each request body, and the assertions use
`JSON.stringify` of the system prompt, messages and tool results.

## Every AI path

Plan gate: `assertAiAllowed` (`ai-coach.ts:149-169`) refuses a plan with no AI allowance (`not_entitled`, :153). The
plan always comes from the member's entitlement row on the server (`api-auth.ts:41-45`, `auth.ts:53-59`), never from
the client. "AI consent" means `profiles.ai_data_consent_at`. Withdrawing it (`actions/profile.ts:79-87`) also clears
the health permission and turns coaching memory off.

| # | Path / entry point | Consent gates on the server | Plan gate | What is sent | Minimisation | Isolation | After withdrawal |
|---|---|---|---|---|---|---|---|
| 1 | **Coach chat**, `POST /api/ai/chat` mode `chat` → `coachTurn`; stream at `ai-coach.ts:339` | AI consent `ai-coach.ts:469-470`. Per item: journal needs a per-entry share flag **and** faith on (`coach/snapshot.ts:185-193`); limitations need wellness (`:257`); imported steps need the health permission (`:279`); memory needs memory on (`:195-197`), and "recovery" memories need wellness (`lib/coach/memory.ts:157`) | `ai-coach.ts:467` | Context: age, sex, height, goals, schedule, equipment, diet; 10 workouts with skip reasons; e1RM records; 90-day weights; 7-day food totals and targets; supplements; steps average; latest readiness score; program; 40-day challenge progress; shared journal excerpts; memories; coach style; up to 20 earlier turns of this conversation (24,000 characters). Plus tool results (below) | Journal: marked entries only, as excerpts. Steps: average only. Device name never sent. No email, display name, notes, photos or location | Every read uses the member's RLS session **and** an explicit `user_id` filter. Another member's conversation id gets `not_found` (`ai-coach.ts:474-476`) | Refused with `consent_required`. Nothing is sent |
| 1a | Read tools (`server/coach/tools.ts:571-630`) | As row 1. Sleep needs wellness (`sleep-summary.ts:19-22`, `analysis.ts:57`, `adaptive-training.ts:153`). Imported nights and readings need the health permission (`sleep-summary.ts:29-31`, `analysis.ts:60`, `adaptive-training.ts:156`). `recall_conversations` needs memory on and never reads "don't remember" chats (`tools.ts:540-542`) | – | `get_recent_workouts`, `get_exercise_history`: sets, top sets, records, skip reasons. `get_nutrition_summary`: per-day macros, today's item names and amounts, targets. `get_program_week`, `search_exercises`: program and catalog data. `get_food_nutrition`: local USDA lookup of the query text. `calculate`: sex, age, height, latest weight, goal, activity. `get_training_review`: 8 weeks of training, readiness scores, targets, program, sleep. `get_sleep_summary`: night durations, scores, sleep debt, check-in associations, wearable stages, heart rate, HRV and breathing (with permission). `analyze_lift_progress`, `get_recovery_summary`: sessions, check-in scores, sleep. `get_running_summary`: dates, distances, times, effort and source (no route). `recall_conversations`: up to 5 clipped snippets (240 and 360 characters). `get_program_recommendations`: onboarding answers, plan, current programs | No free-text notes are selected (sleep, check-in, recovery, meal, photo) | as row 1 | as row 1 |
| 1b | Proposal tools (`propose_*`, 9 tools) | as row 1 | – | Only a status. `propose_target_load` reads recent top sets. `propose_memory` checks its text against shared journal excerpts | Nothing is written until the member confirms | as row 1 | as row 1 |
| 2 | **Training-plan generation**, the same route in mode `plan`; `ai-coach.ts:567` | as row 1 | `ai-coach.ts:153-156` (plan allowance and flag) | Row 1's context plus the exercise catalog | as row 1 | as row 1 | as row 1 |
| 3 | **Weekly report**: the scheduled job `GET/POST /api/reports/weekly` (CRON_SECRET) → `runWeeklyReportJob` → `ensureWeeklyReport` (`weekly-reports.ts:256`), and the reports page (`progress/reports/page.tsx:28`). The call is at `weekly-reports.ts:140` | AI consent (`withAiRequest`, `ai-coach.ts:659-660`). **Sleep needs wellness, and imported nights need the health permission (`weekly-reports.ts:184`, `lib/domain/weekly-report.ts:132`). Fixed here (D1)** | `weekly-reports.ts:138` (`hasFeature(plan,"ai_coach")`) and `ai-coach.ts:661` | That week's totals: workouts, volume, records (exercise names), nutrition averages against targets, runs, sleep averages and stages, weight change | Totals only. No food names, notes, journal or photos | The service client reads with explicit `user_id` filters (`weekly-reports.ts:53-67`; `sleep.ts:93,129`; `progress.ts:100`) | The report is still made from rules. Nothing is sent |
| 4 | **AI meal plan**, `draftAiMealPlanAction` → `draftAiMealPlan` (`services/ai-meal-plan.ts:90`) | AI consent (`withAiRequest`) | `actions/ai-meal-plan.ts:20-26` (Pro and allowance) and `ai-coach.ts:661` | Targets, focus, meal slots, diet style, budget, the member's note (medical notes held back, `ai-meal-plan.ts:188-192`), "nutrition" memories (memory on only), dish list | Only the "nutrition" memory category | RLS and `user_id` filters | Refused. Nothing is sent |
| 5 | **Meal photo**, `POST /api/ai/food-photo` → `analyzeFoodPhoto` (`food-photo.ts:53`) | **Separate photo consent** (`food-photo.ts:52`) **and** AI consent | `ai-photo-guard.ts:171-175` (before the upload is read) and `ai-coach.ts:661` | The image, re-encoded and stripped of metadata (`route.ts:55`), and the member's note (300 characters) | Image never stored | – | Refused. Nothing is sent |
| 6 | **Label photo**, `POST /api/ai/label-photo` → `readLabelPhoto` (`label-photo.ts:19`) | Photo consent (`:18`) and AI consent | `label-photo/route.ts:32` and `ai-coach.ts:661` | The image only | as row 5 | – | as row 5 |
| 7 | **"Ask AI about this food"**, `explainProductAction` (`actions/food-quality.ts:70`) | AI consent | `ai-coach.ts:661` | Open Food Facts product facts, goal, diet style, daily targets, product filters | – | RLS and `user_id` filters | Refused. Nothing is sent |
| 8 | **Bible study helper**, `askBibleAction` → `askBible` (`bible-ai.ts:127`, `messages.create`) | AI consent (`bible-ai.ts:85-95` and `withAiRequest`) | `bible-ai.ts:110` and `ai-coach.ts:661` | The question, up to 6 earlier turns of this thread, and retrieved Bible passages | Never the journal or any other record | History is filtered by `user_id` (`:124`), so another member's thread id adds nothing | Refused. Nothing is sent |

Nothing else sends data to an AI provider:

- **Memory extraction:** none runs automatically. The model can only *propose* a memory (`propose_memory`), and the
  member saves it.
- **Conversation summarisation:** none. Earlier turns are sent only for the same conversation, and other
  conversations only through `recall_conversations`, as short snippets.
- **Background jobs:** the weekly report is the only one.
- **Photos:** progress photos and Body Scan photos are read by no AI path.

## Test evidence

`tests/integration/ai-outgoing-payloads.test.ts`: 16 tests, **16 passed**. It uses two Pro members, A and B, plus a
Free member, with marked rows in the journal (shared and unshared), limitations, steps (typed and Apple Health), sleep
(typed, and a ring's with a device name, HRV and breathing), notes on sleep, check-ins, recovery and meals, the food
log, workouts, progress-photo and Body Scan rows, sealed memories (nutrition and recovery), conversations (one ordinary,
one "don't remember") and a Bible thread.

1. Without AI consent, every entry point is refused and the provider receives nothing.
2. Free plan with every consent given: every entry point is refused and nothing is sent.
3. Coach chat with all 11 read tools (AI and wellness consent, no health permission). There are positive controls,
   then: no imported value, device name, unshared journal, notes, photos, display name, email, "don't remember" chat or
   anything of B's.
4. Health permission on: imported steps, HRV and breathing are sent, the device name still is not. Permission off:
   they are gone again.
5. A journal entry is sent only while it is marked "Share with AI Coach".
6. Training-plan generation sends the same minimised context.
7. Weekly report, called as the scheduled job calls it: only A's figures (exact night counts and averages), and the
   ring's night only with the permission.
8. **Weekly report without wellness consent: no sleep figures (D1; fails without the fix).**
9. Without wellness consent the coach gets no limitation note, recovery memory or sleep.
10. Cross-account: B's conversation id gives `not_found` and nothing is sent. B's Bible thread id adds nothing of B's.
11. Bible helper: no record of any kind.
12. Food and label photo: the image and the note only. Without photo consent nothing is sent.
13. "Ask AI about this food": product facts and targets only.
14. Meal plan: the note and nutrition memories only. No recovery memory, limitation or journal.
15. After the real `setAiDataConsentAction(false)`, the health permission and memory are cleared and every entry point
    sends nothing.
16. Across every captured request: no photo or scan path, note or image (only the 2 uploaded test images), and nothing
    of B's.

Unit test added in `tests/unit/health-ai-sharing.test.ts`: `weeklyInputForProvider` (wellness, health permission,
steadiness).

Full runs:

| Check | Result |
|---|---|
| `npx vitest run --project integration` | 82 files passed, 1 skipped. **496 passed, 1 skipped**. The skipped one is `food-quality-live`, which needs the live network |
| `npx vitest run --project unit` | 260 files. **4,739 passed, 1 skipped** |
| `npx eslint src tests` | Clean |
| `npx tsc --noEmit` | One error, in `tests/unit/reliability-closure.test.ts:227`. That is another worker's untracked, in-progress file. No errors in the files changed here |

These counts include other workers' in-progress test files on the shared worktree.

## Defects found and fixed

| # | Defect | Fix | Test |
|---|---|---|---|
| D1 | The weekly report sent sleep figures (nights, average time asleep, stages, steadiness) to the provider with no wellness consent. Sleep entries stay after wellness consent is withdrawn (`profile.ts:60-73`). The coach's tools stop using them, but the weekly report did not. This contradicted the stated rule "After withdrawal, sleep is no longer read for AI" (06 map, section 4.10). The schedule steadiness was also worked out from imported nights and sent even when those nights were withheld | New `weeklyInputForProvider` (`src/lib/domain/weekly-report.ts:125-135`), used at `src/server/services/weekly-reports.ts:180-186`. Without wellness consent no sleep is sent. Without the health permission imported nights are left out, and steadiness is cleared whenever a night is left out. The member's own report page is unchanged | Integration test 8 (failed before the fix, passes after); unit test above |

No user-facing wording was changed. The 06 map's statement is now true.

## Remaining risks, and what can't be verified here

- **Provider retention, training use and the data-processing agreement:** not in the repository.
- **Live model behaviour** (following the no-diagnosis rules, prompt injection through shared journal text or food
  names): the stand-in's replies are scripted, so this needs the live evaluation in `docs/ai-eval`.
- **Hosted configuration:** the real `ANTHROPIC_API_KEY`, `WEEKLY_REPORT_AI`, the cron secret and the feature flags.
  `ANTHROPIC_BASE_URL` is ignored unless it points at this machine.
- **Readiness and check-in scores** (snapshot `:173`; `analysis.ts:45`; `adaptive-training.ts:60`) are not filtered by
  wellness consent in the query. They depend on being deleted when consent is withdrawn (`profile.ts:65-68`). If that
  deletion partly fails, scores could still be sent until the member retries.
- **Free text the member types** (chat messages, meal-plan and photo notes) is sent as written. Earlier turns of a
  conversation go back to the provider, and withdrawing consent doesn't delete them in the app.
- The existing unit test "the weekly figures given to the AI provider leave imported nights out" returns early inside a
  `try/catch`, so it could pass without checking anything. It was left unchanged; the new tests cover that behaviour.

## For counsel

1. Is withholding sleep from the weekly report without wellness consent (D1) the right reading? It matches the coach.
2. The consent card still doesn't list: Bible questions, weekly-report figures, label photos, sleep check-in factors
   (caffeine, alcohol, stress) and the running summary (06 map, D3).
3. Should the readiness and check-in scores be gated by wellness consent at query level, rather than relying on
   deletion?
4. Is a consent log needed (text and time agreed) instead of a single timestamp?
5. Retention period for stored AI conversations and coach memories.
6. Provider terms: no training on member data, retention, deletion on request, sub-processors.
