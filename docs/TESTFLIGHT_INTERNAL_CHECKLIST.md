# Internal TestFlight checklist

For the first internal TestFlight build, on physical iPhones. Tick each line only after doing it on a device; write
the result, iOS version and phone model in `docs/device-testing/device-test-results.csv`. Step-by-step detail for many
lines is in `docs/device-testing/DEVICE_TEST_SCRIPT.md`; this page is the list to get through.

**Before the build (owner):** follow `docs/TESTFLIGHT_STEPS.md`. In short: the staging deployment is up and approved
(the iPhone app loads it); App Store Connect app record, bundle ID, signing secrets and the TestFlight internal group
exist; a RevenueCat **sandbox** setup with the two products; Sandbox Apple IDs for testers; each tester's app account is
on the sandbox tester list (**Admin → Subscriptions → Sandbox testers**, the `sandbox_testers` table) unless
`REVENUECAT_ALLOW_SANDBOX=true` is set on staging. Use only test accounts, never a real member's.

Phones: at least one small (iPhone SE / 13 mini) and one large (Pro Max), on the current iOS and one version older.

## 1. Install, opening and account security

- [ ] Install from TestFlight; the first launch plays the opening once; Skip and Enter work; later launches behave as designed.
- [ ] Sign up with a new email; the confirmation email arrives; the link opens in Safari (the app has no link handling yet), confirms the account, and signing in inside the app lands on onboarding.
- [ ] Age confirmation and terms acceptance are required to sign up.
- [ ] Sign out; sign in; wrong password shows a clear error; repeated wrong passwords are rate-limited.
- [ ] Password reset email arrives and works once; an old link is refused.
- [ ] Session survives closing and reopening the app; signing out on one phone does not leak data on the next account signed in there.
- [ ] Profile → Export my data produces the file; Delete account removes the account and signs out (use a throwaway account).
- [ ] No screen shows another member's data (two test accounts on two phones).

## 2. Purchases (sandbox only)

- [ ] Profile → Plans & billing shows Free vs Pro and the two prices exactly as configured ($17.99/month, $119.99/year).
- [ ] Buy monthly with a Sandbox Apple ID: Apple's sheet appears (no web checkout inside the iPhone app); Pro unlocks after purchase.
- [ ] Pro stays unlocked after closing/reopening the app and after signing in on a second phone.
- [ ] Restore Purchases on a fresh install restores Pro.
- [ ] Cancel in the sandbox subscription settings; after expiry (sandbox renews fast), Pro features lock again.
- [ ] Yearly purchase works the same way.
- [ ] A Free account cannot reach Pro screens by URL (try a Pro link directly).
- [ ] Manage subscription opens Apple's page.

## 3. Workouts

- [ ] Start today's program workout; the current-set card shows the exercise, its demonstration (or labelled pose frames / placeholder), last time, and pre-filled numbers.
- [ ] Complete a set with one tap; the rest timer starts; +15 s / −15 s / Skip work; at the end the phone beeps or vibrates (per Profile setting).
- [ ] Lock the phone during a rest: the rest-over notification arrives.
- [ ] "Form cues & common mistakes" opens and shows the exercise's cues; "Swap for another exercise" offers alternatives and keeps logged sets.
- [ ] Same as last set, Skip set, Undo, Skip exercise all behave as labelled.
- [ ] Put the app in the background mid-workout, kill it, reopen: the workout resumes at the same set.
- [ ] Airplane mode mid-workout: logging continues ("Saved on device"); turning it off syncs.
- [ ] Finish: summary shows sets, volume, records; History shows the workout once.
- [ ] Exercise library: demos play smoothly; the enlarged demo opens; nothing says "3D".

## 4. GPS (outdoors) — see `docs/GPS_BACKGROUND_IPHONE.md`

- [ ] Run/walk permission prompt explains why; "Allow While Using App" is enough to record.
- [ ] 1 km measured route: distance within ~3%, pace sensible, route map matches.
- [ ] Lock the phone for 5 and 20 minutes while walking: no straight-line jump; distance still right; blue location pill shown while locked.
- [ ] Leave the recorder for another tab and come back via the "Recording" pill.
- [ ] Force-quit mid-recording: the unfinished recording is offered back; location stops.
- [ ] Save, view, delete a run; a deleted route is gone after reopening.

## 5. Nutrition

- [ ] Log a food by search, by barcode (camera), and by grams/oz; totals update.
- [ ] Food photo (AI): estimate shows items to review; nothing is saved until confirmed.
- [ ] Ingredient label check: additives and allergens explained.
- [ ] Recipes, meal planner, grocery list open and save.
- [ ] Daily targets and insights match the logged food.

## 6. Apple Health

- [ ] Connect: the Health permission sheet lists only what the app reads/writes, with the app's explanations.
- [ ] Steps and sleep import; "last synced" updates; pull-to-refresh syncs.
- [ ] Deny Health access: the app explains and keeps working.
- [ ] Disconnect stops syncing; previously imported data handling matches the privacy policy.

## 7. AI coaching (needs an Anthropic API key on the staging deployment, with your spend approval; `docs/LIVE_AI_TEST_PLAN.md`)

- [ ] Ask a training question: an answer arrives, with the AI disclosure visible.
- [ ] Ask about pain/injury: the reply advises professional care and does not diagnose.
- [ ] Ask a faith question: answer is respectful and scripture references are correct (BSB).
- [ ] Prayer journal text is never quoted back by the coach (private content stays out of AI context).
- [ ] Free plan hits its monthly AI allowance and sees a clear limit message; Pro has the higher allowance.
- [ ] Airplane mode: the coach says it is offline; nothing is lost.

## 8. Faith (free for everyone)

- [ ] Bible reader opens offline; red letters on/off; highlights, bookmarks, notes save.
- [ ] Reading journey day check-in; the 40-day challenge progress is intact for an existing test account.
- [ ] Reminders arrive at the chosen times; turning one off stops it.

## 9. General

- [ ] Every tab at the largest text size (Settings → Display → Text Size) is readable; nothing is cut off.
- [ ] VoiceOver reads the main buttons sensibly on Home, workout card and Run.
- [ ] No crash in a 30-minute session across all tabs (check TestFlight crash reports).
- [ ] Battery: a 45-minute workout + 30-minute walk uses a reasonable share of battery (note the %).
