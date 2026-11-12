# Narrow Gate Fitness — consolidated product specification

Provided by the owner (2026-10-20). This is the source of truth for scope. Visual reference: `docs/design/reference-five-screens.png` (five screens: Home, Train, Run, Food, Faith). Numbers and routes in the reference are illustrative. The owner mentioned a body-rank image as conceptual inspiration for the body map; it was not attached, so the body map design is original.

Progress against every requirement is tracked in `docs/PROJECT_CHECKLIST.md` (statuses: Working, Partial, Missing, Requires External Setup, Requires Content Review).

---

Update my existing Narrow Gate Fitness project into a complete Christian fitness app using the attached images and the requirements below. This is the consolidated specification for everything we've discussed.

Inspect the existing code first. Reuse working features, preserve saved user data, and integrate additions into the current project. Implement the changes rather than only describing a plan.

## 1. Visual design

Use the attached five-screen app mockup as the primary visual reference. Match its compact layout, imagery, cards, spacing, and polished fitness-app feel.

* Black backgrounds, charcoal cards, white text.
* Metallic gold accents with bronze shadows and champagne highlights—not bright yellow.
* Normal mobile sizing, approximately 16px body text, 14px secondary text, and 24–28px headings.
* Comfortable controls around 44–48px tall.
* Readable, balanced screens for an audience roughly ages 18–60.
* Support system text scaling and screen readers without making the default interface oversized.
* Keep text-size preferences in Settings.
* Use consistent icons, typography, corner radii, spacing, and button styles.

Use real user data for all dashboard values. Treat numbers and routes in the reference image as illustrative examples.

## 2. Navigation

Keep exactly five main bottom tabs:

Home · Train · Run · Food · Faith

Make each tab's icon and label visible. Keep their order and position consistent.

Place a compact gold-outlined "AI Coach" button with a chat icon beside the heading at the top right of every main screen. Keep it separate from the profile icon. It must be clearly labeled, not an unlabeled symbol or oversized banner.

Profile and Settings open through the profile icon.

Group secondary features as follows:

* Home → My Progress → Overview, Body Map & Ranks, Badges, History.
* Train → Current Workout, Programs, Exercises, Custom Workouts, Workout History.
* Run → Run/Walk Tracker, Plans, Goals, History.
* Food → Diary, Saved Meals, Recipes, Meal Planner, Grocery List, Nutrition Insights.
* Faith → Devotionals, Scripture, Prayer Journal, Daily Practices, 40-Day Challenge.

Avoid duplicate screens for the same data. Links from different places should open the same underlying feature.

## 3. Home

Follow the reference design:

* Personal greeting.
* Scripture image card.
* Today's workout with Start or Resume.
* Nutrition summary.
* Weekly activity summary.
* Prominent My Progress button.
* Access to the training calendar.
* Compact AI Coach button.

Keep the overview focused. Show more detail after tapping a card.

The calendar should combine workouts, runs, walks, and rest days. Let users reschedule sessions without losing completed history.

## 4. Onboarding and personalization

Preserve and improve setup for:

* Primary and secondary goals.
* Training experience.
* Age and relevant body measurements.
* Available equipment.
* Days available and session duration.
* Dietary preferences and nutrition goals.
* Units and optional accessibility preferences.

Allow users to edit these later and preview how changes affect their plan.

Correct the existing mismatch where selecting a 60-minute workout produces a plan labeled approximately 75 minutes. Account for sets, rest, warm-ups, and transitions when estimating duration.

Support combined goals such as building strength while training for a 5K. Coordinate the schedule instead of independently stacking full programs.

## 5. Train: programs

Preserve all existing programs and organize them into searchable categories:

* Beginner and general fitness.
* Strength and powerlifting.
* Bench, squat, and deadlift specialization.
* Bodybuilding and muscle building.
* Strongman.
* MMA, boxing, wrestling, and grappling conditioning.
* Functional fitness, circuits, and intervals.
* Athletic speed, agility, and explosive power.
* Endurance and hybrid training.
* Home, dumbbell, band, and bodyweight training.
* Calisthenics.
* Active aging, seated, and low-impact training.
* Mobility, flexibility, warm-ups, cooldowns, and recovery.

Each program should explain:

* Its goal and intended experience level.
* Equipment needed.
* Duration in weeks.
* Sessions per week and approximate session length.
* Exercises, sets, reps, rest, and progression.
* Substitutions and lighter-week guidance.
* Completion requirements.

Include filters for goal, experience, equipment, schedule, and session length.

Do not fill the catalog with near-identical plans bearing different names. Flag specialist programming that requires qualified review before publication.

## 6. Workout player and exercise library

The workout player should support:

* Sets, reps, weight, duration, and distance where applicable.
* Previous performance beside the current exercise.
* Rest timers with optional sound or vibration.
* Supersets.
* Exercise substitutions.
* Adding, removing, and reordering exercises.
* Notes and perceived difficulty.
* Pause, resume, finish, and discard.
* Session summary and personal records.
* Custom workout creation and saved templates.

Save completed sets as the session progresses. Support offline logging and later synchronization where feasible.

The exercise library needs:

* Search by name.
* Muscle group, equipment, and difficulty filters.
* Clear instructions and common mistakes.
* Specific reviewed demonstration videos or animations.
* Equipment alternatives.
* Links to relevant performance history.

Replace broad YouTube searches with specific demonstrations where available. Do not invent video assets or label unreviewed instruction as expert-reviewed.

## 7. Running and walking

Make Run a dedicated bottom tab.

Include:

* Outdoor Run and Outdoor Walk.
* Treadmill/manual entry.
* Miles and kilometers.
* Distance or time goals.
* Run/walk intervals.
* Beginner, 5K, and 10K plans.
* History and weekly mileage.

Live tracking must show:

* Distance.
* Elapsed time.
* Moving time.
* Current pace.
* Average moving pace.
* GPS route.
* Mile/kilometer splits.
* Start, Pause, Resume, and Finish.

Request location when starting an outdoor session. Wait for a usable GPS signal, filter inaccurate readings, smooth current pace, and visibly handle lost signals. Do not invent movement.

Exclude paused time from moving pace. Avoid drawing false route segments across pauses or GPS outages.

Offer optional audio split announcements.

Inspect the platform before implementing background tracking. If native background location is supported, implement and test locked-screen tracking. If this is a browser preview, identify its limitations and the native work needed; do not claim reliable background tracking without verification.

Save summaries, routes, splits, notes, and records. Allow deletion. Keep routes private by default and stop location tracking when the session ends.

Manual activities must not display fabricated GPS routes.

## 8. Food and nutrition

Preserve the existing diary and improve it into a complete nutrition section.

Include:

* Calorie and macro targets.
* Daily meals and snacks.
* Food search with source information.
* Barcode scanning.
* Manual food creation.
* Favorites and recent foods.
* Saved meals.
* Copying a meal or entire day.
* Editing portions and moving entries between meals.
* Grams, ounces, and food-specific serving units.
* Water tracking.
* Weekly nutrition summaries.

Barcode scanning must use real product lookup. Handle missing products and denied camera access with manual-entry options.

Build a recipe tool:

* Add ingredients and amounts.
* Set recipe servings.
* Calculate total and per-serving nutrition.
* Log full or partial servings.
* Preserve historical diary values when a saved recipe changes.

Build a meal planner:

* Use existing nutrition targets, dietary preferences, allergy exclusions, budget, and meal frequency.
* Let users swap meals and adjust portions.
* Generate a grocery list and combine compatible ingredients.
* Label cost estimates.
* Keep planned meals separate from meals actually eaten.

Add restaurant search where reliable data is available. Distinguish published values from estimates.

Suggest food swaps with comparable portions and clear nutritional differences.

Photo-assisted logging may suggest foods and portions, but users must confirm before saving. Ask about uncertain oils, sauces, and ingredients. Do not present photo estimates as exact.

Weekly summaries must distinguish missing or incomplete logs from zero intake. Missing nutrient data must not silently become zero.

Include supplement logging and sourced educational information. Avoid unsupported cleansing or detox claims.

Use one consistent nutrition calculation system. Prevent duplicate exercise imports and avoid counting the same activity twice when adjusting calorie budgets.

## 9. My Progress

Provide a prominent Home → My Progress entry.

Include:

* Overview.
* Strength & Body Map.
* Badges.
* History.

Overview should show actual logged information:

* Weight trends and measurements.
* Optional progress photos.
* Completed workouts.
* Running and walking distance.
* Personal records.
* Weekly consistency.
* Recent badges.
* Current assessed strength rank.

Show useful empty states when there is no data.

## 10. Interactive body map and strength ranks

This is a required feature. Use the attached body-rank image as conceptual inspiration.

Create original front-and-back muscle diagrams with tappable regions:

* Chest.
* Back.
* Shoulders.
* Arms.
* Core.
* Legs, with useful subdivisions where practical.

Color muscle groups according to rank. Include a written legend and labels so the interface does not depend only on color.

Tapping a region shows:

* Current rank.
* Relevant exercises.
* Personal records.
* Performance history.
* Progress toward the next rank.
* How the score is calculated.

Use this exact rank order:

Bronze → Silver → Gold → Platinum → Diamond → Disciple

Disciple replaces Titan as the highest fitness rank.

Use transparent, configurable, exercise-specific scoring. Account for bodyweight where appropriate. Do not treat all machines or movements as interchangeable, infer strength from photos, or present arbitrary thresholds as validated standards.

Label estimated one-rep maxes and provisional scoring rules. Show "Not assessed" when data is insufficient.

Explain how an overall rank is calculated and disclose missing assessments. Use a representative scoring method so repeated logs of similar exercises do not artificially inflate a muscle group's rank.

## 11. Badges and achievements

Build a complete badge collection with:

* Earned and In Progress filters.
* Original artwork.
* Names and descriptions.
* Exact requirements.
* Progress toward unlocking.
* Earned dates.
* Tappable detail screens.

Keep performance ranks separate from milestone badges.

Initial achievement badges:

* First Step: first completed workout.
* Building Momentum: 10 workouts.
* Consistent Effort: 25 workouts.
* Committed: 50 workouts.
* Century Club: 100 workouts.
* First Recorded Best: first supported lift record.
* Raising the Bar: improvement over an earlier lift record.
* Program Finisher: all required program sessions completed.
* First Mile: a single run of at least one mile.
* First 5K: a single run of at least five kilometers.
* First 10K: a single run of at least ten kilometers.
* Going the Distance: 100 accumulated running miles.
* Walking Strong: 25 accumulated walking miles.
* Faster Than Before: improved eligible time over the same supported distance.

Distinguish running from walking and GPS activities from manual entries where relevant. Self-reported records must not be presented as independently verified.

Design increasingly detailed original rank emblems. Disciple gets an ornate metallic-gold narrow-gate emblem.

Use stable activity IDs to prevent duplicate awards. Define and implement consistent recalculation after edited or deleted records.

Add short, dismissible celebrations with reduced-motion and disable options. Never cover active exercise or running controls.

Offer optional badge sharing with only user-approved details.

## 12. Faith

Faith must be central to the product, with a dedicated bottom tab and a Home Scripture card.

Include:

* Daily Scripture with context.
* Devotionals.
* Prayer journal.
* Daily practices.
* The "40 Days Through the Narrow Gate" challenge.
* Catch-up support and recognition of rest.
* Optional reminders controlled by the user.

Use properly licensed or public-domain Bible text and identify the translation.

Provide a content-review workflow for devotionals. Do not label generated content as pastor-reviewed unless it has actually been reviewed.

Keep journals private by default. Spiritual maturity must not be scored through fitness ranks, prayer counts, or leaderboards.

## 13. AI Coach

The AI Coach must be clearly visible through the compact header button on every main tab.

Open a dedicated conversation screen with a clear way to return to the previous screen.

With user permission, connect it to:

* Goals and preferences.
* Current program.
* Workout history.
* Running history.
* Food logs.
* Progress trends.
* Recovery check-ins.

It should help explain progress, suggest substitutions, propose meals, coordinate schedules, and conduct weekly reviews.

Show proposed changes and require approval before modifying plans or targets. Identify missing information rather than inventing it.

Fix the existing "Too many requests" failure behavior. Handle loading, rate limits, service failures, retrying, and preserving unsent messages. Keep API secrets server-side.

Do not present the coach as a clinician or pastor. Do not expose private journal entries to it by default.

## 14. Recovery, education, and accountability

Add optional check-ins for sleep, energy, and soreness. Treat these as self-reported information, not a diagnosis.

Include an educational library covering:

* Exercise technique.
* Training principles.
* Nutrition.
* Recovery.
* Biblical stewardship.

Show sources and actual reviewer attribution.

Add private accountability groups for friends or churches, with invitations, explicit sharing choices, and reporting/blocking tools. Keep food logs, measurements, photos, routes, and journals private unless deliberately shared.

Implement supported wearable integrations with permission controls and deduplication. Identify any unavailable APIs, approval requirements, or credentials rather than pretending an integration works.

## 15. Smooth navigation and dependable data

Fix the jumping-around feeling:

* Preserve scroll position and filters.
* Preserve drafts and active sessions across tab changes.
* Use predictable Back behavior.
* Prevent keyboard overlap and unexpected layout shifts.
* Keep a compact Return to Workout or Return to Run bar during active sessions.
* Avoid unnecessary redirects and repeated confirmations.
* Confirm destructive actions.

Implement account access, saving, recovery, and synchronization appropriate to the platform. Clearly document what is local versus synced.

Provide data export and deletion controls. Protect private records and keep secrets out of client-side code.

## 16. Implementation process and completion criteria

Maintain a persistent project checklist containing every requirement above. Mark each as:

* Working.
* Partial.
* Missing.
* Requires External Setup.
* Requires Content Review.

Work in manageable stages:

1. Reliable storage, accounts, navigation, and core logging.
2. Complete training, nutrition, and faith flows.
3. Running, progress, body map, ranks, and badges.
4. Connected coaching, wearables, accountability, and expanded content.

Do not silently remove requirements because they are absent from the main-screen mockup. Continue implementing within the available environment, documenting exact blockers where necessary.

Test complete journeys:

* Finish a workout and reopen its saved history.
* Switch tabs during an active session without losing it.
* Add, edit, copy, and delete food with correct totals.
* Build and log a recipe serving.
* Record, pause, resume, finish, and reopen a run.
* Update a record and award the correct badge only once.
* Edit/delete an activity and recalculate appropriately.
* Open a muscle region and inspect its rank explanation.
* Save and recover a journal draft.
* Use the AI Coach and handle a service failure gracefully.
* Reopen the app and confirm saved data remains available.

Verify layouts on small and large phone screens. Fix clipped content, unreadable text, broken controls, inaccurate calculations, and navigation regressions.

At the end of each stage, report what was implemented, what was verified, and what remains. Do not describe placeholders, unconnected integrations, or unreviewed content as finished production features.
