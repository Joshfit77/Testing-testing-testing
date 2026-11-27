# Area audit: home-onboarding-coach-you

Evidence: `before-{new,occasional,established}/shots/NNN-*.png|-full.jpg`, `before-onboarding/NN-*.png`, `metrics.json`. N/O/E = new/occasional/established.
Metric note: the "48x28" switch small targets are false positives (`switch.tsx` `after:-inset-2` gives about 64x44).

## Onboarding (before-onboarding/01–12)
- **Purpose:** get from the opening screen to the first workout. The flow is: opening → Skip intro → welcome → "Start free" → 5 questions → name/faith → /plan → Start. It takes **19 interactions**.
- **Understood?** Yes. The progress bar ("Question 3 of 5") is clear. The optional questions sit behind "Personalise more", and nobody is forced through a tour.
- **Excess:** Every step repeats the hero "Let's build your plan" and the 3-line paragraph "Five quick questions…" (`src/app/onboarding/page.tsx:20-22`), which pushes each question about 300px down (04, 06, 07). On the goal step, Continue is below the fold (04). Single-choice steps (goal, experience, equipment) need a choice tap plus "Continue". "3 days" wraps badly in the 4-column grid (06). The name-ready screen (10) has a 5-line paragraph: "Until you change them, we'll assume you're lightly active…".
- **Consistency:** The copy says "Profile and Food" and "Profile & Settings"; the tabs are "You" and "Nutrition".
- **States:** The faith toggle "Faith-inspired coaching and reminders" defaults to **off** (`onboarding-questionnaire.tsx:160`). That moves the Faith card to the bottom of Home (`layout-prefs.ts:147`). The cross hero and verse still show.
- **DEMO-ONLY:** The "Interactive demo" boxes on the welcome and login screens (02, 03).
- **Recommendation:** Hero paragraph on question 1 only. Auto-advance single-choice steps (−3 taps). 3-column day grid. Name-ready paragraph → "Activity: lightly active · Diet: balanced — change in Personalise more."

## /home (N 001, O 001, E 001)
- **Purpose:** start today's workout. The primary action is the round gold play button.
- **Understood?** Partly. The workout card is above the fold in N/O/E, but the action is an **unlabelled 64px play icon** (name only in `aria-label`, `today-workout-action.tsx:45`). Beginners get the hint "Tap play and the app walks you through…" to explain it. The card title is a second link (to the program page). /plan uses a labelled full-width button (11).
- **Verse (confirmed):** The hero reads **"“Therefore…” Hebrews 12:1 (BSB)"** in N/O/E (001; the metric's "Hebrews 12" is its own 40-character cut).
  - Component: `src/app/(app)/home/page.tsx:327-337` → `verseExcerpt()` in `src/lib/domain/scripture.ts:2-7`. It cuts at the **first punctuation mark** of `scriptureForDate()` text (`src/data/content.ts:56-58`).
  - Running it over all 18 entries gives more fragments: "Brothers…", "Not only that…", "Whatever you do…", "He has shown you…", and a mid-word cut "…a man who does not contr…" (Proverbs 25:28).
  - The same function feeds `src/app/(app)/faith/page.tsx:158`.
- **Excess:** "Log food" ×3 (nutrition card, Quick actions, Quick add); "AI Coach" ×2 (header, Quick actions); the Quick actions module adds nothing the header lacks. O/E end with a 7-item "Today's reminders" list (incl. "Rooted in faith. Built for strength. 5:45 AM"), making Home 2.7 screens vs 2.1 for N.
- **Personalisation:** `defaultHomeOrder` (`src/lib/layout-prefs.ts:143`) puts **nutrition above the workout** for `lose_fat`/`general_health`. That breaks "today's workout immediately visible" for those goals.
- **Summaries:** Nutrition (calories/protein/water, Log food, Scan) is good. Sleep & Recovery is a single row. Faith shows "Read the Bible / The Berean Standard Bible, free t…" (truncated, N). The N tiles "Week streak 0 weeks" and "Recovery Check in" carry little meaning on day 1.
- **Header (APP):** On Home the "AI Coach" pill's right edge is **clipped by the screen edge** (N/O/E 001, crop checked). The You and Calendar headers fit. The cause is the two-line "NARROW GATE FITNESS" wordmark plus three buttons in `home/page.tsx:313-324`.
- **Recommendation:** I-1, I-3, I-4, I-11, I-14.

## /calendar (N 002, O/E 002)
- **Purpose:** see and move planned sessions. Understood: yes. The legend and "Up next" list with "Move" buttons are clear.
- **Issues:** Title truncated to "**Training ca…**" (`MainHeader` `truncate`); "Move" buttons 87x36 (O/E smallTargets 6); 4-line footer.
- **Recommendation:** Title "Calendar"; `min-h-11` on Move; footer → "Missed sessions roll forward; done workouts never change."

## /search (003, all states)
- **Purpose:** one search. Understood: yes. 60 words, 1 screen.
- **Issues:** Placeholder cut ("e.g. squat, banana, John :"); 5-line rules paragraph; Home tab lights up on /search even from Nutrition/Faith (`nav-config.ts:18`).
- **Recommendation:** Placeholder "squat, banana, John 3:16"; paragraph → "Type 2+ letters."; drop `/search` from Home's `alsoMatches`.

## /plan (004; post-onboarding landing 11)
- **Purpose:** reveal the plan, then "Start Today's Workout" (labelled, full width, above the fold). Understood: yes. This is the best first-workout screen in the app.
- **Issues:** Eyebrow duplicates H1 "Your plan"; 6-line calorie disclaimer above the program; "Why this program" lists **25 pieces of equipment**; copy says "Food page"/"Profile & Settings"; "Go to Home" is 361x26.
- **Recommendation:** Drop the eyebrow; summarise equipment ("full gym"); disclaimer behind "How we estimate"; fix tab names; `min-h-11` on Go to Home.

## /coach (N 076, O/E 081)
- **Purpose:** ask the coach. Understood: partly for Free, yes for Pro.
- **Prompts (confirmed):** A new **Free** member sees "**Why did my bench stall?**", "Plan my deload" and "Suggest alternatives to barbell back squats".
  - Source: `DEFAULT_SUGGESTIONS` in `src/components/coach/coach-chat.tsx:104-111`, used whenever `suggestions` is undefined (`coach-chat.tsx:269`).
  - `src/app/(app)/coach/page.tsx:84-95` only computes data-based prompts (`suggestedQuestions`, `src/lib/coach/context.ts:356`) when the coach is enabled. Every Free, unconsented or unavailable member therefore gets the hard-coded veteran prompts. They are also dimmed and not tappable.
  - `suggestedQuestions` also adds "Plan my deload" for any program, including week 1.
- **Free/Pro:** Free members see a full disabled chat UI: dimmed prompts, an input box, a "Plan PRO" tab, plus "Memory" and "New chat" buttons that do nothing useful. The only explanation is the line "AI coaching is included with Pro All Access." It gives **no price**, and "Upgrade" goes to billing, where prices start below the first screen.
- **States:** Unavailable texts exist (`coach/page.tsx:69-77`); one is jargon ("no AI provider key"). The "simulated" demo notice is DEMO-ONLY. In production the only AI cue is a 6-line 12px disclaimer under the input. "Memory" link is 47x16 (O/E). Approval exists ("only apply when you tap Confirm", `suggestion-card.tsx`).
- **Recommendation:**
  - **Free:** one card in place of the chat: "AI Coach is part of Pro — $19.99/month or $149.99/year. Faith & Bible stay free." + "See Pro" + 3 example prompts.
  - **New:** `DEFAULT_SUGGESTIONS` → "How should I start if I'm new to lifting?", "What should I eat before today's workout?", "How much protein should I aim for?", "Which program fits my goal?". Deload only after week ≥4. Disclaimer to 2 lines + "More".

## /coach/memory (N 077, O/E 082)
- **Purpose:** see, add or remove memories. Understood: yes. The copy is short ("You decide what's saved").
- **Issues:**
  - N (Free) shows "Memory is off… included with Pro" plus "Saved memories (0/100) Nothing saved yet". The empty list is pointless for a member who can't save anything.
  - O/E: the "Memory is on" card is a 5-line paragraph quoting the checkbox text.
  - "Turn memory off" and "Save" are 36px tall.
- **Recommendation:** Free: hide the empty list. Pro: "Memory is on. Nothing is saved without your OK." plus a toggle. `min-h-11` buttons.

## /profile (N 078, O/E 083)
- **Purpose:** progress, settings and account. Understood: partly.
  - The first screen is 7 rows, 3 of them Progress (My Progress, Badges, Sleep & Recovery), mixed with settings.
  - The page is **3.7–3.9 screens** long. Inline sections cover Account & units (name, units, timezone, height, faith toggle, Save, Change password), Display & Faith, Privacy & data, Legal, an **always-open Delete account form** with password field, and Sign out at the very bottom.
- **Issues:**
  - The subtitle shows the truncated email "new-member-1ab192d…".
  - Name and height are edited both here and in /profile/preferences.
  - "Legal: Drafts awaiting legal review." is visible to members (APP, pre-launch).
- **Privacy/consent:** Only "Optional wellness information" and "AI Coach data sharing" are managed here. The other consents are scattered, with no index from Profile:
  - Apple Health → `progress/sleep/settings`
  - Food/label photo → `nutrition-food-photo-consent`
  - Body scan / progress photos → `body-scan/consent-card`
  - Prayer journal "Share with AI Coach" → per entry
  - GPS and camera → OS (DEVICE)
- **Account paths:** Export ("Download my data") and Delete are present. Restore purchases exists only in the native `store-paywall.tsx` (DEVICE). On web it is correctly absent.
- **Recommendation:** I-8, I-9.

## /profile/preferences (N 079)
- **Purpose:** change onboarding answers. Understood: partly.
  - The "Goals & training preferences" row opens on "Change my schedule" with a panel headed "**COMPARED WITH BODYBUILDING: MAXIMUM MUSCLE GAIN**" (program-name jargon).
  - It is followed by a 4-step wizard starting at "About you". To change the goal you have to Continue through name, bodyweight, age, sex and height.
- **Recommendation:** Summary list (Goal, Experience, Schedule, Equipment, Diet, Body), each row jumping to its step; header "Your current program".

## /profile/notifications (N 080, O/E 085)
- **Purpose:** turn on reminders. Understood: partly.
  - All reminders are off by default (good), with clear per-item rules and a Privacy box.
  - But there are **23 toggles over 4.6 screens (N) / 6.7 screens (O/E)**, 646–856 words and 28–148 small-text elements, in categories Faith (11), Workouts (3), Food & water (5), Recovery (2) and System.
  - The device box ("You're using the web version…") is 6 lines.
- **Recommendation:** "Recommended" 3 on top (Scheduled workouts, Bible reading, Wind down); other categories in `<details>` with counts ("Faith · 0 of 11 on"); device box to 2 lines.

## /profile/customize (N 081, O/E 086)
- **Purpose:** reorder or hide Home modules. Understood: yes. "Today's workout always stays."
- **Issues:** 3.7 screens, 75 controls (up/down + eye per row, plus Faith-tab order). Fine as deferred customisation. Keep; see I-14.

## /profile/billing (N 082, O/E 087)
- **Purpose:** compare plans and upgrade. Understood: partly.
  - The first screen is the demo notice (DEMO-ONLY), "Current membership Free" and a crown hero. **No price is above the fold.** $19.99 and $149.99 ("Save 37%", "$12.49/mo") start just below the first screen.
  - Features are listed **three times**: the hero list, the Pro card and a ~26-row comparison table. The page is 6.0–6.1 screens with 28–29 small-text elements.
  - The Faith & Discipleship "**Always free**" (Scripture, devotionals, prayer journal) appears only in the last table row (about screen 5).
  - "Online checkout isn't available right now" is a demo/no-Stripe artefact (DEMO-ONLY on web demo).
  - Restore purchases and the store-management copy are native only (DEVICE).
- **Recommendation:** Screen 1 = current plan, Monthly/Yearly prices, Start button, "Bible, devotionals & prayer journal: always free". Table in `<details>Compare Free and Pro`. Delete the hero list.

## /legal/privacy, /legal/terms, /legal/notices (083–085)
- **Purpose:** read policies. Understood: yes, but:
  - The **"Placeholder — requires legal review"** banner, "[DATE — to be completed by counsel]" and "[To be completed.]" sections are visible (APP, launch blocker).
  - There is no back link or tab bar. The only exit is the logo, which links to "/", the marketing/intro screen (`src/app/legal/layout.tsx:10`).
  - The 10px "FITNESS" wordmark is flagged as tinyText (decorative).
  - Privacy is 3.6 screens with no section index.
- **Recommendation:** "← Back" (`router.back()`, `/profile` fallback) in `legal/layout.tsx`; anchor contents on Privacy; replace drafts before launch.

## Navigation (tab bar + header)
- **Today:**
  - Tabs: Home / Train / Nutrition / Faith / You. Header on main screens: Search, Quick add, AI Coach (same `MainHeader`/`QuickAddButton` everywhere, so Quick add is consistent).
  - "You" mixes Progress (3 of 7 first rows, plus /progress and /coach via `alsoMatches`) with rarely used settings.
  - Copy already calls Nutrition "Food" (plan, onboarding).
  - The AI Coach pill is a gold call to action on every screen, including for Free members who can't use it.
- **Verdict:** **Home, Train, Food, Faith, Progress is more intuitive**, provided settings stay one tap away:
  - Rename the label to "Food" (shorter, matches the copy).
  - Make Progress a tab (daily use: week, badges, sleep).
  - Show the existing `ProfileButton` avatar on phones (remove `hidden md:inline-flex`).
  - Make the AI Coach header button icon-only so the header fits 393px.
  - Effort M: `nav-config.ts`, `main-header.tsx`, `home/page.tsx`, tests.
- **Quick add:** Its "Quick workout" tile starts a **blank** workout even when a program day is due. A new member who taps "+" can log an off-program session by mistake. When a day is scheduled, the tile should read "Today's workout" and use Home's `startHref`.

## Ranked issues

| ID | Title | Impact | Evidence | Fix (smallest) | Files | Effort | Class |
|---|---|---|---|---|---|---|---|
| I-1 | Verse of the day shows fragments ("Therefore…", "Brothers…", mid-word "contr…") | High | N/O/E 001 hero; `verseExcerpt` over 18 entries | Show the full verse when ≤220 chars; otherwise cut at a sentence end after ≥40 chars, never mid-word. Or add a curated `short` field per entry, e.g. "let us run with endurance the race set out for us" | `src/lib/domain/scripture.ts`, `src/data/content.ts` (also fixes Faith page) | S | APP |
| I-2 | New/Free members get veteran coach prompts ("Why did my bench stall?") | High | N 076 aboveFold | Compute `suggestedQuestions` even when disabled; replace `DEFAULT_SUGGESTIONS` with beginner prompts; deload only week ≥4 | `coach/page.tsx`, `coach-chat.tsx`, `lib/coach/context.ts` | S | APP |
| I-3 | Home primary action is an unlabelled play icon; card title goes elsewhere | High | N 001 ("Tap play…" hint), cf. /plan 11 | Use the full-width labelled `TodayWorkoutAction` ("Start workout · 43 min"); drop the hint | `home/page.tsx`, `components/home/today-workout-action.tsx` | S | APP |
| I-4 | Nutrition placed above the workout for lose-fat/general-health goals | High | `layout-prefs.ts:143` | Always put `workout` first in `defaultHomeOrder` | `src/lib/layout-prefs.ts` | S | APP |
| I-5 | Free Coach shows a disabled chat with no price; Upgrade → prices below the fold | Medium | N 076, 082 | One upsell card with "$19.99/month or $149.99/year · Faith stays free"; hide input, Plan tab and New chat for Free | `coach/page.tsx`, `coach-chat.tsx` | S | APP |
| I-6 | Billing is 6 screens, features listed 3×, "Faith always free" only at the bottom | Medium | N 082 (6.1 screens, 29 small text) | Prices and the free-Faith line on screen 1; comparison in `<details>`; drop the hero list | `profile/billing/page.tsx`, `components/profile/membership-plans.tsx` | M | APP |
| I-7 | Notifications: 23 toggles, 4.6–6.7 screens | Medium | N 080, E 085 (856 words) | "Recommended" 3 on top; categories collapsed with counts | `components/notifications/notification-settings.tsx` | M | APP |
| I-8 | Privacy consents scattered; Profile manages only wellness + AI | Medium | N 078 full; consent cards in sleep, nutrition, body-scan, journal | "Privacy & permissions" link list in Profile to the existing screens | `profile/page.tsx` | S | APP (GPS/camera OS prompts: DEVICE) |
| I-9 | Profile is 3.9 screens; Delete form always open; Sign out last; name/height edited in 2 places | Medium | E 083 | Settings rows first; Delete behind a row; Account & units → preferences | `profile/page.tsx` | M | APP |
| I-10 | Tab bar mixes Progress into "You"; copy says "Food" and "Profile & Settings" | Medium | 078 first screen; `plan/page.tsx:156,175,192`; `onboarding-questionnaire.tsx:451,663`; `ai-consent-card.tsx:54` | Tabs Home/Train/Food/Faith/Progress plus header avatar; at minimum fix the copy to match the labels | `nav-config.ts`, `main-header.tsx`, the copy files | M (copy: S) | APP |
| I-11 | AI Coach pill clipped on Home header | Medium | N/O/E 001 right edge | Hide the wordmark text below ~24rem, or use the icon-only Coach button on Home | `home/page.tsx` (Tailwind classes, not `globals.css`) | S | APP |
| I-12 | Quick add "Quick workout" starts a blank session while a program day is due | Medium | `quick-add.tsx:70` | Show "Today's workout" → the program start link when a day exists | `shell/quick-add.tsx`, `shell-context.tsx` | S | APP |
| I-13 | Preferences opens on a jargon comparison, and the goal change is 4 steps deep | Medium | N 079 | Summary list with jump-to-step; header "Your current program" | `profile/preferences/page.tsx`, `onboarding-wizard.tsx` | M | APP |
| I-14 | Duplicate Home actions (Quick actions module, Log food ×3, Coach ×2) | Low | N 001 full | Drop `quick` from the default order | `layout-prefs.ts` | S | APP |
| I-15 | Onboarding repeats a 3-line hero each step; single-choice needs an extra Continue | Low | 04–07 | Hero on step 1 only; auto-advance single-choice | `app/onboarding/page.tsx`, `onboarding-questionnaire.tsx` | S | APP |
| I-16 | Legal pages: placeholder text, no back link, logo goes to the intro | Low (High at launch) | 083–085 | Back link in the layout; replace the drafts | `src/app/legal/layout.tsx`, pages | S | APP |
| I-17 | /plan: 25-item equipment list, duplicate eyebrow, 26px "Go to Home" | Low | N 004 (smallTargets 1) | Summarise the equipment; `min-h-11`; drop the eyebrow | `plan/page.tsx` | S | APP |
| I-18 | Calendar title "Training ca…", 36px Move buttons | Low | O/E 002 (smallTargets 6) | Title "Calendar"; `min-h-11` | `calendar/page.tsx`, the Move component | S | APP |
| I-19 | Search: cut placeholder, 5-line rules, Home tab falsely active | Low | 003 | Shorter copy; remove `/search` from Home's `alsoMatches` | `search/page.tsx`, `nav-config.ts` | S | APP |
| I-20 | Coach: 6-line 12px disclaimer each view; 47x16 "Memory" link; "no AI provider key" wording | Low | O/E 081 smallTargets 2 | 2-line disclaimer + "More"; `min-h-11` link; plain "The coach is unavailable right now" | `coach-chat.tsx`, `coach/page.tsx` | S | APP |
| I-21 | Demo notices on Coach/Billing/welcome, "simulated" labels, checkout off | — | 076, 082, 02/03 | None (not seen in production) | — | — | DEMO-ONLY |
| I-22 | Restore purchases, GPS/camera/Health permission prompts, notification delivery | — | `store-paywall.tsx` | Verify on iPhone | — | — | DEVICE |

No fix needs a BADGE-BRANCH file. I-11 must be done with component classes, not `src/app/globals.css`. Quick add's Weight link points to `/progress/overview` (BADGE-BRANCH) but needs no edit there.

## Summary
1. The Home verse is a fragment ("“Therefore…” Hebrews 12:1"). `verseExcerpt` cuts at the first comma, which breaks several of the 18 verses, including one mid-word.
2. New and Free members see veteran coach prompts ("Why did my bench stall?") in a disabled chat that gives no price.
3. Home's main action is an unlabelled play icon, and goal-based ordering can push the workout below nutrition.
4. Free/Pro is unclear: no price on Coach, billing is 6 screens, and "Faith always free" is buried on the last screen.
5. The You tab is a 3.9-screen mix of progress and settings with scattered privacy consents. "Home, Train, Food, Faith, Progress" plus a header avatar would be clearer.
