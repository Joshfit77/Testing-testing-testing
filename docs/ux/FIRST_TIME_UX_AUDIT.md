# Narrow Gate Fitness — first-time user experience audit and redesign (November 9, 2026)

Branch `claude/first-time-ux`, cut from `claude/faith-discipleship` at 6c0832f. Not merged into `main`, not deployed, no
payments enabled. The unmerged badge work in PR #9 (`claude/badge-progress`) was not edited. Its files are listed in
§7, and every fix that needs one of them is marked **BB** and deferred.

## 1. Method

- **Baseline:** the redesigned build at 6c0832f, running in demo mode against a local database. I did not use screenshots
  from the clickable demo.
- **Viewport:** iPhone 15 Pro (393 × 852, 2× screenshots).
- **Demo-only bar:** hidden in every measurement, so the numbers match what a production member sees.
- **Three member states**, each with every route captured (`scripts/ux/capture.mjs`):
  - **New:** a brand-new Free account, measured right after the quickest honest onboarding.
  - **Occasional:** the sample history trimmed to a sparse last week: 2 workouts, 1 run, meals on 2 days, 3 nights,
    2 readings (`scripts/ux/seed-occasional.ts`).
  - **Established:** the sample member, with about 8 weeks of Pro history.
- **What each capture includes:**
  - 90 member-facing routes and dynamic pages per state (85 for the new member, who has no history detail pages).
  - The onboarding sequence.
  - Per-screen measurements: page height in screens, words, controls, text under 12 px and 14 px, targets under 44 px,
    horizontal overflow, controls visible above the fold, and load time.
- **Screen review:** five reviewers each read every screenshot and the source for one area. Their findings are in
  [`audit/`](audit/), one file per area, each covering:
  - every screen: purpose, primary action, whether a first-time member understands it, excess, friction, accessibility,
    states and recommendation;
  - a ranked issue list.
- **Task journeys:** 13 tasks run from Home to completion for all three states (`scripts/ux/journeys.mjs`). Each one
  counts taps, typed fields, scrolls, screens, errors and blocked states.
- **Time figures:** these are **model estimates** (keystroke-level style), not measurements of people.

Each finding is classed as one of:
- **APP:** a real product issue.
- **DEMO-ONLY:** demo notes or simulated labels a production member never sees.
- **DEVICE:** needs a physical phone to judge (GPS, HealthKit, camera, haptics, keyboard, notifications).

## 2. Baseline at a glance

- **No errors on any route.** I found no error pages, no console errors and no failed requests on any route in any state.
  I also found no horizontal overflow at 393 px.
- **Longest screens:**

  | Screen | Screens tall | Words |
  | --- | --- | --- |
  | Programs | 24.7 | 2,252 |
  | Exercise library | 24.2 | — |
  | Journey schedule | 10.7 | — |
  | Supplements | 9.5 | 1,248 |
  | Progress overview | 8.5 | — |
  | Notifications and Faith reminders | 7.0 | 886 |
  | Sleep dashboard | 6.4 | — |
  | Billing | 6.3 | — |
  | Faith hub | 4.6 | 872 |
  | Nutrition diary | 4.4 | 1,036 |

- **Small targets:** 469 controls under 44 px across 42 screens. Most are 36 px chips and buttons, which pass WCAG AA
  (24 px) but fall short of Apple's 44 pt guideline. The worst were 13–16 px checkboxes on the scanner screen and 24 px
  memory-practice word buttons.
- **Onboarding:** 19 interactions across 7 screens from the login screen to the first workout (6 question screens, then
  the plan).

### Task journeys before (interactions = taps + typed fields; "scr" = scrolls needed to reach a control)

| Task | Target | New | Occasional | Established |
|---|---|---|---|---|
| Find and start today's workout | under 30 s | 1 tap | 1 tap | 1 tap |
| Log one set (from the workout screen) | 2–3 interactions | 2 (1 tap + weight) | 2 | 1 (prefilled) |
| Log a familiar food | under 15 s | 5 (search path) | 2 (one-tap re-log) | 2 (one-tap re-log) |
| Start outdoor GPS recording | under 15 s after permission | **blocked** (Free: no Start, no free alternative on the screen) | 3 | 3 |
| Log a treadmill session | — | 7, 3 scr | 7, 1 scr | 7, 1 scr |
| Find the Sleep dashboard | 2 taps or fewer | 1 tap + 1 scroll | 1 + 1 scr | 1 + 1 scr |
| Log last night's sleep by hand | — | 5 (incl. consent) | 3 | 3 |
| Continue today's Bible reading | 1–2 taps | 1 tap, lands on the 66-book index | 1 tap\* | 1 tap\* |
| Write a private prayer | — | 4, 1 scr (Save below the fold) | 4 | 4 |
| Ask the AI Coach a suggested question | — | **blocked** (Free: disabled chat, veteran prompt, no price) | 2 | 2 |
| Find membership and billing | — | 2 | 2 | 2 |
| Find My Progress | — | 2 | 2 | 2 |
| Find training programs | — | 2 | 2 | 2 |

\* The harness reached today's passage through the reminder row. Home's prominent "Continue reading" card opened the last
chapter read (John 3), not today's assigned passage (F1).

Every returning-member task was 1–3 interactions. The friction was concentrated in a few places:
- what a **new Free member** meets (two blocked tasks, a 5-step food search, veteran coach prompts, "Day 33 of 40");
- **misleading or fragmentary content** (verse fragments, the wrong "Continue reading", the 1RM labelling);
- **screen length**.

## 3. Issues ranked by user impact

Impact reflects the effect on successful daily use. IDs refer to the area audits.

| Rank | ID | Issue | Impact | Members affected | Class | Status |
|---|---|---|---|---|---|---|
| 1 | TR1 | A Free member's main Run choice is a locked "Outdoor run PRO" card, and the record screen is a dead end with no free path | High | New / Free | APP (half **BB**) | see §6 |
| 2 | I-2, I-5 | Free Coach: a disabled chat with veteran prompts ("Why did my bench stall?") and no price | High | New / Free | APP | see §6 |
| 3 | F1 | "Continue reading" opens the last chapter opened, not today's passage | High | All with a journey | APP | see §6 |
| 4 | F2 | "Today's devotional · Day 33 of 40" shown to every account, enrolled or not | High | All | APP (bug) | see §6 |
| 5 | I-1 | The verse of the day is shown as a fragment ("“Therefore…”", "…does not contr…") | High | All | APP | see §6 |
| 6 | N2 | No undo after logging food; removal is a hard delete | High | All | APP | see §6 |
| 7 | I-3, I-4 | Home's main action is an unlabelled play icon, and some goals put nutrition above the workout | High | All | APP | see §6 |
| 8 | N1 | The diary's "Scan barcode" opens the quality analyser, not logging (6+ taps instead of 4) | High | All | APP | see §6 |
| 9 | PS-01 | The Sleep dashboard leads with explanation and data source; last night starts at the fold; 6.1 screens | High | All | APP | see §6 |
| 10 | TR2, TR3 | Programs (24.7 screens) and Exercises (24.2 screens) | High | All | APP | see §6 |
| 11 | TR4 | The logger has two gold primaries and six secondary controls around Complete set | High | All | APP (half **BB**) | see §6 |
| 12 | N3, N4 | Saved meals are buried and default to Dinner; Free members meet Pro locks while logging | High | All / Free | APP | see §6 |
| 13 | F3 | Today's reading can't be marked complete in the reader | High | Journey members | APP | see §6 |
| 14 | PS-02 | The sleep-stage chart's time labels overlap and can't be read | High | Watch users | APP | see §6 |
| 15 | PS-03 | Check-in and manual log are dead ends before consent | Medium | New | APP | see §6 |
| 16 | F4–F7 | Faith hub repetition; the restart rule is a newcomer's first message; prayer Save below the fold | Medium | All | APP | see §6 |
| 17 | TR6 | Exercise demo subject small and dark; 22 px scrub bar | Medium | All | APP | see §6 |
| 18 | TR8 | Weight stepper keeps odd decimals (292.1 → 297.1) | Medium | Established | APP | see §6 |
| 19 | I-6, I-8 | Billing is 6 screens with "Faith is always free" at the bottom; privacy controls scattered | Medium | All | APP | see §6 |
| 20 | I-12 + cohesion | Quick add has no sleep entry, and "Quick workout" ignores the day's program workout | Medium | All | APP | see §6 |
| 21 | PS-08, PS-11, PS-09 | A nap keeps overnight defaults; a time-in-bed-only night scores 100; four different bedtime cues | Medium | Sleep users | APP | see §6 |
| 22 | N6, N7, N9, N10 | Diary, Supplements and Planner too long; a new member's Add food opens on 25 USDA category chips | Medium | All | APP | see §6 |
| 23 | TR10, TR11/PS-05 | Run controls not large; chart y-axis labels clipped | Medium | All | APP / DEVICE | see §6 |
| 24 | PS-14 | No loading boundary on 8 progress and sleep routes (load 0.8–1.5 s) | Low | All | APP | see §6 |
| 25 | TR5, TR7 | New badges below the fold on Workout complete; the exercise page buries Setup/Execution/Mistakes | Medium | All | APP **BB** | deferred to PR #9 |
| 26 | PS-04, PS-06, PS-07 | Overview mixes 1RM/e1RM and goal units; badges show everything; body map "Not assessed" | Medium | Established | APP **BB** | deferred to PR #9 |
| 27 | I-7, I-9, I-13 | Notifications 23 toggles; Profile 3.9 screens; preferences jargon | Medium | All | APP | not in this pass |
| 28 | I-10 | The tab bar folds Progress into "You" | Medium | All | APP | evaluated, §5 |
| — | PS-10, I-22, N21 | Alarm, restore purchases, camera/GPS/Health permission prompts, notification delivery | — | — | DEVICE | needs a physical phone |
| — | F16, I-21, N19, N20, PS-17, TR19 | Demo notices, simulated labels, sample routes | — | — | DEMO-ONLY | — |

## 4. Product cohesion review

- **Goal-based Home personalization:** Home is ordered by goal, but for lose-fat and general-health goals the order put
  nutrition above today's workout (I-4). The fix keeps goal-based ordering for everything else, with the workout always
  first. The verse is still the opening line.
- **Consistent Quick Add:** the header Quick add offered Food, Water, Workout, Outdoor run, Prayer and Weight, but no
  Sleep, and its workout tile started a blank session even on a program day. It now covers every daily log and starts
  the day's planned workout.
- **Connections between areas:**
  - Home links straight to Sleep, Faith reading, Nutrition and the workout.
  - The coach reads training, food and sleep (approval-only changes).
  - Sleep feeds Recovery.
  - Weak links remain:
    - Faith reading wasn't connected to the journey's day (F1, F3).
    - Free-member paths ended in locks rather than in the free alternative (TR1, N4, I-5).
- **Account data ownership:** export and delete exist (Profile → `/api/account/export`, delete-account form). Consents are
  enforced where the data is collected, but they were scattered (I-8). A single "Privacy & permissions" list now links to
  each.
- **Accessibility:**
  - No overflow, and reduced motion is respected.
  - Remaining small targets are listed in §2.
  - The food search box had only a placeholder and no accessible name.
- **Recovery from interrupted tasks:**
  - Workout drafts persist on the device and resume from the Train tab and Quick add.
  - GPS recordings recover after a reload (verified in browser e2e earlier; device behaviour untested).
  - Unsent form drafts are kept per member (`src/lib/drafts.ts`).
  - The tab bar remembers the last screen in each tab.
  - Food logging had no undo (N2).

## 5. Navigation evaluation: Home · Train · Food · Faith · Progress?

The current tabs are Home · Train · Nutrition · Faith · You, with My Progress, Sleep, the Coach and settings under You.
Here are the measured paths:

| Destination | Today | With Home · Train · Food · Faith · Progress + header avatar for settings |
| --- | --- | --- |
| My Progress | 2 taps (You → My Progress) | 1 tap |
| Sleep dashboard | 1 tap from Home's Sleep row (after 1 scroll) or 2 (You → Sleep) | 1 tap from Home, or 2 (Progress → Sleep) |
| Settings / billing | 1 / 2 taps (You / You → Plans) | 1 / 2 taps (avatar / avatar → Plans) |
| Coach | 1 tap (header) | 1 tap (header) |

**Recommendation:** adopt Home · Train · Food · Faith · Progress, with the account avatar in the header (the avatar
already exists in the header code; it is hidden on phones).
- It removes one tap from every visit to Progress and puts Sleep and badges one level up.
- It costs nothing elsewhere.

This branch does not change the tab bar. The owner asked for a navigation change to be prototyped and tested before it
is committed, and the change touches about 40 browser-test assertions and every member's muscle memory. It should go in
a separate, measured prototype with real-member testing.

## 6. What was changed in this pass

Filled in from the merged implementation; see `FIRST_TIME_UX_RESULTS.md` for before/after screenshots, the per-change
table (original issue, changed interaction, member benefit, verification) and the after measurements.

## 7. Deferred to the badge branch (PR #9, `claude/badge-progress`)

- **Files not edited:**
  - `docs/BADGES.md`
  - `progress/badges/page.tsx`
  - `progress/overview/page.tsx`
  - `run/page.tsx`
  - `train/exercises/[slug]/page.tsx` and its `history/page.tsx`
  - `globals.css`
  - `muscle-map.tsx`, `exercise-milestone.tsx`, `milestone-celebration.tsx`, `workout-logger.tsx`
  - `achievements.ts`, `exercise-milestones.ts`, `record-labels.ts`
  - `actions/workouts.ts`, `services/activities.ts`, `services/exercise-history.ts`, `services/workouts.ts`
- **Issues deferred until that work merges:**
  - TR5: earned badges first on Workout complete.
  - TR7: exercise page order — demo, then cues, then Setup/Execution/Mistakes.
  - The /run halves of TR1 and TR13: free manual log as the primary card for Free members; treadmill as the default
    for the manual log.
  - The header half of TR4: Finish secondary until all sets are done.
  - PS-04: e1RM labelling and goal units on the overview.
  - PS-06: badges, showing the next 3 achievements rather than everything.
  - PS-07: body map "Not assessed".

## 8. What needs people or phones

These are not claimed. Each needs physical-device or human testing:
- **Real-time targets:** the human-time targets ("under 30 s", "under 15 s", "90% unassisted completion").
- **Device features:**
  - GPS accuracy and background recording;
  - HealthKit / Health Connect import;
  - the smart alarm;
  - the camera barcode and photo flows;
  - haptics;
  - notification delivery;
  - keyboard behaviour, autofill, numeric keypads, Dynamic Type at the largest sizes, safe areas on notched and
    Dynamic Island phones;
  - restore purchases.
