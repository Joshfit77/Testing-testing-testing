# UX simplification, 2026-11-06

The owner asked for Narrow Gate Fitness to be dramatically easier to navigate, with every feature kept: five tabs,
less swiping and scrolling, a personalized and customizable Home, universal Quick Add, fast workout and nutrition
logging, Faith immediately reachable, consistent Back, preferences remembered, unified search, clear errors,
distraction-free workouts, notification control, easy-to-find subscription and account settings, measured before and
after across user groups and phone sizes, with a report of what changed, what improved, what remains and what still
needs real devices.

**What this report is not.** Everything below was measured in Chromium emulating iPhones (and Android sizes in the
device matrix), on a local production build against a local database, with a scripted member. No real phone, no real
member, no screen reader session and no hosted deployment was involved. The app is **not** described here as
universally accessible or fully tested; section 7 lists exactly what remains and what needs real devices. Nothing was
deployed, no payment was enabled, nothing was merged into `main`.

## 1. What changed

Nothing was removed. Features moved into a clearer hierarchy; a few things were added only where the owner asked
(Quick Add, unified search, Customize Home, Focus mode) and each of those reuses the existing flow underneath.

### Navigation

| Before | After |
| --- | --- |
| Tabs: Home, Train, Run, Food, Faith. Profile and My Progress behind an avatar in every header; the AI Coach behind a pill. | Tabs: **Home, Train, Nutrition, Faith, You**. Run lives under Train (it is training); My Progress, the AI Coach screen and every setting live under You. `src/components/shell/nav-config.ts`. |
| Every main header spent a row on the logo and the avatar, then a row on the title and the AI Coach pill. | One row: title, then **Search**, **Quick Add (+)** and **AI Coach**. The avatar stays only in the desktop sidebar layout (the You tab replaced it on phones). `src/components/shell/main-header.tsx`. |
| Tab taps returned to the last screen in that section; a workout in progress was reached through the floating Resume pill. | Same memory, plus: **while a workout is in progress the Train tab goes straight back to it** (the draft is on the device and the server, so switching tabs never loses it). The AI Coach and Search are never "remembered" as a tab's last screen. `src/components/shell/app-shell.tsx`, `src/lib/nav-memory.ts`. |
| 10 screens had no Back control (billing, preferences, badges, overview, history, recovery, run activities and their edit screen, Faith reminders, plan). | `PageHeader` has a `back` prop (`BackLink`, which goes back in history when you came from that parent, else opens it). Every one of those screens has it; Run, My Progress and the calendar have a Back to their owning tab. |
| Horizontal chip rows that needed a swipe (Faith themes). | Chips wrap. No screen in the app requires a horizontal swipe; the measurement counts "swipe rows seen" and it is 0 on every journey after (2 before, on the Faith journeys). |

### Home (personalized, customizable)

`src/app/(app)/home/page.tsx`, `src/lib/layout-prefs.ts`, `src/components/profile/customize-layout.tsx`.

- Modules: **Today's workout** (Start / Resume, the one thing that can't be hidden), **Today's nutrition** (calories and
  protein against targets, **water with a +250 ml tap**, Log food, Scan barcode), **Faith today** (Continue reading at
  the member's chapter and verse, Today's devotional, Pray), **Quick actions** (Run, Log food, AI Coach), Verse of the
  day, This week (workouts, bars, My Progress), Sleep & Recovery, Training calendar.
- **Order by member** (one navigation, one app; the order follows the member's own onboarding answers):
  fat loss / general health → nutrition first; muscle / strength → workout, nutrition, recovery higher; conditioning,
  athletic, combat sports → workout, then quick actions (the run is one tap), then recovery; a short schedule (3 days
  or fewer at 30 minutes or less, the busy-parent pattern) → workout and quick actions first; Faith switched off in
  onboarding → Faith modules last, never removed. A beginner sees one line under Start: "Tap Start and the app walks
  you through each exercise…". Nothing is inferred from age; "older adult" is not something the app guesses.
- **Customize Home** (You → Customize Home, its own screen at `/profile/customize`, also linked from the bottom of
  Home and Faith): reorder with up/down, hide/show, hide Faith-tab sections, reset to the default for the member's
  goal. Saved on the profile (`layout_prefs`, below), so it follows the member to every device.
- Moved off Home: Badges, Steps, Supplements, Recovery shortcuts (now under You → My Progress, Nutrition → More tools,
  Train → More training tools).

### Quick Add (universal)

`src/components/shell/quick-add.tsx`. The **+** in every main header opens one sheet: **Food** (opens the existing Add
food dialog on Nutrition via `/nutrition?add=1`), **Water +250 ml** (logged from the sheet, same server action as the
Nutrition tab), **Quick workout** (resumes a workout in progress, else starts an empty one), **Outdoor run** (the GPS
recorder), **Prayer** (the journal), **Weight** (the overview's weight form). No second way of saving anything.

### Active workout

`src/components/workout/current-set-card.tsx`, `src/components/workout/workout-logger.tsx`.

- The current-set card is first on the screen with the 2D demonstration, "Last time", the target, weight/reps
  steppers, **Complete set** (56 px tall) and now **Next exercise** (48 px) beside **Skip set**. Next exercise moves on
  without a dialog; the sets left are marked not done with one **Undo**. "Skip exercise (say why)" keeps the reason
  sheet with the pain advice, under the form-cues fold with Swap.
- **Focus** (header button): only the sticky header (clock, progress, Finish) and the current set stay on screen; the
  tab bar steps aside; "Show everything" brings it all back. Remembered for the session.
- Rest alerts, workout notes and Discard are under one fold ("More") instead of three cards below the exercise list.
- Unchanged and verified again: every set change is saved on the device at once and to the server in the background;
  "Saved on device" / "Synced" in the header; the finish message explains an offline or signed-out failure and keeps
  the workout (`finishFailureMessage`); the Resume pill and the Train tab both bring a member back to it.

### Nutrition

`src/app/(app)/nutrition/page.tsx`, `src/components/nutrition/quick-relog.tsx`, `src/components/nutrition/nutrition-client.tsx`.

- First screen: day chooser, then **Add food / Scan barcode / Meal photo** as three large buttons, then **Recent
  foods, one tap** (the last six, each with one Add that logs it again into the meal for the time of day), then the
  totals ring with the three macro bars, then water, then the meals.
- Everything else is still on the page, folded under clear headings: Calories remaining & today's estimate,
  Nutrients, This week & history, Weight goal, Targets & calorie budget, Saved meals/recipes/my foods, More tools
  (Nutrition Score, planner, grocery, insights, supplements, your diet).
- No daily target set → "No daily target set: log what you like, or set targets" (nobody is forced into calorie
  counting; the ring shows what was eaten either way).
- **Under 18**: the 5-week weight projection and the weight-goal pace/goal-date sentence are not shown (from the
  birth year the member gave; nothing else changes and nothing else is inferred). `isMinor` in `src/lib/layout-prefs.ts`.

### Faith

`src/app/(app)/faith/page.tsx`, `src/app/(app)/faith/bible/[book]/[chapter]/page.tsx`.

- First screen: **Continue reading** (book, chapter, verse remembered by the reader a second after a chapter opens),
  **Today's devotional** (with the day of 40), **Write a prayer**; then Today (journey, challenge, fitness), then the
  Bible tools.
- Chapter reader: **Previous / Next chapter at the top and the bottom** of every chapter, named for screen readers; no
  swipe anywhere.
- Scripture by theme, Devotionals and the full verse with reflection are folded; themes wrap instead of scrolling
  sideways, and the Daily practices day picker is a seven-column row instead of a swipe strip. Hidden sections come
  from the same Customize Home screen.

### You (settings, progress, membership)

`src/app/(app)/profile/page.tsx`. One tab: My Progress (with this week's count and streak), Badges, Sleep & Recovery,
Goals & training preferences, **Notifications**, **Plans & billing**, Customize Home (each its own screen with Back
to You); then the account, display, privacy, export and delete sections exactly as before, and Sign out.

### Search

`src/app/(app)/search/page.tsx`, the magnifier in every main header. One search over exercises, programs, foods,
recipes, the Bible (verse hits open the chapter at the verse) and the app's own screens and settings ("notifications",
"billing", "text size", "export"…). Each result opens the screen that already handles it.

### Small accessibility fixes made along the way

- The solid red button (Delete account, Discard) uses a darker fill so its white text reads at 5.6:1 (it was 3.8:1).
- The Nutrition macro list is a valid definition list (axe flagged the old nesting).
- The diary's entry buttons and the Faith day chips are named by their printed text plus a spoken suffix, instead of
  a label that differed from what is printed.
- The Home workout link no longer carries a label that differed from its text.

### Remembered preferences, errors, notifications

- Remembered: tab locations and scroll per section, dialog tabs and search text, form drafts (journal, food, custom
  foods, quick add, coach), workout drafts, Bible reading position and text size, display settings, and now the Home
  and Faith layout. All of these existed; the layout is the one addition.
- Errors: the app's error screen says "We couldn't load this page. Check your connection and try again…" with a Try
  again; actions return plain sentences ("Couldn't save that setting. Please try again.", "That food couldn't be found.
  It may have been deleted."); the workout's finish failure says what happened and that nothing is lost. Reviewed, not
  changed.
- Notifications: unchanged screen, now one tap from the You tab and found by Search.

### Database change (explained before applying, as the owner asked)

`supabase/migrations/20261106000057_layout_prefs.sql` adds one nullable JSON column, `profiles.layout_prefs`, with a
column-level update grant like the other display preferences. It is additive; rollback is `alter table
public.profiles drop column layout_prefs;` and nothing else reads it. It was applied to the local database only.
Why a column rather than browser storage: the owner asked for preferences to be remembered and for the dashboard to be
customizable; a per-device setting would differ between a member's phone and tablet.

## 2. How it was measured

`scripts/ux/measure-journeys.mjs` drives the real app in Chromium at iPhone 15 Pro size (393×852, touch, device scale
1) on the local demo server (the sample member, Pro view, nothing charged), signed in once, and for each of 24
everyday journeys counts **taps**, **how far the page had to scroll** to reach each control (0 = it was on the first
screen), **horizontal swipe rows seen**, **time**, **page errors**, and whether the journey **completed**. The same
script with the same journeys ran on the layout as it was on 2026-11-05 (`before`) and on the finished layout
(`after`); where the new layout offers a shorter path (the control is on the first screen) the journey takes it, so
the comparison is "how far does a member have to go", not "same clicks on a different page". Every journey starts
with no remembered tab locations and no workout draft on the device (except the three that begin inside a workout),
the way a member who has just opened the app would. Each main screen is also measured for height in screens, cards,
controls, controls smaller than 44 px, sideways scroll, and axe-core 4.14 WCAG 2.1 A/AA violations. The `before`
numbers were taken on the same script with the earlier page; six of the "small targets" on every screen are the
demo bar's own Free/Pro, Back/Next and presenter controls, which are not part of the app.

`scripts/ux/compare-journeys.mjs before.json after.json` prints the tables below. The raw JSON for every run is kept
with the session, not in the repository.

## 3. Before and after, iPhone 15 Pro

| Journey | Before (taps, scrolling) | After (taps, scrolling) | Taps | Scrolling px | Time after |
| --- | --- | --- | --- | --- | --- |
| Start today's workout | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.4 s |
| Complete the first set of a workout | 2 taps, 0 px | 2 taps, 0 px | 2 → 2 (same) | 0 → 0 (same) | 1.1 s |
| Move on to the next exercise | 2 taps, 531 px | 1 tap, 84 px | 2 → 1 (−1) | 531 → 84 (−447) | 0.6 s |
| Log a recent food again | 3 taps, 619 px | 2 taps, 64 px | 3 → 2 (−1) | 619 → 64 (−555) | 1.1 s |
| Open food search | 2 taps, 374 px | 2 taps, 64 px | 2 → 2 (same) | 374 → 64 (−310) | 1.1 s |
| Scan a barcode | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.1 s |
| Log a glass of water | 2 taps, 1380 px | 1 tap, 0 px | 2 → 1 (−1) | 1380 → 0 (−1380) | 0.4 s |
| Continue Bible reading | 2 taps, 648 px | 1 tap, 178 px | 2 → 1 (−1) | 648 → 178 (−470) | 0.4 s |
| Write a prayer | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.1 s |
| Open today's devotional | 2 taps, 1408 px | 1 tap, 230 px | 2 → 1 (−1) | 1408 → 230 (−1178) | 0.4 s |
| Start a GPS run | 2 taps, 64 px | 1 tap, 323 px | 2 → 1 (−1) | 64 → 323 (+259) | 0.4 s |
| Open the AI Coach | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.5 s |
| See My Progress | 1 tap, 720 px | 1 tap, 615 px | 1 → 1 (same) | 720 → 615 (−105) | 0.4 s |
| Open Plans & billing | 2 taps, 0 px | 2 taps, 64 px | 2 → 2 (same) | 0 → 64 (+64) | 1.0 s |
| Open notification settings | 2 taps, 0 px | 2 taps, 64 px | 2 → 2 (same) | 0 → 64 (+64) | 0.9 s |
| Open the training calendar | 1 tap, 892 px | 1 tap, 714 px | 1 → 1 (same) | 892 → 714 (−178) | 0.4 s |
| Open the exercise library | 2 taps, 365 px | 2 taps, 64 px | 2 → 2 (same) | 365 → 64 (−301) | 1.0 s |
| Finish a workout | not completed ("Finish & save" is disabled here (nothing to confirm yet)) | 2 taps, 0 px |  |  | 1.0 s |
| Review today's nutrition (calories and macros in view) | 1 tap, 306 px | 1 tap, 325 px | 1 → 1 (same) | 306 → 325 (+19) | 0.5 s |
| Read a Bible chapter (Scripture text in view) | 2 taps, 648 px | 1 tap, 180 px | 2 → 1 (−1) | 648 → 180 (−468) | 0.5 s |
| Turn to the next chapter | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.5 s |
| Change training goals | 2 taps, 0 px | 2 taps, 64 px | 2 → 2 (same) | 0 → 64 (+64) | 0.9 s |
| Find an advanced training tool (Training review) | 2 taps, 557 px | 3 taps, 486 px | 2 → 3 (+1) | 557 → 486 (−71) | 1.4 s |
| Return to Home from deep in the Bible | 1 tap, 64 px | 1 tap, 64 px | 1 → 1 (same) | 64 → 64 (same) | 0.4 s |
| **Total over the 23 journeys completed both times** | **40 taps, 8704 px** | **34 taps, 3711 px** | **40 → 34** | **8704 → 3711** | |

| Screen | Before: screens tall, cards, controls, small targets | After: screens tall, cards, controls, small targets | axe (WCAG A/AA) before → after |
| --- | --- | --- | --- |
| /home | 2.3, 12, 30, 7 | 2.6, 11, 34, 7 | label-content-name-mismatch×3 → none |
| /train | 1.8, 11, 28, 6 | 1.3, 6, 28, 7 | label-content-name-mismatch×1 → none |
| /nutrition | 9.4, 28, 98, 53 | 4.9, 18, 103, 27 | label-content-name-mismatch×11 → none |
| /faith | 11, 45, 73, 15 | 6.3, 28, 73, 12 | label-content-name-mismatch×8 → none |
| /profile | 3.8, 4, 30, 10 | 4.1, 4, 33, 10 | color-contrast×1, label-content-name-mismatch×1 → none |
| /progress | 2, 7, 17, 7 | 2, 7, 18, 7 | label-content-name-mismatch×1 → none |
| /run | 3.5, 11, 28, 14 | 3.5, 11, 29, 14 | label-content-name-mismatch×1 → none |
| /train/workout | 3.5, 9, 59, 39 | 1, 4, 13, 6 | label-content-name-mismatch×5 → none |

**Reading the numbers.** The seven journeys that got shorter by a tap are the ones the owner named first: water,
the devotional, continuing the reading, the next exercise, a run, re-logging a food. "Open Plans & billing",
"Notifications" and "Change goals" gained 64 px of scrolling (one tab-bar height) because they moved from a header
avatar to the You tab, where the whole list is on the first screen; the tap count is unchanged. "Start a GPS run"
trades one tap for a scroll on Home because Run is now a quick action under the workout and nutrition cards, and a
member can put Quick actions first from Customize Home. "Find an advanced training tool" costs one more tap (Train,
More training tools, Training review) and 71 px less scrolling: the advanced tools are deliberately one fold away. "Finish a workout" did not complete before the change
because its "Finish & save" button was disabled on a workout with no set logged; after, the confirmation is reachable
with the completed set in the same place.

### Other sizes and large text

| Size | Journeys completed | Taps (all journeys) | Scrolling px (all) | Swipe rows | Page errors | Screens tall: Nutrition / Faith / You | Sideways scroll | axe A/AA violations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone 15 Pro, 393×852 | 24 of 24 | 36 | 3,711 | 0 | 0 | 4.9 / 6.3 / 4.1 | none | 0 |
| iPhone SE, 320×568 | 24 of 24 | 36 | 9,144 | 0 | 0 | 8 / 10 / 6.8 | none | 0 |
| iPhone 15 Pro Max, 440×956 | 24 of 24 | 36 | 2,701 | 0 | 0 | 4.1 / 5.5 / 3.6 | none | 0 |
| iPhone 15 Pro, Extra large text | 24 of 24 | 36 | 7,842 | 0 | 0 | 6.8 / 8.5 / 5.7 | none | 0 |


The small screen (iPhone SE, 320×568) needs more scrolling on every journey, as any layout does on a screen with
40% less height; nothing fails there, no screen scrolls sideways, and the smallest control the app itself places is
still 44 px tall. At the "Extra large" text setting every journey completes with the same taps; fifteen of them
need more scrolling (7,842 px over all journeys against 3,711 at the default size) and none fails.

### Accessibility checks (automated only)

axe-core A/AA on the eight main screens after the change: **no violations** on any of them (before: 31 nodes across the eight, one colour-contrast and thirty label/name mismatches). These are automated checks; no screen-reader
session (VoiceOver, TalkBack) and no keyboard-only session with a real assistive technology was run, so the app is
not described as accessible, only as passing these checks.

## 4. Test results

| Check | Result | Where |
| --- | --- | --- |
| TypeScript (`tsc --noEmit`) and ESLint on every changed file | clean | local, final commit |
| Unit and integration suite (`vitest run`) | **3,562 passed, 1 skipped** (3,563) | local, build `1H2ZFqEkA72n5ssRkI8BU` (commit fc9b919) |
| Browser suite, production build, Chromium Pixel 7 project (`playwright test`) | **117 passed, 0 failed**, 58 skipped (the WebKit iPhone project runs in CI only; the device-matrix audit, demo-server-only and no-mock variants skip locally, as in every earlier run) | local, same build; `e2e-final2.log` |
| Affected specs after the last three fixes (navigation, nutrition diary, nutrition time zone, profile time zone, faith calendar, features, journeys, fast logging) | **19 passed, 0 failed** | local, build of commit 2294d3a |
| `e2e/nutrition-timezone.spec.ts` (new) | fails on the build before the fix with hydration error #418; passes on the rebuilt server | proves the fix, see section 1 |
| CI workflow on `release/rc-2026-11-04` | run 116 **success** (fc9b919); the runs for bff2748 and 2294d3a are listed in section 9 | GitHub Actions |
| Demo package `verify.mjs` | **36 of 36** checks (tap-through, every picture, every target inside its screen, no page errors, fills 39 of 39 iPhone and Android viewports) | local; published as page version 19 |
| Route sweep for hydration errors (520 captured routes, Chromium, server and phone in UTC) | 0 errors | `hydration-scan` on the demo server |

Not run: real devices, screen readers, the iOS Simulator workflow for this change (the iOS workflow runs on push; its result for the last commit is in section 9).

## 5. The persona scenarios

Each scenario was walked on the real app (demo account, 393×852) and is also in the measured journeys above where it
maps to one.

| Persona | What they do | What the app shows them (after) |
| --- | --- | --- |
| Beginner (first week, "general health", 3 days × 30 min) | Opens the app, wants to be told what to do | Home: nutrition first (the goal's daily habit), then today's workout with Start and one line under it ("Tap Start and the app walks you through each exercise…"), then Faith today. The workout screen shows one exercise at a time with the 2D demonstration, "Last time", target and Complete set; everything advanced (alerts, notes, swap, skip with reason) is folded. Start to the first completed set: 2 taps, no scrolling. |
| Athlete / bodybuilder ("build muscle", 5 days × 60 min) | Checks the program, logs quickly, wants history and volume | Home: workout first, nutrition, then Sleep & Recovery above This week. Train shows the program link ("Powerbuilding 4-Day · Week 4 of 8 · Deload") and Start on the first screen; the exercise list is one fold away; Workout history, the builder, My workouts and Training review are under "More training tools" (2 taps from Home). In a workout: Next exercise and Skip set beside each other, previous performance inline, Focus mode hides everything but the current set. |
| Busy parent (3 days × 20–30 min) | Needs the fastest path to a workout, water and food | Home: workout and Quick actions first; Quick Add (+) in every header: water in one tap from any screen, food in two, a quick workout or a run in one. Resume is on Home and on the Train tab while a workout is in progress, so an interrupted session is never lost (saved on the device at every set and to the server in the background; visibility change and page hide flush it). |
| Older adult | Wants readable text, large targets and no guessing | Text size Large / Extra large under You → Display, applied immediately and remembered on the account; every control the app places is at least 44 px; no feature is removed or reordered by age (nothing is inferred from age). Measured at Extra large: every journey completes with the same taps. |
| Teen (under 18, from the birth year given) | Logs food and trains | Nutrition: the 5-week weight projection and the weight-goal pace sentence are not shown; everything else is the same, nothing else is inferred. Without a daily target the page says "log what you like, or set targets": nobody is pushed into calorie counting. |
| Faith-focused | Reads daily, prays, follows the 40 days | Faith tab first screen: Continue reading at the exact chapter and verse, Today's devotional (day N of 40), Write a prayer; Previous/Next chapter at the top and the bottom of every chapter; Home keeps Faith today and the verse (both can be moved up from Customize Home). Private prayer content stays out of the AI context, as before. |

## 6. Data loss and recovery (reviewed, not changed)

- Workout: every set change is written to the device immediately (`saveLocalDraft`) and to the server in the
  background (`syncWorkoutDraftAction`), with a flush on `visibilitychange` and `pagehide`; the header shows "Saved on
  device" / "Synced". Switching tabs keeps the draft; the Train tab and the Resume pill return to it. Finishing while
  offline or signed out keeps the workout and says so (`finishFailureMessage`). Verified again by
  `e2e/workout-reliability.spec.ts` and `e2e/journeys.spec.ts` (Train tab returns to an active draft).
- Food, water, prayer, weight from Quick Add use the same server actions as their screens; a failure returns the
  action's own sentence on the sheet and nothing is written twice.
- Forms keep their drafts in session storage (journal, custom food, coach question); the Bible reader keeps the
  position per account.
- Layout preferences are on the profile; an unreadable value is treated as "no preference", never as an error.

## 7. What remains incomplete

- **Customize Home** reorders modules and hides them; it does not yet let a member hide the Train or Nutrition tab's
  secondary sections (only Faith's), and the Nutrition tab's folded groups are not reorderable.
- **Unified search** covers screens/settings, exercises, programs, foods, recipes and the Bible; it does not search a
  member's own journal entries, workout history or saved meals.
- **Small targets by bounding box:** the measurement counts a control's drawn box, so the compact water buttons
  (36 px tall, with an invisible 44 px hit area), the 48×28 switches (also with a hit area) and a few inline text links
  ("Notification settings" on Home, "Open calendar" on Train, "berean.bible" on Faith) are counted as small. The
  inline links are genuinely small and were left as they are; a thumb-test on a real phone should decide them.
- **Nutrition and Faith are still the longest screens** (about 4.9 and 6.3 screens tall at 393×852) because
  everything the owner asked to keep is still there, folded; a member who opens every fold scrolls as before.
- The `before` measurements were taken once, on the demo account only; the per-persona Home orders were checked by
  unit tests and by eye, not by a separate measured run per persona.
- No visual redesign of the sub-screens beyond Back links and header consistency (billing, preferences, badges,
  history, recovery, run activities, calendar).

## 8. What still needs real devices

- Real iPhones (SE, 15 Pro, Pro Max) and Android phones in Safari/Chrome and in the Capacitor shells: tap targets
  with a thumb, the keyboard over the nutrition and prayer forms, safe-area insets with the new one-row header and
  the five tabs, momentum scrolling in the folded sections.
- VoiceOver and TalkBack through a full workout, a food log and a chapter (labels, focus order on the Quick Add sheet,
  the Focus mode announcement).
- Switch control / keyboard-only navigation of the workout screen.
- Offline: airplane mode mid-workout and during Quick Add, then reconnecting (the browser tests simulate offline; a
  phone's radio behaves differently).
- Camera (barcode and meal photo), GPS (the run from Quick Add) and App Store / Play purchases: not touched by this
  work and not re-verified on hardware; the earlier device checklists still apply.
- Large-text and bold-text system settings on iOS and Android (the app's own text-size setting was measured; the OS
  setting was not).

## 9. Commits and CI

All on `claude/faith-discipleship`, mirrored to `release/rc-2026-11-04`.

| Commit | What | CI (`ci.yml`) | iOS (`ios.yml`) |
| --- | --- | --- | --- |
| `fc9b919` | The navigation and UX work, migration, tests, measurement scripts, this report's first half | run 116, success | run 74, cancelled by the next push |
| `bff2748` | Faith day chips 45 px wide, Home verse card named by its printed text | run 117, success | run 75, success |
| `2294d3a` | Recent foods meal label read on the device only (hydration error in other time zones), regression test | run 118, success | run 76, see the commit after this one |
| this commit | Customize Home on its own screen was already in fc9b919; here: the report's results, the demo doc, the seed script's password suffix | | |

The demo page: https://claude.ai/artifact/L1eCXFJ1a3UjtQuta3nzRU, version 19 (captured from fc9b919, private).

Nothing was deployed, no payment was enabled and nothing was merged into `main`.

