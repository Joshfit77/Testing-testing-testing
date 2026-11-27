# Mobile fit, interactive demo and the outstanding UX items, 2026-11-06 (second pass)

This continues `docs/UX_SIMPLIFICATION_2026-11-06.md` (the five-tab redesign) and answers the three briefs that
followed it: the remaining UX items, universal phone fit, and a demo that behaves like the real product.

**What this report is not.** Every measurement below comes from Chromium on this computer emulating phone sizes,
against a local production build and a local database. No real iPhone or Android phone, no Safari or Chrome for
Android, no screen reader and no hosted deployment was involved; section 8 lists exactly what that leaves open.
Nothing was deployed, no payment was enabled, nothing was merged into `main`.

## 1. The demo viewer on a phone (the symptom you reported)

The screenshot tour's page scaled a life-size iPhone frame to fit the window height whenever the window was wider
than 520 px, and in portrait on a real phone it sized the screen with `100dvh` while the hosting page added its own
safe-area padding, so the page itself could scroll a little under the captured screen's scroll. On an iPhone 14 Pro
in landscape the whole phone frame shrank to 38 %.

Fixed in `scripts/demo/iphone-demo/viewer.html` (page version 22): on any touch phone, portrait or landscape, the
page never scrolls, only the captured screen does; the host's safe-area padding is switched off and the insets are
applied once inside; the demo bar is 44 px tall with 13 px text; landscape centres the pictures at their captured
width. Probed at 320×568, 375×667, 390×844, 393×852, 412×915, 430×932, 440×956 and 852×393: document height equals
the viewport everywhere, exactly one scroll area, pictures at the full width in portrait.

What the tour still is: pictures with tap targets. It cannot type, keep state or scroll inside a screen the way the
app does; the real app in demo mode is the primary demo (section 5).

## 2. The real app at every phone size

### How it was measured

`scripts/ux/responsive-audit.mjs` loads 31 screens (the five tabs and their main sub-screens, the workout screen,
Bible chapter, journal, coach, progress, sleep, settings, billing, search) at ten sizes (320×568, 360×780, 375×667,
390×844, 393×852, 412×915, 430×932, 440×956, and landscape 852×393 and 915×412) at the default text size and again at
the app's **Extra large** setting: 620 screen loads per run, on the local demo server, in Chromium with the iPhone 15
Pro profile (touch, phone user agent). For each load it records whether the page is wider than the phone (and which
elements stick out), vertical scroll areas nested inside the page, rows that scroll sideways, content under the tab
bar, header overlap, text under 12 px, controls whose drawn box is under 44 px, and page errors.

| Per 620 loads | Before (`8661782`, morning) | Mid (`e827dba`) | After (`692af7c`) |
| --- | --- | --- | --- |
| Loads with any layout finding | 130 | 48 | 24 |
| Loads where the page was wider than the phone | 31 | 19 | 0 |
| Loads with a row that scrolls sideways | 108 | 30 | 24 |
| Vertical scroll areas nested inside the page | 0 | 0 | 0 |
| Content under the tab bar, header overlap, page errors | 0 | 0 | 0 |
| Text nodes under 12 px (summed over all loads) | 3,517 | 3,207 | 149 (badges only) → 0 |
| Controls under 44 px (summed over all loads) | 1,755 | 1,389 | 1,251 → 1,132 |

The 24 remaining findings are the two data tables that scroll sideways inside their own box (below). The "after" column
is the full run on `692af7c` (620 loads); the last two rows fold in the targeted re-runs on the screens changed after
it: on `97dd8ba` the five screens below (20 loads each), and on the final commit the badges screen alone after its
last two labels were raised to 12 px (checked on a development server, 20 loads, 0 findings). The small-control count is
dominated by the demo bar's own controls (counted on every screen), checkbox inputs inside labelled rows, the compact
water buttons with a 44 px hit area and the 34 px-wide weekday chips (44 px tall).

| Screen (20 loads each) | Text under 12 px, before → after | Controls under 44 px, before → after | Page wider than the phone |
| --- | --- | --- | --- |
| /progress/badges | 149 → 120 | 0 → 0 | 0 → 0 |
| /train/exercises/kettlebell-swing | 0 → 0 | 79 → 20 | 0 → 0 |
| /progress/overview | 0 → 0 | 60 → 0 | 0 → 0 |
| /profile/notifications | 0 → 0 | 412 → 412 | 0 → 0 |
| /nutrition/supplements | 0 → 0 | 0 → 0 | 0 → 0 |
| /train/workout | 0 → 0 | 12 → 12 | 0 → 0 |
| **Total** | **149 → 120** | **563 → 444** | |

The 412 small controls on Notifications are the seven weekday chips of each reminder (34 × 44 px, the whole row is one
tap wide on a 320 px phone) and the inline "Sleep" link; the 12 on the workout screen are the demo bar's.

### What was wrong and what changed

- **Rows that needed a sideways swipe** (program categories, Food tools, journal filters): the chips wrap now. The
  only sideways scrolling left is inside two data tables (below).
- **Pages wider than the phone at 320 px or at Extra large text.** Grid list items (journal entries, exercise cards,
  saved programs, the five tab cells) could not shrink below their truncated title, so the whole page grew. They can
  now (`min-w-0`). The devotional button and the "Copy breakfast from yesterday" button wrap their text; the Account
  screen's consent buttons, the journey check-in buttons and the onboarding button rows wrap; the steps card's two
  columns shrink and its weekday strip shows one-letter days when it is narrow (a container query); the two stat
  grids wrap their numbers and only go to four columns on wide screens; the calorie equation wraps onto two lines;
  the main header moves Search, Quick Add and Coach under the title when the title would otherwise be cut short, and
  drops the "AI Coach" label to "Coach" by the header's own width in rem (so at Extra large text too).
- **Clipped content.** A meal row's source badge ("Label", "USDA") used to sit inside the truncated name and was cut
  off at narrow widths; it is on its own line now. The bottom tab labels scale down slightly on the narrowest phones
  instead of being truncated.
- **Controls under 44 px raised to 44 px** (or to a 44 px hit area): the 2D demonstration's play/speed/full-screen
  controls, the coach mode buttons, the chart table toggle, the overview range chips, the billing interval switch,
  the legal links on the membership screens, the text links in notifications, run, meal photo and planner, the
  "change" link in the planner.
- **Text under 12 px raised to 12 px:** helper captions (coach, sleep check-ins, template editor, program builder,
  demonstration captions, rank board, billing badge, presenter tags, demo badges), chart axis ticks, and the Bible
  reader's verse numbers (0.7 em of the reading size).
- **The plan comparison table** fits a 320 px phone at the default text size (narrower check columns, 17 rem minimum).

### What is left by design, and why

- **Two data tables scroll sideways inside their own box:** the personal-bests table on Progress › Overview (five
  numeric columns, 560 px minimum) at every phone width, and the plan comparison at Extra large text on phones
  under 390 px. The page itself never scrolls sideways; the box does, like a spreadsheet. Turning the records table
  into a card list is possible but would be a redesign of that screen rather than a fit fix.
- **Checkbox inputs** (20×20 px) inside the consent, reminder and journal forms count as small controls; the tap area
  is the whole label row. The demo bar's own Free/Pro, Reset and presenter controls are counted on every screen and
  are not part of the app.
- **Inline text links** in running text ("berean.bible" on Faith, exercise names in a muscle list, "How it's worked
  out") stay at text height; each sits in a line that is at least 44 px apart from the next control. A thumb test on
  a real phone should decide them.

## 3. The outstanding UX items

| Item from the brief | What was done | Where |
| --- | --- | --- |
| 1. Undersized links and accessibility | Section 2's control and text changes; an axe-core sweep over 51 screens with every collapsed section opened (section 6); the journey script's axe pass on the eight main screens stays at 0 nodes. | `scripts/ux/axe-sweep.mjs` |
| 2. Simplify Nutrition and Faith without removing anything | **Faith:** Daily practices and the inline prayer form are folds with a one-line summary (the quick actions at the top still open each in one tap); recent entries stay. **Nutrition:** a meal with nothing logged is one compact row with its Quick add and Copy buttons; the "save this meal to log again" form sits behind a one-line fold; Recent foods shows four; the macro row is a definition list. Nothing was removed; every fold opens in place. First-screen heights before/after in section 4. | `src/app/(app)/faith/page.tsx`, `src/app/(app)/nutrition/page.tsx` |
| 3. Customization for Train and Nutrition | **You › Customize Home** now has Train and Nutrition lists next to Home and Faith: move up/down and hide/show for the Train hub's sections (Run & walk, Programs, Exercises, Calendar, More tools) and the Nutrition tab's sections (Recent foods, Water, Calories remaining, Nutrients, Week, Weight, Targets, Saved meals, Tools). Add food, Scan, Meal photo, the totals and the meals always stay. Saved in `profiles.layout_prefs` (no schema change), so it follows the member to every device; Reset restores the default for their goal. | `src/lib/layout-prefs.ts`, `src/components/profile/customize-layout.tsx`, `tests/unit/layout-prefs.test.ts`, `e2e/navigation.spec.ts` |
| 4. Unified search over personal data | Search now lists the member's **own completed workouts**, **saved meals, recipes and custom foods** (only with the nutrition entitlement) and **prayer journal entries** (title, date and theme only; a prayer's text is never shown or sent anywhere) before the app-wide results. The query runs through the member's own database client (row-level security) and their id. `tests/integration/personal-search.test.ts` proves another member sees none of it even when asking by the first member's id, that the entry text never appears, and that `%`/`_`/`(` in a query are handled. | `src/server/services/personal-search.ts`, `src/app/(app)/search/page.tsx` |
| 5. Responsive behaviour across iPhone and Android sizes | Section 2 (620 loads per run) and the seven-size screenshots in `docs/screenshots/mobile-2026-11-06/`. | |
| 6. Regression, accessibility, performance, security | Section 6. | |
| 7. Interactive demo and screenshots | Section 5; page version 20 of the tour; screenshots at 320, 375, 390, 393, 412, 430 and 440 px. | |

## 4. Before and after on the everyday journeys

Same method as the first report (`scripts/ux/measure-journeys.mjs`, iPhone 15 Pro size, the sample member, Pro
view): taps and scrolling to complete 24 everyday journeys, measured on the layout as it was this morning
(`8661782`) and on `692af7c`.

| Journey | Before (taps, scrolling) | After (taps, scrolling) | Taps | Scrolling px | Time after |
| --- | --- | --- | --- | --- | --- |
| Start today's workout | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.5 s |
| Complete the first set of a workout | 2 taps, 0 px | 2 taps, 0 px | 2 → 2 (same) | 0 → 0 (same) | 1.1 s |
| Move on to the next exercise | 1 tap, 84 px | 1 tap, 117 px | 1 → 1 (same) | 84 → 117 (+33) | 0.6 s |
| Log a recent food again | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.1 s |
| Open food search | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.2 s |
| Scan a barcode | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.1 s |
| Log a glass of water | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.5 s |
| Continue Bible reading | 1 tap, 178 px | 1 tap, 212 px | 1 → 1 (same) | 178 → 212 (+34) | 0.5 s |
| Write a prayer | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.0 s |
| Open today's devotional | 1 tap, 230 px | 1 tap, 264 px | 1 → 1 (same) | 230 → 264 (+34) | 0.5 s |
| Start a GPS run | 1 tap, 323 px | 1 tap, 357 px | 1 → 1 (same) | 323 → 357 (+34) | 0.5 s |
| Open the AI Coach | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.5 s |
| See My Progress | 1 tap, 615 px | 1 tap, 649 px | 1 → 1 (same) | 615 → 649 (+34) | 0.5 s |
| Open Plans & billing | 2 taps, 64 px | 2 taps, 81 px | 2 → 2 (same) | 64 → 81 (+17) | 1.1 s |
| Open notification settings | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.0 s |
| Open the training calendar | 1 tap, 714 px | 1 tap, 748 px | 1 → 1 (same) | 714 → 748 (+34) | 0.5 s |
| Open the exercise library | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.0 s |
| Finish a workout | 2 taps, 0 px | 2 taps, 0 px | 2 → 2 (same) | 0 → 0 (same) | 1.2 s |
| Review today's nutrition (calories and macros in view) | 1 tap, 325 px | 1 tap, 258 px | 1 → 1 (same) | 325 → 258 (−67) | 0.5 s |
| Read a Bible chapter (Scripture text in view) | 1 tap, 180 px | 1 tap, 214 px | 1 → 1 (same) | 180 → 214 (+34) | 0.5 s |
| Turn to the next chapter | 1 tap, 0 px | 1 tap, 0 px | 1 → 1 (same) | 0 → 0 (same) | 0.5 s |
| Change training goals | 2 taps, 64 px | 2 taps, 64 px | 2 → 2 (same) | 64 → 64 (same) | 1.0 s |
| Find an advanced training tool (Training review) | 3 taps, 486 px | 3 taps, 602 px | 3 → 3 (same) | 486 → 602 (+116) | 1.4 s |
| Return to Home from deep in the Bible | 1 tap, 64 px | 1 tap, 64 px | 1 → 1 (same) | 64 → 64 (same) | 0.5 s |
| **Total over the 24 journeys completed both times** | **36 taps, 3711 px** | **36 taps, 4014 px** | **36 → 36** | **3711 → 4014** | |

Taps are unchanged on every journey. The scrolling total went from 3,711 px to 4,014 px: the demo bar gained a third
line (the new **Reset demo** button, 34 px) on every screen it sits on, which adds 34 px to the eight journeys that start
below it; the app itself did not grow (Review today's nutrition is 67 px shorter: the calorie figures sit higher now).
The journey script also runs axe-core on the eight main screens: 0 nodes before and after.

| Screen | Before: screens tall, cards, controls, small targets | After: screens tall, cards, controls, small targets | axe (WCAG A/AA) before → after |
| --- | --- | --- | --- |
| /home | 2.6, 11, 34, 7 | 2.6, 11, 35, 7 | none → none |
| /train | 1.3, 6, 28, 7 | 1.3, 6, 29, 7 | none → none |
| /nutrition | 4.9, 18, 103, 27 | 4.7, 18, 102, 26 | none → none |
| /faith | 6.3, 28, 73, 12 | 4.7, 28, 74, 13 | none → none |
| /profile | 4.1, 4, 33, 10 | 4.1, 4, 34, 12 | none → none |
| /progress | 2, 7, 18, 7 | 2, 7, 19, 8 | none → none |
| /run | 3.5, 11, 29, 14 | 3.5, 11, 30, 13 | none → none |
| /train/workout | 1, 4, 13, 6 | 1, 4, 14, 7 | none → none |

Faith's first screen is 6.3 → 4.7 screens tall and Nutrition's 4.9 → 4.7 at 393×852 with the folds closed; nothing was removed.

## 5. The interactive demo (the real app in demo mode)

**The demo is the application itself**, started with `DEMO_MODE=true` (`npm run demo` on a computer with Docker;
`docs/DEMO.md`). Its welcome screen offers two customer experiences:

- **Explore with sample data** (returning customer): "Demo Athlete", about two months of workouts, food, runs, sleep
  and Faith history, in a program on week 3, the 40-day challenge on day 13, a 90-day reading journey on day 21. Every
  tab, form, timer and setting is the real one; what you log stays in the demo database until you reset.
- **Start as a new member** (new customer): a fresh account through the opening gate, sign-up, onboarding and the
  first workout.

The demo bar on every screen has the **Free / Pro** switch (server-side, demo accounts only, never a route to Pro
for a production account), the presenter's 20-step guided path, and the new **Reset demo** button: it wipes and
re-seeds the sample account only (`src/server/demo-seed.ts`, the same code as the seed script), keeps you signed in,
never touches another account, and only exists on a demo server (`src/server/actions/demo.ts` checks the server
mode, the demo flag on the account and the account's email, with a rate limit). `e2e/demo-reset.spec.ts` logs water,
resets, and checks the logged water is gone; it runs only against a demo server.

### Every control checked

`scripts/ux/interaction-audit.mjs` signs in as the sample member, presses every button, tab, switch, radio and
summary on 51 screens (destructive ones excluded) and records what happened: a navigation, a dialog, a section
opening, a status message, an input focused, a state change (pressed/selected/checked, a label change) or a change on
the page; then it fetches every internal link and checks for a crash or not-found page.

On the final build (`692af7c`, demo server, iPhone 15 Pro size) it recorded **521 controls on 51 screens** and fetched
**577 links**:

| Outcome | Controls |
| --- | --- |
| Toggled a state (pressed / selected / checked) | 111 |
| Opened a dialog | 45 |
| Its label changed (play → pause, add → remove) | 28 |
| Changed the page | 22 |
| Showed a status message | 21 |
| Navigated to another screen | 14 |
| Expanded or collapsed a section | 13 |
| Focused an input | 6 |
| Disabled (see below) | 16 |
| Skipped: destructive (delete, sign out, reset, remove) | 37 |
| Skipped: the control at that position changed between the listing and the press (timers, lists that re-order after a press) | 190 |
| No visible effect | 14 |
| Could not be pressed by the tool | 4 |

The **14 with no visible effect** are the already-selected option of a choice (mi/km, Outdoor run, All supplements,
the Ask tab, the Fitness badge tab, Front view, Strength rank, Default text size, Imperial, Male, Monthly), the two
photo buttons that open the phone's own picker (Take a photo, Choose from library), and Search re-submitting the
same query. The **4 that could not be pressed** are the muscle regions of the body map, drawn as SVG groups; a real tap
at their centre does select the region (checked by hand: the detail panel changes). **577 of 577 links** answered without
a crash or not-found page; the one flagged entry is the account data export, which starts a download.

Checked by hand as well: Prayer and Scripture marks on the Faith day strip toggle their pressed state and save; the
water buttons change the total (4.60 → 4.85 L); the coach's Plan tab switches the composer; "Type the barcode instead"
reveals the input; the builder's category buttons select; the demonstration's pause button becomes play.

Controls the audit lists as **disabled** are disabled until there is something to act on: **Back** on the first step
of the program builder, **Estimate nutrition** before a photo is chosen, **Add item** with an empty grocery line,
**Ask** with no question, **Send message** with no message, **Save** with nothing changed.

### Simulated, labelled, or needs the phone app

Unchanged from `docs/DEMO.md` ("Live, simulated, or needs a phone"): the AI Coach, AI meal plans, food-photo
estimates, label-photo reading and the Bible study assistant reply with **scripted answers labelled as simulated**
unless a live key is configured (the demo bar says "AI replies simulated"); runs use **sample routes** (labelled);
live GPS, Apple Health / Health Connect, the camera scanner, push notifications and purchases **need the phone app**;
the barcode lookup is live and needs internet. The Nutrition Score number stays off (experimental).

### The screenshot tour (secondary)

Rebuilt from `692af7c` by `scripts/demo/iphone-demo/` and published as versions 20–22 of
https://claude.ai/artifact/L1eCXFJ1a3UjtQuta3nzRU (three uploads of one page; private to the owner): **458 screens,
5,424 tap targets (4,119 land on a captured screen, the rest say so), 144 exercise pages with their live 2D
demonstration**, the workout flow step by step (start, demonstration, set 1 with rest timer, set 2, options, substitute,
finish, summary), the coach with a typed question and its simulated reply, and the New member path (questions → plan →
first workout). `verify.mjs`: **36 of 36 checks** (opening → welcome → the five tabs → back → the whole workout flow →
menu → coach; every picture present; every tap inside its screen; no page errors; no missing files) and **39 of 39
iPhone and Android viewports (74 models)** filled with one scroll area. Page 1.7 MB, pictures 146 MB.

### Using it on your phone

`docs/DEMO_ACCESS_OPTIONS.md` compares the four ways (private web preview, TestFlight, Android internal testing, the
screenshot tour) and recommends the **private, access-controlled web preview** first: the existing
`.github/workflows/demo-preview.yml` puts the demo online behind Vercel Authentication on a Supabase project made
only for the demo, after you create five repository secrets and push a `demo-preview-*` tag. Nothing was deployed; it
waits on your go-ahead.

## 6. Tests

Every number here was produced on this computer against a local production build and a local Supabase; which commit
each ran on is stated, because the last fixes landed after the long runs.

| Check | Commit | Result |
| --- | --- | --- |
| Typecheck (`tsc`) and lint (`eslint`) | every commit | pass |
| Unit and integration suite (`vitest`), including `tests/integration/personal-search` and `tests/unit/layout-prefs` | `692af7c` | **3,568 passed, 1 skipped** (3,569) |
| Browser suite (`playwright`, iPhone 15 Pro profile, mocked AI and food APIs), 118 tests | `692af7c` | **115 passed, 3 failed**: three tests typed into the Faith journal form without opening its new fold, or expected "More tools" first after a one-step move. Test-side; fixed in `b499654` |
| The eight browser specs that cover the folds, section order, badges, supplements, demonstrations and notifications (21 tests) | `97dd8ba` | **19 passed, 2 failed**: the supplements spec still used the old "Remove X from stack" name and the journal journey checked the form after a reload that closes the fold. Test-side; fixed in `8efc365` |
| `e2e/journeys.spec.ts` + `e2e/supplements-steps.spec.ts` (8 tests) | `8efc365` on the `97dd8ba` build | **8 passed** |
| `e2e/demo-reset.spec.ts` on the demo server | `692af7c` (twice) and `97dd8ba` | **1 passed** each time (the first attempt on `692af7c` failed only on whitespace normalisation in the assertion, fixed in `279fe69`) |
| Responsive audit, 31 screens × 10 sizes × 2 text sizes | `8661782` → `692af7c` (+ targeted re-runs) | section 2 |
| axe-core WCAG 2.1 A/AA, 51 screens with folds opened | `692af7c` → `97dd8ba` | **87 nodes in 1 rule → 0** (label-content-name-mismatch: aria-labels that did not contain the visible words on the weekday chips, supplement buttons, goal "Done", rank rows and demonstration controls) |
| Interaction audit, 51 screens | `692af7c` | section 5 |
| Screenshot tour `verify.mjs` | capture of `692af7c` | **36 of 36 checks, 39 of 39 viewports** |
| GitHub CI (typecheck, lint, unit, integration against a fresh Supabase, gitleaks over the full history, `npm audit`) on `release/rc-2026-11-04` | runs 120–129 | all **success** except run 126 (`279fe69`), where the runner could not bind Supabase's port 54322 before any test ran; the same code passed in runs 127 and 128 |

What was **not** re-run on the very last commits: the full browser suite and the full 620-load audit ran on `692af7c`;
the commits after it change only aria-labels and names, four CSS sizes, one `min-w-0`/`min-h-11` pair, the journal fold
opening on a restored draft, tests and docs. Each of those was covered by the targeted runs above.

**Security.** `npm audit --omit=dev`: 0 vulnerabilities in production dependencies. Secret scan: the repository's
CI runs gitleaks v8.30.1 over the full history on every push (runs 120–129 on `release/rc-2026-11-04`, see section 6); a pattern search of the working tree finds only
the public local-Supabase demo key that is allow-listed in `.gitleaks.toml`. Reset demo and the Free/Pro switch are
server-side and refuse any account the server did not create as a demo account; personal search is isolated by
row-level security and tested across two members. No new dependency was added.

**Performance.** Route JavaScript on the final build (`next build`, gzip-measured by Next): shared by every screen 108 kB; first load
Home 252 kB, Train 246 kB, Workout 221 kB, Nutrition 292 kB, Faith 295 kB, Bible chapter 154 kB, You 270 kB, My Progress
253 kB, Overview 326 kB, Coach 188 kB, Run 255 kB, Search 125 kB. The journey times in section 4 (0.5 to 1.4 s per journey
on a desktop CPU emulating the phone's size) are not phone timings.

## 7. Devices and browsers actually tested

| | Tested | How |
| --- | --- | --- |
| iPhone sizes 320×568, 375×667, 390×844, 393×852, 430×932, 440×956 | emulated | Chromium, iPhone 15 Pro device profile (touch, user agent), viewport set per size, device scale 1 and 2 |
| Android size 412×915 (Pixel-class) and 360×780 | emulated | same Chromium contexts |
| Landscape 852×393 and 915×412 | emulated | same |
| Extra large text (the app's own setting) | emulated | set through the Display settings before each run |
| Safari (WebKit) | **not this round** (Playwright's WebKit could not be installed here); the repository's WebKit iPhone matrix ran in CI on 2026-11-05 (18 of 18) and runs on the iOS workflow | |
| Any physical phone, VoiceOver, TalkBack, OS text size, notch/Dynamic Island insets, keyboard, rotation on hardware | **not tested** | |

## 8. Simulated, incomplete, and what needs a physical phone

**Simulated or scripted in the demo:** AI Coach replies, AI meal plans, food-photo and label-photo estimates, the
Bible study assistant (all labelled), sample run routes, pretend Apple Watch sleep imports (labelled).

**Incomplete or left as is:**

- The two sideways-scrolling data tables and the inline text links in section 2.
- The screenshot tour is pictures: the 2D demonstrations are shown at their first frame, and 13 of the 157 exercise pages and the deepest Bible chapters are left out of the tour by the hosting's 511-file limit (every tap to them says so).
- Safari was not run here this round (WebKit could not be installed in this container); the CI WebKit matrix covers
  the sizes, not this exact commit.
- Nutrition and Faith remain the longest tabs when every fold is opened; the folds shorten the first screen, not the
  total content.
- The interaction audit presses each control once from a fresh load; it does not try multi-step flows beyond the
  scripted workout and coach paths in the capture, and it cannot judge whether an outcome is the *right* one.

**Needs a physical phone (iPhone and Android), whichever access option you choose:**

- Safe areas on a notched or Dynamic Island iPhone and on Android with gesture navigation (the layout uses
  `env(safe-area-inset-*)`; emulation reports zero insets), and the one-row header plus five tabs with them.
- The keyboard over Add food, the prayer entry, sign-up and the grocery list; rotation; the OS large-text and
  bold-text settings (only the app's own setting was measured).
- Thumb reach on the compact water buttons, switches and inline links; momentum scrolling through the folds.
- VoiceOver and TalkBack through a workout, a food log and a chapter; switch control.
- GPS accuracy and background recording, the camera for barcodes and meal photos, Apple Health / Health Connect,
  notifications, sandbox purchases, airplane mode mid-workout.
- Performance on older phones (an iPhone 11 or a 2021 mid-range Android): the numbers here come from a desktop CPU
  emulating a phone's size, not its speed.

## 9. Commits and CI

All on `claude/faith-discipleship`, mirrored to `release/rc-2026-11-04` (CI runs on the mirror).

| Commit | What | CI run |
| --- | --- | --- |
| `cec7471` | One-scroll demo viewer, phone-size fixes, personal search, Train/Nutrition customization, Reset demo, interaction audit, access options | 120 success |
| `e827dba` | Faith practices and journal form folded, empty meals one row, save-meal folded | 121 success |
| `9fffdd5` | 320 px / Extra large fixes (grid items, wrapping buttons, header, tabs, stats, tables, badge), audit scripts | 122 success |
| `692af7c` | No text under 12 px (helper captions, chart axes, verse numbers) | 123 success |
| `e5fae7a` | DEMO.md: Reset demo | 124 success |
| `b499654` | Journal fold opens on a restored draft; three browser tests open the folds | 125 success |
| `279fe69` | demo-reset test normalisation | 126 failed on the runner (port 54322 in use), not on the code |
| `b4a3e07` | Badge labels 12 px; exercise and records links 44 px | 127 success |
| `97dd8ba` | Accessible names contain the visible text (axe 87 → 0) | 128 success |
| `8efc365` | Demo docs, screenshot sheets, two specs follow the new names and folds | 129 |
| this commit | Last two badge labels 12 px; this report | |
