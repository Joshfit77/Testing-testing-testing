# Presentation guide

How to present Narrow Gate Fitness with the interactive demo: the real app in demo mode, with the sample member
"Demo Athlete" (`docs/DEMO.md`). Every button named below is the app's own label, checked against the running demo on
2026-11-03. Nothing here describes a screen or feature the app doesn't have.

**Tone:** direct and plain. Say what the app does and what it doesn't. No superlatives, no promises of results.

## Before you present

1. `npm run demo` (or `npm run demo:reset` if the demo is already running and you've practised on it).
2. Open **a new browser window** at http://localhost:3000. The opening plays once per tab, so a fresh tab gives you
   the opening at the start and never again mid-talk.
3. For a phone-sized view on a Mac: Safari › Develop › Enter Responsive Design Mode › iPhone. For a projector, desktop
   width works too; every stop has been checked at both sizes.
4. Turn on Do Not Disturb. Close other tabs.
5. Internet is needed only if you'll look up a real barcode. Everything else works offline on the Mac.
6. The demo bar at the top of every screen says "Demo · sample data · purchases off, nothing is charged · AI replies
   simulated". Leave it visible: it's the honest frame for everything you show. For a clean screen recording, tap the ✕
   on the presenter row to hide just the presenter panel; the **Presenter** button brings it back.

### The presenter panel

Under the demo bar: "*n*/20 *stop*", a tag, one line on what to show, **Back** (‹), **Next**, the list icon (all 20
stops, tap any to jump there) and ✕ (hide). If you leave the path, it offers "Back to *n*. *stop*". Stop 1 plays the
opening again on purpose.

| Tag | Say it like this |
|---|---|
| **Live** | "This is the real feature working." |
| **Sample data** | "Real screen, made-up history." |
| **Simulated AI** | "No AI model is connected in this demo; the reply is a script and it says so on screen." |
| **Preview** | "This part needs the phone: here's the screen, the real thing runs on the iPhone app." |

## What to skip (unless someone asks)

- **The strict journey restart.** Don't explain the "miss a day, restart at Day 1" rule unless asked. If asked: "It's a
  discipline the member chooses. Their reading history and notes are kept; the app says plainly it doesn't change God's
  love for them."
- **The 3D exercise viewer** (Train › 3D): experimental, five exercises. Show the standard animated demonstrations.
- **The Nutrition Score number:** off in the demo, and in the app, until a dietitian has reviewed the formula. Show the
  ingredient explanations instead.
- **Accuracy of meal photos:** never quote one. It hasn't been measured, and in the demo the reply is simulated anyway.
- **Live GPS, Apple Health, notification delivery, purchases, the barcode camera:** phone-only or switched off. Say so
  in one sentence and move on.
- **Bible study commentary:** unreviewed commentary is hidden in the app, as it should be. Don't describe it as
  published.
- **Anything not on screen.** If asked about a feature that isn't there: "Not in the app today."

## 30-second version

One take, about 30 seconds. Start on the opening.

| Time | Tap | On-screen text (caption) | Voiceover |
|---|---|---|---|
| 0:00 | Fresh tab: the opening plays; tap **Enter Narrow Gate** | Narrow Gate Fitness | "Narrow Gate Fitness: strength training and nutrition, with an optional faith section that's free." |
| 0:08 | **Explore with sample data** | Training · Nutrition · Faith | "One home screen: today's workout, food and recovery." |
| 0:14 | Train tab › **Start workout early** (or **Start Today's Workout**), tick set 1 | Log every set | "Programs you can follow, and a logger that's one tap per set." |
| 0:22 | Faith tab | Faith: free for every member | "Daily Bible reading and prayer, free for everyone." |
| 0:27 | Back to Home | Pro All Access: $149.99 a year | "Pro unlocks the rest. $149.99 a year." |

## 2-minute version

| Time | Stop | Tap | Caption | Voiceover |
|---|---|---|---|---|
| 0:00 | 1 Opening | Fresh tab; **Enter Narrow Gate** | Narrow Gate Fitness | "This is the real app on sample data." |
| 0:10 | 2 Home | **Explore with sample data** | Home | "Demo Athlete, 28, eight weeks into training. Home shows today's workout, food, reminders and last night's sleep." |
| 0:25 | 4 Live workout | Train › **Start workout early** › tick set 1 › **Skip** on the rest timer | Log a set | "The plan picks today's workout. A set is one tap; the rest timer starts on its own." |
| 0:45 | 5 Exercise demos | Back, tap **Barbell Back Squat** | Every exercise demonstrated | "Every exercise has an animated demonstration you can slow to half speed." |
| 0:55 | 7 Nutrition | Food tab | Food diary | "The food diary counts against the member's own targets." |
| 1:10 | 9 Ingredients | **Nutrition Score** › **Search by name**, or Food › Check a label | Ingredients explained | "Ingredients are explained with what regulators say and how strong the evidence is. Presence isn't treated as proof of harm." |
| 1:25 | 13 Faith | Faith tab | Faith: free | "The Faith section is free: a reading plan with a daily Bible reading and prayer." |
| 1:40 | 19 Free vs Pro | Profile › **Plans & billing**, tap **Yearly** | $149.99 a year · $19.99 a month | "Free to start. Pro All Access is $149.99 a year, or $19.99 a month. Nothing is charged in this demo." |
| 1:55 | 20 Close | Home | | "That's Narrow Gate Fitness." |

## 4–6 minute version (main script, about 5:00)

Tap by tap, with timings. It starts with a brand-new member (welcome → account → first finished workout), then
switches to the sample member for the rest.

**Measured:** in the demo, the new-member path from the welcome screen to "Workout complete" is **21 taps plus 4 typed
fields** (age, height in feet and inches, weight). An automated test does it in about 7 seconds
(`e2e/demo.spec.ts`, "a new member goes from the welcome screen to a finished first workout"). **No person has timed it
yet:** rehearse it twice; at a calm pace it should fit inside 90 seconds, but check that yourself before you say so.

### 0:00–0:15 · Opening (stop 1)

- **Tap:** open a fresh tab at http://localhost:3000. Let the gate open (or tap **Enter Narrow Gate**).
- **Caption:** "Enter through the narrow gate." Matthew 7:13–14
- **Voiceover:** "Narrow Gate Fitness. The name comes from Matthew 7. The app is for anyone who trains; the faith side
  is there if you want it."

### 0:15–1:45 · Account to first workout (new member)

| Tap | Caption | Voiceover |
|---|---|---|
| **Start as a new member** | New member | "Here's what a new member sees." |
| Main goal: **Build strength** › **Continue** | One question per screen | "One question per screen." |
| Second goal: **Skip** | | |
| About you: **Male** or **Female**, then Age, Height (ft, in), Current weight › **Continue** | | "The basics, so targets are personal." |
| Weight goal › **Continue** · Daily activity: **Lightly active** › **Continue** | | |
| Experience: **Brand new to training** › **Continue** | | "A beginner gets a beginner's plan." |
| Schedule › **Continue** · Equipment: **Dumbbells only** › **Continue** | | "It's built around the equipment you actually have." |
| Diet style › **Continue** · Display: **Skip** · **Build my plan** | Your plan | "The plan is built straight away." |
| **Start Today's Workout** | Today's workout | "The first workout is one tap away." |
| Tick set 1 (the check button) | First set logged | "Reps are pre-filled; one tap logs the set. First-timers are told to start light." |
| **Skip** on the rest timer (or −15 s) | Rest timer | "The rest timer starts itself. I'll skip it for time." |
| **Finish** › **Finish & save** | Workout complete | "Done: the workout is saved, with what's next and how far through the program they are." |

### 1:45–2:00 · Switch to the established member

- **Tap:** Profile › **Sign out**. The sign-in page has the demo box: **Explore with sample data**. (A new tab won't do
  it: tabs share the sign-in, so you'd still be the new member.)
- **Voiceover:** "Now a member eight weeks in."

### 2:00–2:30 · Home (stop 2)

- **Show:** Today's reminders, Today's workout, Nutrition 1,203 / 2,600 calories, This week, Sleep & Recovery.
- **Voiceover:** "Home answers one question: what do I do today? Training, food, the day's reminders, last night's
  sleep."

### 2:30–3:10 · Training (stops 3–5)

- **Next** › Programs: "51 programs in the library, from beginner strength to strongman and running. Or build your own."
- **Next** › Train: "Powerbuilding, week 3 of 8. Today's session, ready to start."
- **Next** › Barbell Back Squat: tap **0.5×**. "Every exercise has an animated demonstration. It's an illustration,
  not filmed video, and the app says so."

### 3:10–3:30 · AI coach (stop 6)

- **Tap:** **Plan my deload** (a suggested question).
- **Voiceover:** "The coach reads the member's own training, food and sleep. In this demo no AI model is connected:
  the reply is a script and says so. Any change it suggests waits for the member to confirm."

### 3:30–4:10 · Nutrition (stops 7 and 9)

- **Next** › Food: "Thirty days of logged food. Today against target, water, and what's left."
- **Next** twice (skip the photo) › Check a label. Paste: `Water, sugar, citric acid, sodium benzoate, sucralose,
  natural flavours.` › **Check these ingredients**.
- **Voiceover:** "For a packaged food, the app explains each additive: what regulators have said, how strong the
  evidence is, and where it comes from. Being on the label isn't treated as proof of harm."

### 4:10–4:50 · Faith (stops 13–16)

- Faith tab: "The Faith section is free for every member."
- **Show:** The Gospels, Day 21 of 90; Today's Bible reading; Prayer.
- **Tap:** **Read** (Matthew, with the words of Jesus in red). Back. **Mark reading complete**.
- **Voiceover:** "A reading plan through the Gospels, the Berean Standard Bible, with the words of Jesus in red. Each
  day is a reading and a prayer. The prayer journal is private: it's only shared with the coach if the member ticks
  that on an entry."

### 4:50–5:20 · Free vs Pro (stop 19)

- Profile › **Plans & billing**. Tap **Yearly**.
- **Voiceover:** "Free is $0 and includes the Faith section. Pro All Access is $149.99 a year, or $19.99 a month; same
  features either way. Nothing is charged in this demo."
- **Optional:** in the demo bar, tap **Free**, then Run › **Outdoor run**: live GPS recording shows as a Pro feature.
  Tap **Pro** to switch back. "This switch only exists in the demo."

### 5:20–5:30 · Close (stop 20)

- Home. "That's Narrow Gate Fitness: training, nutrition and recovery, with a faith section that's free."

## 10-minute walkthrough

Follow the presenter panel's 20 stops with **Next**, about 30 seconds each. What to show at each:

| # | Stop | Show |
|---|---|---|
| 1 | Opening | The gate, Matthew 7:13–14; **Skip intro** is top right |
| 2 | Home | Today's workout, reminders, Nutrition, This week, Sleep & Recovery |
| 3 | Programs | Search, filters by goal, **Build my program** |
| 4 | Live workout | **Start workout early** › tick a set › rest timer **Skip** › back out (or finish) |
| 5 | Exercise demos | Barbell Back Squat: **0.5×**, **Full screen**, Target muscles, Alternatives |
| 6 | AI coach | A suggested question; point at the "Simulated demo reply" label |
| 7 | Nutrition | Daily totals, Calories remaining, Water **+250 ml**, Meals |
| 8 | Food photo | The demo note; choose any picture › **Estimate nutrition**: fixed sample items, labelled simulated, for the member to correct |
| 9 | Ingredients | **Check these ingredients** on a pasted list; allergens and additive notes |
| 10 | GPS | Run page, History, Records; the demo note on sample routes |
| 11 | Progress | Overview, Strength & Body Map, Badges; Body Scan is a walk-through |
| 12 | Health & recovery | Last night, Nightly report, This week, Your rhythm |
| 13 | Faith dashboard | The Gospels day 21, Today's Bible reading, Prayer, optional Faith challenge |
| 14 | Bible | Matthew 7: verse 13 bookmarked, red letters, **Reading display** |
| 15 | Journeys | Day 21 of 90, Coming up, Completed |
| 16 | Prayer journal | Filters: **Answered** ("A new job"), **For others** |
| 17 | Faith challenges | 40 Days Through the Narrow Gate, day 13 |
| 18 | Notifications | Faith reminders, **Next 24 hours**; delivery needs the phone app |
| 19 | Free vs Pro | **Monthly** / **Yearly**; the demo bar's **Free** / **Pro** switch |
| 20 | Close | Home |

## 20-minute walkthrough

The same 20 stops at about a minute each, plus these deeper moments. Leave 3–4 minutes for questions.

- **Stop 4, finish the workout:** **Finish** › **Finish & save** › Workout complete, Up next. Then Train › **Workout
  history** to show it saved.
- **Stop 5:** Train › **Exercises**: the library of 157, with filters.
- **Stop 6:** ask "Review my training" and show the app's own tool result behind the simulated wording.
- **Stop 7:** **Meal planner** and **Grocery list** from the Food page.
- **Stop 9:** with internet, **Scan it** › type the barcode of a product you brought; the product page shows its
  nutrition, ingredients and allergens from Open Food Facts. Never type a made-up code.
- **Stop 11:** Overview charts and personal records.
- **Stop 12:** tap a night for its **Nightly report** (stages, in bed vs asleep).
- **Stop 14:** tap a verse to highlight or add a note; **Search the Bible**.
- **Stop 15:** **Full schedule**.
- **Stop 16:** **New entry** and Memorize (two memory verses, one due today).
- **Stop 18:** switch a reminder off and on; the Next 24 hours preview updates.
- **Stop 19:** switch to **Free**, open Run › Outdoor run to show the Pro lock, then back to **Pro**.

## Screen-recording order

Record each as its own clip, so a mistake costs one clip. `npm run demo:reset` between takes.

1. Opening (fresh tab, let it play to the end): 10 s
2. New member: welcome → **Workout complete**: about 90 s
3. Home (sample member), slow scroll: 15 s
4. Programs → Train → Barbell Back Squat at 0.5×: 30 s
5. Logging a set with the rest timer: 20 s
6. AI coach question and reply: 20 s
7. Food diary, then a label check: 40 s
8. Faith: dashboard → Read → Mark reading complete: 30 s
9. Bible chapter with red letters and a highlight: 15 s
10. Prayer journal, Answered filter: 10 s
11. Plans & billing, Yearly selected: 10 s
12. Home to close: 5 s

Hide the presenter panel (✕) for recordings; keep the demo bar visible.

## If something goes wrong

| Problem | Fix |
|---|---|
| Wrong screen | The panel's **Back**, or the list icon › the stop |
| Off the path | "Back to *n*. *stop*" in the panel |
| Data changed during a run-through | `npm run demo:reset`, then **Explore with sample data** |
| The opening didn't play | Panel › list › **1. Opening gate** (or open a new tab) |
| Signed out after a reset | **Explore with sample data** |
| Need to switch from the new member back to the sample member | Profile › **Sign out** › **Explore with sample data** |
| "This device is set to …" on Notifications | The sample member's time zone is US Eastern; leave it, or tap to use the Mac's |
| Barcode lookup fails | You're offline or the product isn't in Open Food Facts: use a typed label check instead |
