# Visual comparison: final build vs the owner's 10-page reference (2026-11-07)

Scope: the ten screens redesigned on 2026-11-07, captured from the final production build (commit 59c854e, demo account,
iPhone 15 Pro viewport 393 × 852 at 2×) and placed next to the matching PDF page. Sheets:
`docs/screenshots/redesign-2026-11-07/01-home.webp` … `10-pro.webp` (reference left, final build right).
Nothing in this document changes code; it is the assessment the owner asked for before any further redesign.

Rating scale, each axis 0–10: **Similarity** to the reference page, **Readability** of text at phone size, **Layout**
(hierarchy, spacing, what is above the fold), **Imagery** (quality and fit of pictures, art and icons), **Usability** of
the real, working screen (tap targets, clarity of the next action). Scores are mine, by eye, from the sheets and the
running app; they are not user-tested.

## Annual price: $149.99, verified

The owner asked whether the annual price should be $149 or $149.99. Every source in the repository says **$149.99**:
`APPROVED_PRO_PRICE_CENTS = { month: 1999, year: 14999 }` in `src/lib/domain/plans.ts`; the store product
`ngf_pro_yearly` at $149.99 in `docs/MOBILE_BILLING.md` and `docs/TESTFLIGHT_SETUP_GUIDE.md`; the legal auto-renewal
text; the unit, paywall and e2e tests (which expect "$149.99 / year" and a 37 % saving over 12 × $19.99); and the owner's
own reference page 10 ("$149.99 per year, Save 37%"). Nothing says $149. **No billing change was made and none is
recommended.** The prices Apple, Google and Stripe actually charge live in those consoles, not in this repository, and
should be checked there once before launch (App Store Connect → Subscriptions → ngf_pro_yearly; Stripe → Prices).

## Summary scores

| # | Screen | Similarity | Readability | Layout | Imagery | Usability | Mean |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Home Dashboard | 7 | 9 | 8 | 6 | 9 | 7.8 |
| 2 | Workout In Progress | 8 | 9 | 8 | 7 | 9 | 8.2 |
| 3 | Exercise Demonstration | 6 | 9 | 8 | 5 | 9 | 7.4 |
| 4 | Workout Complete | 8 | 9 | 8 | 8 | 9 | 8.4 |
| 5 | AI Coach | 7 | 8 | 7 | 7 | 8 | 7.4 |
| 6 | Nutrition | 8 | 9 | 7 | 6 | 9 | 7.8 |
| 7 | Training Programs | 5 | 8 | 6 | 6 | 8 | 6.6 |
| 8 | Progress | 7 | 8 | 8 | 7 | 8 | 7.6 |
| 9 | Faith | 6 | 9 | 6 | 5 | 9 | 7.0 |
| 10 | Narrow Gate Pro | 7 | 9 | 7 | 7 | 8 | 7.6 |
| | **Average** | **6.9** | **8.7** | **7.3** | **6.4** | **8.6** | **7.6** |

**Overall visual-design score: 7.4 / 10.** The structure, typography and usability of the reference are in the app
(readability and usability average above 8.5). What is missing is depth: the reference's screens are photographic and
cinematic, ours are flat vector scenes and flat icons, and three screens (Programs, Faith, Nutrition) put a working-but-
busy first section where the reference puts its strongest image. Those three gaps account for most of the distance from
a "premium $19.99 a month" feel, and all of them are presentation-only changes.

## Screen by screen

### 1. Home Dashboard (page 1) — 7 · 9 · 8 · 6 · 9

What matches: scenic hero with cross and mountains, greeting, verse with reference, gold Today's Workout card with the
round play button, Recovery and streak tiles, This Week card with gold bar, five-tab bar with gold active tab.

Less polished than the reference:
- The hero scene is a vector gradient: the sun has no bloom, the mountains have no atmospheric haze, the cross is thin and
  sits behind the greeting rather than standing on a lit rock. The reference reads as a photograph at dawn.
- The logo mark is the gate glyph; the reference uses a gold cross roundel beside the wordmark.
- "This Week" sits below Today's nutrition, so the first screen ends on nutrition rather than on the weekly bar.
- When the member's next session is on another day, the "Rest day today" badge pushes the title onto two lines.

Recommendations (presentation only):
1. Hero art v2 with real depth: three parallax layers (far ridge in haze, mid ridge, near rock with the cross on it), a
   radial sun bloom behind the cross, light rays with slight animation (respecting reduced motion), a touch of film grain.
   Time-of-day variants (dawn / day / dusk) chosen by the same clock as the greeting.
2. A gold cross roundel as the Home logo mark (we already use the cross icon on the Faith tab).
3. Order: workout → recovery/streak → This Week → nutrition.
4. Move the rest-day badge under the title so "Today's Workout" stays on one line.

### 2. Workout In Progress (page 2) — 8 · 9 · 8 · 7 · 9

What matches: exercise name large, set label, set rows with the active row in gold and ticks on done sets, circular gold
rest ring with pause, −30s / +30s pills, Exercise info / Substitute buttons; the real steppers and Complete set remain.

Less polished:
- Weights display with a decimal after unit conversion (92.5 kg → "203.9 lb"); the reference shows whole pounds.
- The header truncates the workout name ("Upper Stre…") beside three buttons, and the sync status is clipped to an icon.
- The ring's stroke is thinner and flatter than the reference's glowing ring; the Skip rest pill is tight against the
  card edge at 393 px.
- While resting, the ring is above the set rows (the reference keeps the set list first). Functional choice, but it moves
  the content the member was looking at.

Recommendations:
1. Round displayed pounds to the nearest 0.5 lb (display only; stored kg unchanged).
2. Header: title on its own line, the three controls on the next, or collapse Focus/Pause into one menu.
3. Thicker ring (6 px) with an outer glow and a soft track; "REST" label in champagne.
4. Keep the set list above the ring so the active row never jumps.

### 3. Exercise Demonstration (page 3) — 6 · 9 · 8 · 5 · 9

What matches: full-width visual with close and full-screen controls, title, Setup / Execution / Mistakes tabs, numbered
cues; playback, speed and scrub controls are live.

Less polished:
- The athlete is a small dark silhouette in a large dark frame; the reference fills the frame with a lit, photographed
  lifter. Equipment and body are legible but low-contrast against the charcoal floor grid.
- The "Animated 2D demonstration — an illustration, not filmed video" line is correct and should stay, but it is the
  second-largest text on the screen.
- The title sits under the visual rather than over it (done on purpose so it never covers the player controls).

Realism and accuracy: the 2D athlete is a stylised figure, not a realistic human. Its movement paths were reviewed
exercise by exercise in the earlier 2D phases (157 exercises, each marked animated / pose frames / placeholder in
`src/data/exercise-demo-readiness.json`); bar paths, joint limits and foot stability have unit tests. It is accurate as
a technique diagram and honest about what it is; it is not cinematic.

Recommendations:
1. Framing: scale the figure to fill about 80 % of the frame height per exercise (a camera setting in the motion data).
2. Lighting: a warm key light gradient from the upper left, a soft floor shadow under the athlete, a gold rim light on
   the working muscles instead of the flat glow.
3. Move the caption to a small "2D illustration" chip in the corner and keep the long sentence for the info sheet.
4. For the 20 most-performed exercises, licensed or self-filmed video would close the remaining gap; that needs budget
   and assets, not code.

### 4. Workout Complete (page 4) — 8 · 9 · 8 · 8 · 9

What matches: gold check medallion, "Workout Complete!" in gold, workout name, four stat tiles with gold icons,
personal-record card when there is one, verse, Next Workout and View Summary.

Less polished:
- The closing verse is the full passage (five lines); the reference shows one line and a reference, so Next Workout
  drops below the fold on an 852 px screen.
- No PR card in the capture because the demo session set none; on a real PR the gold card appears above the verse.
- The stat tiles are good; the "Exercises 1/6 · New PRs 0" line beneath them is small and easy to miss.

Recommendations:
1. Show the verse's first sentence with a "Read the whole verse" expander.
2. Lift the Next Workout button directly under the stats when there is no PR card.

### 5. AI Coach (page 5) — 7 · 8 · 7 · 7 · 8

What matches: coach bubble with gold avatar and "Today at …", suggestion pills, rounded "Ask your coach…" input with a
round gold send.

Less polished:
- Above the chat sit the Ask / Plan tabs, the monthly allowance and (in demo) the yellow simulation notice: three bands
  before the first message. The reference opens on the message.
- Suggestion pills are full questions over two lines; the reference uses three short verb phrases with icons.
- The memory checkbox under the composer reads as clutter.
- The avatar is a generic robot glyph; the reference uses a brand mark.

Recommendations:
1. Collapse Ask / Plan and the allowance into one slim row; keep the demo notice (owner rule) but let it dismiss.
2. Shorter starter pills with an icon each ("Adjust my program", "Help with recovery", "Nutrition for today").
3. Move the memory toggle into the ⋯ menu; use the gold cross roundel as the avatar.

### 6. Nutrition (page 6) — 8 · 9 · 7 · 6 · 9

What matches: title, "‹ Today ›", calorie ring "n of goal cal", Protein (blue) / Carbs (gold) / Fat (purple) bars,
three quick-add tiles, meal cards with icons and kcal/protein lines.

Less polished:
- The "Recent foods" one-tap list sits between the tiles and the ring on the demo account, so the ring is below the
  fold. The reference leads with the ring.
- Meal rows use category icons; the reference uses food thumbnails.
- "1397 kcal remaining" lacks a thousands separator while the ring shows "1,203".

Recommendations:
1. Default order ring → tiles → meals; show Recent foods collapsed under the meals (one tap to expand).
2. Thumbnails: the app has no food photos, but a small illustrated set per meal (plate, bowl, cup) or the first logged
   item's category icon in gold would be closer than a generic icon.
3. Format every kcal number the same way.

### 7. Training Programs (page 7) — 5 · 8 · 6 · 6 · 8

What matches: gold category pills, gold-edged image-led cards with name, blurb and "n days/week • n weeks".

Less polished:
- The first screen is Build my program, My programs, search and Filters; the first card appears only after scrolling.
  The reference opens on three cards.
- Card art is the same three vector scenes rotated across 51 cards, so cards look alike; the reference gives each
  program its own photograph.
- The pill row scrolls off screen with eight real categories.

Recommendations:
1. First screen: pills, then three featured cards; move search and filters behind one icon button and My programs into
   a compact horizontal strip.
2. A category art set (one original illustration per category: barbell for strength, runner for endurance, kettlebell
   for conditioning, and so on) so cards differ by what they are.
3. Larger card title, blurb limited to two lines, equipment line folded into the detail page.

### 8. Progress (page 8) — 7 · 8 · 8 · 7 · 8

What matches: period pills, gold strength-trend card with the lift name, current estimated 1RM and the change over the
period, line chart, body-metric rows with ▲▼ deltas.

Less polished:
- The chart repeats its own title inside the gold card ("Squat · estimated 1RM / 30 days") under the card's header.
- The y-axis labels are clipped at the left edge ("352 lb" loses its first digit).
- With three data points the line looks sparse; the reference has an area fill and eight points.
- The "Badges" button stands alone under the description.

Recommendations:
1. Hide the inner chart title when the card already names the lift.
2. Add a 6 px gutter for the axis and an area fill under the line.
3. Put Badges in the header row.

### 9. Faith (page 9) — 6 · 9 · 6 · 5 · 9

What matches: Bible / Prayer / Plans pills, scenic verse card with the gold Read chapter button, devotional card.

Less polished:
- The scenic verse card is the third block down; the first screen is the pills, three quick-action tiles and the
  daily journey card. The reference opens on the picture.
- The pills have no active state because they are links to other sections.
- The cross-at-dusk art is flat and darker than the reference's sunrise.

Recommendations:
1. Open with the verse scene as a hero (as on Home), with the Read chapter button in it; compact the journey card to one
   row with its progress bar; keep the quick actions under the hero.
2. Mark the pill of the current section as active.
3. Reuse the Home hero art v2 (dawn variant) here for a consistent cinematic language.

### 10. Narrow Gate Pro (page 10) — 7 · 9 · 7 · 7 · 8

What matches: crown, "Narrow Gate Pro", benefits card, Monthly / Annual cards with "Save 37%", gold upgrade button
(the existing purchase flow), prices $19.99 and $149.99.

Less polished:
- Before the crown there are the page header, the demo notice, and the current-membership card; the reference opens on
  the crown. (The demo notice is demo-only and must stay.)
- The crown is a flat line icon in a disc; the reference's crown is a gold illustration.
- Benefits have no sub-captions; the reference pairs each with a one-line explanation.

Recommendations:
1. Open on the crown block; show the current-membership card as a slim line under it.
2. A gold crown illustration (gradient fill, small highlights) in place of the line icon.
3. Add the four sub-captions ("Strength, hypertrophy, powerlifting and more", …) to the benefits card.

## Prioritised plan (presentation only, no behaviour changes)

Priority 1, small and safe (about a day in total):
- Pounds rounding on the workout card; workout header layout; ring stroke and glow.
- Progress chart: remove the inner title, fix the axis gutter, add the area fill.
- Faith: verse scene first; Nutrition: ring first, Recent foods collapsed; Programs: three featured cards first.
- Workout Complete: one-line verse with expander; Pro: crown first, sub-captions.
- Coach: shorter starter pills with icons; memory toggle into the menu.

Priority 2, art and depth (two to three days):
- Hero art v2 (layered parallax, sun bloom, haze, grain, dawn / day / dusk) used on Home and Faith.
- Category art set for program cards; gold crown illustration; cross roundel logo mark and coach avatar.
- Demonstration framing and lighting (camera scale per exercise, key light, floor shadow, rim light).

Priority 3, needs assets or budget:
- Licensed or self-filmed video for the most-performed exercises; food thumbnails.

Everything above keeps the current components, data, security and subscription logic; only classes, order of sections,
and artwork change.
