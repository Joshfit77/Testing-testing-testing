# Audit: progress-sleep (Progress hub, badges, body map/scan, Sleep & Recovery)

Evidence: `before-*/shots` (est/occ 063–080, new 059–075) + `metrics.json`. Checked against screenshots and source.
Discoverability: Home's "Sleep & Recovery" row (`home/page.tsx:279`, shown as "Last night 7h 29m asleep · Apple Heal…") is **1 tap** away, but it sits on Home's second screen. Going through the tabs takes 3 taps (You → My Progress → Sleep). **The 2-tap target is met.**

## Screens

### /progress
- **Purpose:** a hub of 6 links plus a Steps card. **Understood:** yes.
- **Excess:** the Sleep row's description is 21 words ("…nightly reports and scores, history, estimated sleep debt, your schedule and energy patterns").
- **Text:** h1 truncated to "My Progre…" (`MainHeader`).
- **States:** the new and established screens are identical apart from the "Pro:" copy. On a Monday, est shows "0 this week · 8 week streak", while /progress/sleep/training says "3 workouts in the last 7 days".
- **Rec:** cut each description to 6 words or fewer (Sleep: "Last night, trends and schedule"). Let the hub title wrap.

### /progress/overview (BADGE-BRANCH)
- **Purpose:** trends, goals and bests. **Understood:** partly.
- **Size:** est is 8.2 screens with 59 interactive controls and 17 small targets (`Delete weight entry` buttons are 36×36).
- **Excess:** there are 3 strength charts: the Squat hero, "Squat · Bench · Deadlift" and "Strength improvements". The last one stays empty until the member picks an exercise *and* taps Show. Three forms sit inline: Log bodyweight, New goal and Measurements.
- **PR vs e1RM:** the hero reads "Squat (1RM) 351 lb" (`overview/page.tsx:174`), but the chart below it says "estimated 1RM". The Personal bests table does separate "EST. 1RM" from "HEAVIEST" correctly.
- **Goals mix units.** Example: "Bench press 265 lb · Strength · target 120 kg · now 111". The goal "Deadlift 405 lb … target 184 kg · now 195.4" is already met, but it shows no "reached" state, only "Done" and a trash icon. That trash icon actually *archives* the goal.
- **Charts:** y-axis labels are clipped (".000 teps", "kcal", "|54 lb"; see `charts/chart-plots.tsx` YAxis `width={48/52}`).
- **New member:** four zero tiles (0 / 0.0 / 0 / 0 lb).
- **Rec:** relabel the hero "Squat · est. 1RM". Show goals in the member's units, and add "Reached: mark done" when now ≥ target. Put the three forms behind "Log weight", "Add goal" and "Add measurements" buttons. Remove the "Strength improvements" picker. Replace the zero tiles with one "Log your first workout" empty state.

### /progress/badges (BADGE-BRANCH)
- **Purpose:** achievements. **Understood:** yes. **Size:** est 6.2 screens, with 94 small-text items.
- **Excess:** all 9 ranks in each ladder are listed with full BSB verse blocks, followed by all 20 achievements, 11 of which are locked.
- **Earned vs locked:** earned achievement cards are clearly distinct: gold ring, filled icon, "Earned Oct 29, 2026". Locked *ladder* ranks 4–9 are not: they show full-colour art, and only a small padlock marks them as locked.
- **Naming:** "Steadfast" is both Fitness rank 6 and a Consistency silver badge.
- **New member:** "Your first rank awaits · 1 more to Foundation" is clear.
- **Rec:** show the current rank, the next rank and the 3 nearest locked achievements, with everything else behind "See all ranks and badges". Desaturate locked art. Rename one of the two "Steadfast" badges.

### /progress/body-map (muscle-map is BADGE-BRANCH)
- **Purpose:** strength ranks by muscle group. **Understood:** partly.
- **Est:** the header says "Built from 29 completed workouts", yet the overall rank and all 12 regions say "Not assessed". Ranks stay hidden until the member picks "Men's table" or "Women's table" (both 36px tall).
- **Excess:** the legend shows 9 tiers when nothing has been assessed. The footer says "separate from your 27 milestone badges", but the badges page says "9 / 20".
- **New member:** a clean Pro lock.
- **Rec:** until a table is chosen, show only the chooser and the map, and hide the 12-row list and the legend. The interim fix in `body-map/page.tsx` (not badge files) is a description that reads "Choose a strength table to see your ranks".

### /progress/body-scan and /progress/body-scan/new
- **Purpose:** a consent gate for guided photos. **Understood:** yes.
- **Privacy:** clearly explained: resized on device, location removed, private storage, no admin or AI access, no body-fat guess. The two routes render identically before consent, which is correct.
- **Rec:** no change.

### /progress/sleep
- **Purpose:** last night, trend and next action. **Understood:** partly.
- **Est (6.1 screens, 41 interactive, 26 cards), from the top:**
  - The first screen spends its space on a 37-word description ("…The app itself measures nothing…"), "Enter sleep by hand" and a source card ("Apple Watch via Apple Health · Last synced 6 min ago · Manage").
  - "7h 29m" is cut off at the bottom of the first screen (`069-progress-sleep.png`).
  - Next comes the Last night card: stage bar, 3 vitals tiles, times, goal bar, score and link. Then the timer, the quick check-in (about 2.5 screens down), This week, Your rhythm, 3 "Habits to work on" tips, 8 link rows, and a 14-row "Last 14 days" list (about 1.9 screens) that repeats History.
- **Occ:** has the same structure at 4.9 screens. "Your rhythm" calls the schedule "a steady rhythm" based on 3 nights.
- **New member:** a consent card only (1 screen). It is clear, but it gives no preview of what the screen will show once sleep is logged.
- **Source:** the card stays titled "Last night" for a days-old night (`nights[0]` fallback).
- **Rec, in this order:**
  1. Title, plus "Enter sleep by hand".
  2. Last night: duration, then score and goal bar, then a one-line source with "Manage", then "Nightly report". Vitals and the stage bar move to the nightly report.
  3. The This-week trend.
  4. **One** tip, with "More habits (2)".
  5. The quick check-in.
  6. The timer.
  7. The links.
  8. Only 3 recent entries, plus "All nights".
- Retitle the card with the date when the newest night isn't last night.

### /progress/sleep/night/[date]
- **Purpose:** the nightly report. **Understood:** yes, mostly. The hero (time asleep, 99% of goal) and the score come first.
- **Stage chart is unreadable.** The x-axis reads "10:0PM2:00 AM…6:13 AM", with every label overlapping (`stage-timeline.tsx`: hourly 10px labels on a ~290px track, plus start and end labels on top). Ticks are set on UTC hours (`setUTCMinutes(0)`), so in half-hour zones they land at :30 local time.
- **Inconsistent figures:** "99% of your 7h 30m goal" appears above "Time asleep vs goal: 100% of your goal". "Typical wake time 6:35 AM" here differs from 6:24 AM on the dashboard, because the two use different 14-night windows.
- **States:** missing data is handled well ("anything not entered shows as not recorded"), and naps get their own section.
- **Rec:** label every 2 hours in short form ("11 PM"), and drop tick labels within 8% of either end. Name the window: "Typical (2 weeks before this night)".

### /progress/sleep/history
- **Purpose:** ranges and a list of nights. **Understood:** yes. **Size:** est 6.1 screens.
- **Score accuracy:** Tue Oct 27, "7h 44m **in bed** · Entered by hand", scores **100**. That is higher than every watch-recorded night, because missing parts are dropped ("leaving something out never lowers your score").
- **Before consent:** the new member can open the page and sees empty frames plus a nested Pro lock.
- **Rec:** show "Partial: 1 of 4 parts" beside scores built from fewer parts, and leave partial scores out of "Average score".

### /progress/sleep/debt
- **Purpose:** the debt estimate. **Understood:** yes. "6m behind" leads the page.
- **Rec:** collapse the ~90-word "How it adds up" paragraph into a `<details>`.

### /progress/sleep/energy
- **Purpose:** estimated alertness. **Understood:** partly.
- **Units:** "last night's 7.5 h and an estimated 0.1 h of sleep debt" uses decimal hours, while every other screen shows "7h 29m" and "6m" (`energy/page.tsx:70-71`).
- **Legend:** the bar colours are explained only by colour name: "gold 80 and above, champagne 65–79, bronze below".
- **Wind-down:** "Start winding down 9:36 PM" contradicts the schedule and Home reminder (see PS-09).
- **Rec:** use `formatDuration`, and add the numeric band to the tooltip or bar labels.

### /progress/sleep/schedule
- **Purpose:** bedtime and wake windows. **Understood:** yes. Est is 1.8 screens: "Bedtime window 10:06 PM – 11:06 PM".
- **Friction:** the wake-time field here is separate from the alarm's wake time, so the member sets 06:30 twice.
- **Rec:** set the alarm default from this wake time, and add one "Remind me to wind down" line here.

### /progress/sleep/training
- **Purpose:** sleep next to training. **Understood:** yes. The relationships are stated accurately: "associations, not causes" and "A sleep score is not a recovery measure".

### /progress/sleep/checkin
- **Purpose:** the full morning check-in. **Understood:** yes.
- **Size:** 3.1 screens of 7 rating scales plus evening and night sections. This is fine because it is optional. The 1-tap quick check-in lives on the dashboard. The flagged small targets (16–20px checkboxes) sit inside min-h-11 labels, so the tap areas are OK.
- **New member: dead end.** It shows "Allow sleep logging on the Sleep & Recovery page first." with no link or button (interactive count 1).

### /progress/sleep/log
- **Purpose:** manual entry. **Understood:** yes.
- **Friction:**
  - The defaults are fixed at 10:30 PM–6:30 AM, even when last night was already imported. Choosing **"A Nap" keeps the overnight defaults**.
  - A full IANA time-zone select is shown on every entry.
  - "More detail" is 285×20.
- **New member:** the same dead end as the check-in.
- **Rec:** for a nap, default to "now − 30 min → now". For a night, default to the member's typical bed and wake times. Show the zone as a single line ("Times in America/New York · Change") inside More detail.
- **DEVICE:** the iOS datetime-local wheel picker needs judging on a real phone.

### /progress/sleep/alarm (DEVICE)
- **Purpose:** a repeating alarm. **Understood:** partly.
- **Copy:** "What to expect" tells members "This alarm hasn't been tested on a physical phone yet." It also describes a smart alarm that "isn't built" (`sleep-alarm.ts:137`, `method/page.tsx:110`).
- **Device limits are explained well:** silent mode, Focus, force-quit.
- **Rec:** test the alarm on a device, then remove both sentences.

### /progress/sleep/method
- **Purpose:** reference (1,102 words, 5.2 screens). Fine as a linked reference; no change.

### /progress/sleep/settings
- **Purpose:** goal, sources and privacy. **Understood:** yes.
- **Excess:** there are 4 source actions: "Switch import off", "Delete imported entries" (red), "Disconnect", and "Disconnect and remove imported" (red).
- **Rec:** keep an import on/off switch plus a single "Disconnect…" whose confirm step asks whether to keep or remove imported nights.

## Ranked issues

| ID | Title | Impact | Evidence | Fix (smallest) | Files | Effort | Class |
|---|---|---|---|---|---|---|---|
| PS-01 | Sleep dashboard buries last night under the description and source card, then sprawls | High | est `069-progress-sleep.png` ("7h 29m" cut off at the fold); 6.1 screens / 41 interactive / 26 cards | Reorder as in /progress/sleep. Source becomes one line in the Last night card. Move vitals and the stage bar to the nightly report. Show 1 tip. Keep 3 recent entries. Description ≤ 12 words. | `progress/sleep/page.tsx`, `components/sleep/source-card.tsx` | M | APP |
| PS-02 | Sleep-stage chart time labels overlap and can't be read | High | est `080-sleep-night-full.jpg`, axis "10:0PM2:00 AM…" | Label every 2h in short form, skip labels near the ends, put ticks on local hours | `components/sleep/stage-timeline.tsx` | S | APP |
| PS-03 | Check-in and manual log are dead ends before consent | Medium | new `071`, `072`: "Allow sleep logging … first.", 1 interactive | Render `<SleepConsentCard/>` in place of the Notice | `sleep/checkin/page.tsx`, `sleep/log/page.tsx` | S | APP |
| PS-04 | Overview mixes PR, e1RM and goal units, and is 8 screens long | Medium | est `064-progress-overview-full.jpg`: "Squat (1RM)"; "265 lb · target 120 kg"; 59 interactive, 17 smT | Use the "est. 1RM" label, show goals in member units with a reached state, put forms behind buttons, drop the picker chart | `progress/overview/page.tsx` — **BADGE-BRANCH**. Unit display could move to a new `components/progress/goal-list.tsx`, but the page still has to import it, so defer to the badge developer. | M | APP |
| PS-05 | Chart y-axis labels clipped (".000 teps", "kcal") | Medium | est overview full, Steps, Calories and Training volume charts | Compact ticks ("6k"), unit in the subtitle, or auto width | `components/charts/chart-plots.tsx`, `chart-format.ts` (not badge files) | S | APP |
| PS-06 | Badges page shows everything; locked ranks look earned; duplicate "Steadfast" | Medium | est `065-progress-badges-full.jpg`: 6.2 screens, 94 small-text items | Current, next and 3 nearest, with "See all"; desaturate locked art; rename | `progress/badges/page.tsx`, `lib/domain/achievements.ts` — **BADGE-BRANCH** | M | APP |
| PS-07 | Body map says "Not assessed" for an established member until a strength table is chosen | Medium | est `066-progress-body-map-full.jpg`: 12× "Not assessed"; buttons 36px | Hide the list and legend until a table is picked. Interim: header copy in `body-map/page.tsx`. | `components/progress/muscle-map.tsx` — **BADGE-BRANCH**; `body-map/page.tsx` | S | APP |
| PS-08 | Manual logging: nap keeps overnight defaults; TZ select always shown; fixed defaults | Medium | est `076-progress-sleep-log.png`; `session-form.tsx` | Nap defaults to the last 30 min; defaults from typical times; TZ moved into More detail | `components/sleep/session-form.tsx`, `sleep/log/page.tsx`, `lib/domain/sleep.ts` | S | APP (+DEVICE picker) |
| PS-09 | Four different bedtime cues | Medium | typical bedtime 10:36 PM (`069`), window 10:06–11:06 PM (`073`), "winding down 9:36 PM" (`072`), Home reminder "Time to wind down 9:45 PM" (`001-home`) | Base wind-down on the bed window start; offer the reminder from the schedule page; alarm default = target wake | `lib/domain/sleep-energy.ts`, `sleep/schedule/page.tsx`, `components/sleep/alarm-form.tsx` | M | APP |
| PS-10 | Alarm copy says it is untested and describes a feature that isn't built | Medium | est `077-progress-sleep-alarm-full.jpg` | Test on a real phone, then delete both lines | `lib/domain/sleep-alarm.ts`, `sleep/method/page.tsx` | S | DEVICE + APP |
| PS-11 | A time-in-bed-only night scores 100, overstating quality | Medium | est `070-progress-sleep-history-full.jpg`: Oct 27 "in bed", score 100 | "Partial (n of 4)" tag; exclude partial scores from the average | `components/sleep/score-card.tsx`, `sleep/history/page.tsx` | S | APP |
| PS-12 | Inconsistent figures across sleep screens | Low | "7.5 h / 0.1 h" (`072`); 99% vs 100% (`080`); wake 6:24 vs 6:35 AM | Use `formatDuration`; one rounding rule; name the comparison window | `sleep/energy/page.tsx`, `sleep/night/[date]/page.tsx` | S | APP |
| PS-13 | Settings has 4 source buttons, 2 of them red and destructive | Low | est `079-progress-sleep-settings-full.jpg` | One "Disconnect…" with a keep/remove choice in the confirm | `sleep/settings/page.tsx` | S | APP |
| PS-14 | No loading boundary on the hub, overview, sleep dashboard, schedule, settings, alarm, check-in and log | Low | loadMs 803–1304; no `loading.tsx` in those folders | Copy `sleep/history/loading.tsx`. A new `overview/loading.tsx` avoids the badge file. | new `loading.tsx` files | S | APP |
| PS-15 | Hub title truncated to "My Progre…"; long descriptions; "0 this week" next to "8 week streak" | Low | est `063-progress.png` | Let the title wrap; descriptions ≤ 6 words; subtitle "8-week streak" | `progress/page.tsx`, `components/shell/main-header.tsx` | S | APP |
| PS-16 | "New Best 0/1" while the overview shows 6 personal bests and +19.8 lb | Low | est badges vs overview | Check that production writes PR rows. Copy: "Beat your best from an earlier session". | `lib/domain/achievements.ts` — **BADGE-BRANCH** | S | DEMO-ONLY (seed has no PR rows) |
| PS-17 | Sleep demo note says "these nights are sample data" to a member with no nights | Low | new `065-progress-sleep.png` | Show it only when sample nights exist | `components/demo/demo-note.tsx` | S | DEMO-ONLY |

**Keep:** per-session time zones (a night belongs to the wake day in its own zone); naps are pill-labelled and excluded from nightly figures; sources always labelled; clear consent/privacy copy.

## Summary
1. The sleep dashboard leads with explanation and the data source. Last night's duration starts at the fold and the page runs 6.1 screens. Reorder it and cut it down so it leads with duration, score, trend and one tip.
2. The sleep-stage chart's time axis can't be read: every label overlaps.
3. Before consent, the check-in and manual log are dead ends, and manual logging keeps overnight defaults even when the member picks a nap.
4. Progress (overview, badges and body map, all badge-branch files) shows too much at once:
   - the hero calls an estimated lift "1RM", and goals mix lb and kg;
   - locked ranks look earned;
   - an established member's ranks all say "Not assessed".
5. Sleep guidance contradicts itself: there are four bedtime and wind-down times, the alarm says it is untested, and a time-in-bed-only night scores 100.
