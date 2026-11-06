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

<!-- RESULTS -->
