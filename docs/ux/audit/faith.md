# Faith area: first-time-user UX audit

Evidence: `before-{new,occasional,established}/shots/0NN-faith-*.png|-full.jpg` and `metrics.json`. Shot numbers below are from **new** (N) or **established** (E) unless stated otherwise. "36px" targets on `size="sm"` Buttons and 48×28 Switches are **not** real failures: both add an invisible `after:-inset-*` hit area (`src/components/ui/button.tsx`, `switch.tsx`). The real small targets are plain links and buttons that have no hit area (listed below). `lowContrast` = 0 on every Faith screen. None of the files below is on the BADGE-BRANCH list.

## Suspected bug: "Today's devotional · Day 33 of 40" for a brand-new member

**It is a real APP bug, not a demo artefact, and the member is not enrolled in a shared challenge.** In `src/app/(app)/faith/page.tsx` the quick-action tile always renders `Day {devotionalForDate(challenge.today).day} of 40`. `devotionalForDate` (`src/lib/domain/challenge.ts:74`) is the **calendar rotation for members who are not enrolled**: `daysBetween("2026-01-01", today) % 40`. On 2026-11-09 that is 312 % 40 = 32, so the tile shows `DEVOTIONALS[32]` = day 33. Every account sees that number on that date. The devotional card itself handles this correctly: `FaithChallenge` shows "Today's devotional" with no day number when `enrolled` is false. Only the tile mislabels the rotation index as personal progress. It also contradicts enrolled members: E/041 shows the tile "Day 33 of 40" while the card below says "Today's devotional · Day 13 of 40" (demo seed enrolment `started_on: dayOffset(-12)`).

---

## /faith
- **Purpose:** daily hub. **Primary action:** today's reading, then prayer.
- **Understood immediately?** Partly. N/039: 3.2 screens, 734 words, 46 cards, 57 controls. E/041: 4.6 screens, 872 words, 52 cards, 84 controls. The first screen offers 3 pills (Bible/Prayer/Plans), then 3 tiles, then the Today card, then an 8-tile tool grid.
- **Duplication:** Bible is reachable 3 times above the second screen (pill, tile, grid). Prayer appears 4 times (pill, "Write a prayer" tile, "Journal" tile, folded "Prayer journal", which holds a second full `JournalForm`). The devotional appears 3 times (tile, card, 40-day challenge). Verse of the day appears twice (hero, plus the folded "Today's verse, reflection and motivation"). The pill **"Plans" opens `/faith/studies`**, while reading plans are called "Journey". The footer sentence "Faith is always here in its own tab; the Scripture card on Home can be turned off in You." adds nothing.
- **New member:** the Today card's first instruction is the penalty rule (see journey rule below). Below that sit three "challenge" concepts: the "Faith challenge" (an optional daily act, `data/faith-challenges`), "Faith & fitness challenge · 40 Days Through the Narrow Gate · Start the challenge", and the mislabelled "Day 33 of 40".
- **Established:** the "Continue reading · John 3" tile (last chapter opened) sits next to the Today card's "Read" (Matthew 24:26–51). That gives two different "reading" answers on one screen.
- **Small text:** 81 (N) and 108 (E) elements are 12–14px. The tile sublabels and the 8 tool labels use `text-xs` (12px).
- **Recommendation:** remove the pill nav. Make the first tile today's journey passage. Fix the day label. Replace the inline journal form with a link. Collapse the 40-day card for members who are not enrolled. Drop the footer sentence. Expected result: about 1 screen saved and the Today card one row higher.

## /faith/journey
- **Purpose:** today's reading and prayer, plus progress. Primary action: Read, then Mark complete.
- **Clear?** Yes for E (E/042, 2.4 screens). For N, the empty state (1 screen) leads with a bold gold callout of `JOURNEY_RULE`, followed by `RULE_GRACE` in muted grey. The penalty is louder than the grace.
- **Friction:** the "Read" link opens only the first reference. Reading is marked complete here, not in the reader (issue F3). The eyebrow "· attempt N" and the "Attempts" list add scorekeeping.
- **Recommendation:** keep it as is, but show attempts only in the Attempts section. Present the rule and the grace with equal weight (below).

## /faith/journey/new
- 4 steps (plan → book/topic → length → preview and checkbox). The steps are clear (N/041, 1.2 screens, 0 small targets). Each length shows its minutes per day, which is good. Step 4 shows the rule, the grace line and a required checkbox, which is the right place for consent. **Recommendation:** none beyond the copy fix.

## /faith/journey/schedule
- **Purpose:** the full plan. E/044: **10.4 screens, 146 controls, 145 reference links at 36px** (`min-h-9` plain links with no hit area). The list always starts at Day 1. On Day 21 the member scrolls past 20 completed cards to reach today. For N it redirects to `/faith/journey` (correct).
- **Recommendation:** link "Full schedule" to `/faith/journey/schedule#day-${view.day}`, change the links to `min-h-11`, and fold completed days into one row ("Days 1–20 complete ›").

## Journey rule wording (strict daily rule, automatic restart at Day 1)
The rule today reads: "If you miss your daily Bible reading or prayer, your current journey restarts at Day 1. Your previous reading history and notes will still be saved." A newcomer sees it 3 times before joining. On `/faith` it appears **without** the grace line, as the second sentence they read. "Miss" is ambiguous because what actually counts is *marking* both before midnight. The restart copy is kind ("Your journey begins again today. God's mercies are new every morning."). The pre-join copy is the punitive-sounding part. Suggested wording (owner and theology sign-off, `docs/faith/REVIEW.md`): **"Each day, mark your reading and prayer complete before midnight. If a day is left unmarked, your journey starts again at Day 1 — your reading history and notes stay saved."** Remove the rule from the empty `TodayCard`. Keep it in step 4 and on `/faith/journey`.

## /faith/bible
- **Purpose:** open any chapter. N/043 "Where to begin: John 1 / Genesis 1 / Psalm 1" is a good empty state. E shows "Continue reading John 3".
- **Friction:** 3.4–3.5 screens. The New Testament starts after all 39 Old Testament books, so a newcomer scrolls about 2 screens to reach Matthew. **Recommendation:** add two jump links ("Old Testament · New Testament") above the grid. Show today's journey passage when it differs from Continue reading.

## /faith/bible/john
- A clear chapter grid (1 screen). E marks "John 3, opened before". No issues.

## /faith/bible/john/3
- **The reader is strong.** It uses an 18px serif with 1.8 line height, scaling 85–180% from visible −/+ buttons that persist per account. Red letter `#f0736a` on `#070707` measures 7.1:1. The light page's red `#9b1c24` on `#f8f4ea` measures 7.4:1. Previous/next chapter buttons appear at both top and bottom (44px and 56px). An optional red-letter switch is included.
- **Friction:** the display settings sit behind an unlabelled sliders icon (aria-label only). Back goes to `/faith/bible`, not to the journey. There is no way to mark today's reading complete here (F3). The 36px verse rows are full-width and acceptable.
- **Recommendation:** when this chapter is in today's journey references, end the chapter with the existing "Mark reading complete" row and "Back to today".

## /faith/bible/search
- 1 screen. The rules are explained ("Whole words… quotes… a reference like Romans 8:28"). No issues.

## /faith/bible/history
- Good empty state ("Nothing read yet. Chapters you open appear here."). E/049 is grouped by day. The explanation "Opening a chapter is not the same as completing a journey's reading" is needed and clear. No change.

## /faith/bible/saved
- N shows three helpful empty states ("Tap a verse while reading, then Bookmark…"). No issues.

## /faith/journal
- **Purpose:** private prayer list. The privacy line is good. N/049 shows 11 filter chips (4 rows) above an empty list that says **"No entries yet. Write your first prayer on the Faith tab."**, which points away from the "New entry" button just above it.
- **Recommendation:** for an empty journal, hide the search and filters and change the empty text to "Tap New entry to write your first prayer."

## /faith/journal/new
- **Purpose:** quick, private prayer. N/050: 1.4 screens. **Save is below the fold.** The form has 6 type chips, Title, body, Scripture, Date and Theme, plus the share checkbox. Opened from the journal it defaults to **Reflection** (`faith-forms.tsx:39`). The 20×20 checkbox sits inside a 44px label, so it is fine. Privacy copy is present twice and clear.
- **Recommendation:** put the body field first. Move Type, Title, Scripture, Date and Theme into a closed "More options" `<details>`. Default to Daily prayer. That makes it 2 taps from Faith (tile → type → Save), with Save above the fold.

## /faith/journal/[id]
- E/058 is clear: a "Private" card, then Archive / Edit / Delete. "Share with AI Coach" is a prominent filled button on a private prayer. Making it a text link would nudge sharing less. Low.

## /faith/studies
- **Discovery:** 3.4 screens, 29 cards. "N done" appears only in a 12px third line, and studies already started are not surfaced. Studies are reached through the "Plans" pill (wrong name) or the "Studies" tile in grid row 2.
- **Recommendation:** add an "In progress" group at the top, built from the `done` map the page already loads. Rename the pill, or remove it (F4).

## /faith/studies/gospel and lesson (`/good-news`)
- The study page is clean (1 screen, 4 lessons). The lesson (E/061, 2.9 screens) shows Scripture first, labelled "SCRIPTURE · BSB", with "Read it in context", cross-references, notes and "Next: Our need". Every one of the 31 studies is `review: draft`, so every member sees **"Study notes for this lesson are being reviewed and will appear here once approved."** That is internal process shown to members. **Recommendation:** shorten it to "Read the passage slowly, and write down what you notice."

## /faith/memory and verse
- The empty state is helpful (N/052: an Add field plus "tap verses while reading and choose Memorize"). Practice (E/062) is simple: Hidden words or Recall reference, then "I remembered it" or "Needs more practice". There are no streaks or points, which suits the owner's wish for little gamification. **The hidden-word buttons are 24px tall** (8 small targets, e.g. `27x24 "Hidden word: tap to show"`) with no hit area (`memory-practice.tsx:65`). Fix: `min-h-11 align-middle` or the `after:-inset-2` pattern.

## /faith/practices
- "Just a record, never a score." Good tone. The empty state links to "Choose them on the Faith tab" (`/faith#practices-title`), which is inside a closed `<details>`. Whether iOS Safari opens the section on a fragment link needs a phone to check (DEVICE).

## /faith/reminders
- Redirects to `/profile/notifications#faith`, so the tab bar highlight jumps from Faith to **You** (N/054). That page is 4.6 screens (N) to 6.7 (E). The Faith copy ("Gentle nudges, never streak warnings. Always free.") is good. The page belongs to the Profile area. Keep the deep link and change the back link to return to Faith.

## /faith/ask
- **AI is clearly separated from Scripture:** "Bible study helper (AI)" label, a "This is an AI, not a pastor…" notice, and "Passages cited · BSB" quoted from the verified text, not from the model (`bible-ask.tsx`). "Delete history" shows with no history (N/055). The "Demo: the Bible study helper…" box is DEMO-ONLY.
- **Free status:** I found no Pro gate anywhere in Faith code. Ask has a usage quota (Free 10 a day, Pro 40, `lib/bible/ai.ts:99`) but no upsell. That is fine, but worth the owner knowing about.

---

## Ranked issues

| ID | Title | Impact | Evidence | Fix | Files | Effort | Class |
|---|---|---|---|---|---|---|---|
| F1 | Today's journey passage is not what "Continue reading" opens | High | E/001-home "Continue reading John 3" vs E/042 today = Matthew 24:26–51; E/041 shows both | With an active journey whose reading is not done, Home's Faith card and the first Faith tile link to `todayPlan.refs[0]`, labelled "Today's reading · Matthew 24:26–51" (Faith tab → tile = 1–2 taps) | `src/app/(app)/faith/page.tsx`, `src/app/(app)/home/page.tsx` | M | APP |
| F2 | "Day 33 of 40" shown to every member | High | N/039 tile; E/041 tile 33 vs card 13 | Show `Day ${challenge.currentDay} of 40` only when `challenge.active`. Otherwise show no day number | `src/app/(app)/faith/page.tsx` | S | APP |
| F3 | Reading can't be completed where it's read | High | Reader has no check-in; Back → `/faith/bible` (source) | When the chapter is in today's references, render the reading row of `JourneyCheckIn` and "Back to today" at the chapter's end | `faith/bible/[book]/[chapter]/page.tsx`, `components/faith/journey-checkin.tsx` | M | APP |
| F4 | Faith hub overloaded and duplicated; "Plans" opens Studies | Medium | N/039 3.2 screens, 734 words, 46 cards; E/041 4.6 screens, 872 words | Remove the Bible/Prayer/Plans pills, the inline `JournalForm` and the footer sentence | `src/app/(app)/faith/page.tsx` | S | APP |
| F5 | Penalty rule is a newcomer's first message | Medium | N/039 Today card; N/040 bold callout | Remove `JOURNEY_RULE` from the empty `TodayCard`. Give rule and grace equal weight. Reword (owner sign-off) | `components/faith/today-card.tsx`, `lib/faith/journey-copy.ts`, `faith/journey/page.tsx` | S | APP |
| F6 | Gamification and "challenge" naming overlap | Medium | N/039 "Faith challenge" + "40 Days… Start the challenge" + 40-cell grid (E/041); "· attempt N" | For members not enrolled, fold the 40-day card into one link under the devotional. Rename the daily item "Today's act of faith". Drop "attempt N" from `TodayCard` | `components/faith/faith-challenge.tsx`, `today-card.tsx` | S | APP |
| F7 | Prayer entry slower than needed | Medium | N/050 1.4 screens, Save below fold, default "Reflection" | Body first, extras in "More options", default `daily`. Empty journal: "Tap New entry…" | `components/faith/faith-forms.tsx`, `faith/journal/page.tsx` | S | APP |
| F8 | Schedule is 10 screens and starts at Day 1 | Medium | E/044 10.4 screens, 145 links at 36px | Anchor to `#day-N`, `min-h-11`, fold completed days | `faith/journey/schedule/page.tsx`, `faith/journey/page.tsx` | S | APP |
| F9 | Memory hidden words have 24px targets | Medium | E/062, 8 small targets 27–66×24 | Add 44px hit area | `components/faith/memory-practice.tsx` | S | APP |
| F10 | Studies: no "in progress"; draft-review text on every lesson | Low | E/053 3.4 screens; E/061 notice | "In progress" group first; shorter notice | `faith/studies/page.tsx`, `faith/studies/[study]/[lesson]/page.tsx` | S | APP |
| F11 | New Testament is 2 screens down in the Bible index | Low | N/043 3.5 screens | "Old · New Testament" jump links | `faith/bible/page.tsx` | S | APP |
| F12 | Reminders leave the Faith tab | Low | N/054 You tab highlighted, 4.6–6.7 screens | Back link returns to Faith | profile notifications page | S | APP |
| F13 | "Delete history" with no history | Low | N/055 | Render only when `messages.length` | `components/faith/bible-ask.tsx` | S | APP |
| F14 | 12px labels on hub tiles | Low | N/039 81, E/041 108 elements at 12–14px | `text-sm` for tool and tile labels | `src/app/(app)/faith/page.tsx` | S | APP |
| F15 | Practices link targets a folded section | Low | N/053 | Check on iPhone; open the `<details>` when the hash matches | `faith/page.tsx` | S | DEVICE |
| F16 | Ask demo notice | — | N/055 | none (production never shows it) | — | — | DEMO-ONLY |

## Summary
1. "Continue reading" opens the last chapter opened, not today's journey passage. Today's reading is not one obvious tap from Home or Faith (F1).
2. Every member sees "Day 33 of 40". It is the shared date rotation (`devotionalForDate`) mislabelled as progress, and it contradicts the enrolled day (F2).
3. Reading is marked complete on a different screen from where it is read, and Back goes to the Bible index (F3).
4. The Faith hub runs 3–4.6 screens with Bible, prayer and devotional each repeated, and "Plans" opens Studies (F4).
5. A newcomer's first message is the Day 1 restart rule, shown without its grace line. Three overlapping "challenges" add scorekeeping (F5, F6).
