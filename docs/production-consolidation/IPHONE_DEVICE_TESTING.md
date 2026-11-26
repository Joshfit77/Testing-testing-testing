# iPhone device testing

**Status: not started.** Nothing in this app has been tested on a physical iPhone. Automated evidence so far:

- GitHub iOS checks (compile, archive contents, Simulator launch, WebKit tests);
- browser tests at phone sizes.

Mark a test passed **only** after doing it on a real device. Use a TestFlight build from this branch (see
`docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md`). Ideally use two iPhones: one older (iOS 16/17, small screen) and one current.

**Record for each test:**

- date;
- device and iOS version;
- build number;
- pass / fail;
- a screenshot or screen recording on failure.

| # | Test | Exact steps | Expected result |
|---|---|---|---|
| 1 | Install and first launch | Install from TestFlight; open | Opening screen, then Welcome; no crash; no white screen over 5 s |
| 2 | Offline cold start | Airplane mode on; force-quit; open | "You're offline" page within a few seconds; "Read the Bible" opens a book; "Try again" works when back online |
| 3 | Sign-up and email link | Sign up; open the confirmation email on the phone | The email opens the site (in Safari until universal links exist, O-05); sign in back in the app succeeds |
| 4 | Password reset | Profile → sign out → "Forgot password" → email link → new password | Can sign in with the new password |
| 5 | Onboarding | Complete all questions | The plan summary appears; units are correct |
| 6 | Onboarding offline | At the last step, airplane mode on, tap "Build my plan" | A message about being offline; answers kept; works when back online (fix B-15) |
| 7 | Workout logging | Start today's workout; log 3 sets with weights and reps | Sets saved; the rest timer starts |
| 8 | Rest timer, locked | Start a 90 s rest; lock the phone | One notification with sound at about 90 s. Skip a rest and confirm no notification. Pause during rest and confirm no notification |
| 9 | First notification prompt | On a fresh install, start the first rest | iOS asks for notifications; deny it and the in-app timer still works |
| 10 | Workout survives backgrounding | Mid-workout, open about 10 other apps; return | Page may reload; the draft is restored with all sets |
| 11 | Network loss mid-workout | Log 2 sets, airplane mode, log 2 more, force-quit, relaunch online | All 4 sets present after sync |
| 12 | Finish workout | Finish | Summary and personal records shown; history shows it once |
| 13 | Exercise animations | Open 10 exercises from different categories | Animations play smoothly; no clipping; form cues readable |
| 14 | GPS run, screen locked (30 min) | Start a run outdoors; lock; walk or run 2 km; unlock; finish | Continuous route and distance within about 5% of a known route; blue location indicator while recording, gone after Finish |
| 15 | GPS run, app ended by iOS | Start a run, lock, 10 min; then end the app from the app switcher; relaunch and open Run | The unfinished run is offered; the route up to the moment the app was ended is there (the native journal writes every fix to the device). Note: after a force-quit iOS stops all location updates, so **nothing after that moment** can be recorded; that is a platform limit, not a defect |
| 15a | Run journal survives a web-content reset | During a locked run, open 10–15 heavy apps (forces iOS to drop the web content), wait 5 min, return | Page may reload; the run continues and the 5 minutes are in the route (native recorder keeps running; journal merged on recovery) |
| 15b | Notification tap during a run | During a run, tap a workout reminder or the alarm's "I'm up" | The app opens the target screen without a full reload; the run keeps recording (in-app navigation) |
| 15c | Location permission | Fresh install; start the first run; choose "Allow While Using"; then later "Allow Once" | Recording works while using; with "Allow Once" the app explains when it stops. Note which prompt iOS shows: the community GPS plugin asks for "Always" on iOS, which we can't change from our code |
| 16 | Guided interval cues | Start a guided run; lock | A vibration (and voice if on) at each phase change. Locked-screen cues may not work (O-04) |
| 17 | HealthKit steps | Steps → Connect Apple Health | One permission sheet listing **read** Steps only; steps appear |
| 18 | HealthKit sleep | Sleep → connect | A sheet listing Sleep, Heart Rate, HRV and Respiratory Rate, **read only**; nights appear; denying everything is handled calmly |
| 19 | Barcode scanner | Nutrition → scan a packaged food | Camera permission asked; the product is found and logged with the right amount |
| 20 | Barcode, camera denied | Deny the camera | A message pointing to Settings; no crash |
| 21 | Meal photo (only if AI is on) | Photograph a meal | An estimate to confirm; never logged without confirming |
| 22 | Progress photo | Progress → add a photo with the camera | Saved privately; shown in compare. Then airplane mode on just after tapping Save: "couldn't confirm" message, Save again online saves it once (no duplicate, image intact) |
| 23 | Body Scan (Pro) | Run a guided scan with the timer | A countdown vibration; photos saved; measurements recorded |
| 24 | Reminders | Turn on Faith and workout reminders; change the time zone ±8 h; reopen | Rescheduled to local times; none inside quiet hours |
| 25 | Sleep "alarm" | Set an alarm 2 minutes ahead with Silent on and Sleep Focus on | Note whether it is audible (O-04); test Snooze from the lock screen with the app closed |
| 25a | Alarm follow-up and snooze share one slot | Set an alarm 2 minutes ahead; don't answer; wait the snooze time | One follow-up ring; tap Snooze on it: exactly one ring after the snooze time (not two); tap "I'm up": no further ring that morning, and tomorrow's alarm still scheduled |
| 26 | Sign-out cleanup | With reminders and a running rest timer, sign out | No notifications arrive afterwards |
| 26a | Sign-out removes recorded routes | Start a run, end the app (test 15), relaunch, sign out without reopening the run; sign in as another member | The other member is not offered the first member's run; the blue location indicator is gone |
| 27 | Bible offline | Open a chapter, airplane mode, open another | The bundled Bible reads offline |
| 28 | Prayer journal | Write an entry; force-quit mid-typing; reopen | The draft is kept; the saved entry is private |
| 29 | Purchase (sandbox) | Settings → App Store → sandbox account; Profile → Plans → buy monthly | Pro within about 10 s; the price shown is Apple's ($17.99 in the US) |
| 30 | Restore | Delete the app, reinstall, sign in, tap Restore purchases | Pro restored |
| 31 | No web checkout in the app | Look at every plan and billing screen | No Stripe or website payment buttons or links anywhere |
| 32 | Account deletion | Profile → delete account | Deleted; told that the App Store subscription must be cancelled in Settings |
| 33 | Keyboard | Type weights at the bottom of the logger and in coach chat (iPhone SE) | The field stays visible above the keyboard |
| 34 | Safe areas | iPhone with Dynamic Island; iPad if supported (portrait and landscape) | Nothing under the notch, home indicator or status bar |
| 35 | Notification tap, app closed | Tap a reminder notification | Opens the right screen, not Home |
| 36 | Long background | Leave the app 24 h, return, log a set | Works, or a clear sign-in prompt with the draft kept |
