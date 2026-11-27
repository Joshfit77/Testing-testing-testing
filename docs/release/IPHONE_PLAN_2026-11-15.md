# Physical iPhone verification plan — private TestFlight candidate (2026-11-15)

Nothing in this file has been run. Every case is **NOT TESTED** until a person runs it on a physical iPhone and records
the result. The detailed step-by-step cases are in [IPHONE_TEST_SCRIPT.md](IPHONE_TEST_SCRIPT.md); this page maps the
fifteen areas to those cases and adds the cases that script does not have.

Devices: one current iPhone and one older supported model (for example an iPhone SE 2nd generation or iPhone 11), each
on the TestFlight build, signed in to a sandbox Apple Account.

| # | Area | Cases | Pass means |
|---|---|---|---|
| 1 | First-time onboarding | NEW-01 below | Sign-up to plan in five questions, no dead end, plan matches the answers |
| 2 | First workout | NEW-02 below | "Start today's workout" → every set completes with one tap (timed sets included) → summary |
| 3 | Rest timer while locked | NEW-03 below | A rest alert arrives with the phone locked; the timer is right on unlock |
| 4 | Background workout persistence | NEW-04 below; script section 4 | Kill the app mid-workout, reopen: every logged set is still there |
| 5 | Outdoor GPS | script section 3 (IP-GPS-01 to 09 and following) | Distance within the script's tolerance; no invented distance after a locked stretch |
| 6 | Apple Health import | script section 5 | Steps and sleep import; refusing and revoking are handled |
| 7 | Barcode camera | script sections 1 and 2 | Permission prompts, real products scan, unknown products invent nothing |
| 8 | Meal and progress photos | NEW-05 below | Camera and library both work; a refused permission explains what to do |
| 9 | Faith notifications | script section 6; NEW-06 below | Reading, prayer and before-midnight reminders arrive at the set local time |
| 10 | Real AI staging requests | NEW-07 below | Real replies on staging under a spend cap; cost and latency recorded |
| 11 | Sandbox purchases | script section 8 | Monthly ($17.99) and yearly ($119.99) buy in the sandbox and unlock Pro |
| 12 | Subscription restoration | script section 8 | Restore on a second device and after reinstall |
| 13 | Offline behaviour | script section 10; NEW-08 below | Log offline, reconnect, nothing lost or doubled |
| 14 | Accessibility | script section 12 | VoiceOver reads the main flows; largest text size does not clip |
| 15 | Older iPhone performance | script section 9 | The script's timings on the older device |

## Added cases

**NEW-01 · Onboarding.** Fresh install, new account with a real mailbox. Confirm by the emailed link (it must open the
app). Answer the five questions. Expect: the plan screen with "Start today's workout" at the top. Record the time from
first launch to the plan.

**NEW-02 · First workout, including a timed exercise.** Start today's workout. Complete each set with one tap. Then
start a session from the Pro program "Full-Body Mobility": each set must open with its seconds already
filled and complete with one tap. Finish. Expect: the summary shows the right sets; History shows the timed sets as
times, not "× 0".

**NEW-03 · Rest timer, phone locked.** Complete a set, lock the phone, wait for the rest to end. Expect: one alert at
the end of the rest. Unlock: the timer shows the true elapsed time. Repeat with the app in the background.

**NEW-04 · App killed mid-workout.** Log three sets, swipe the app away, reopen. Expect: "Resume workout" with all three
sets. Then discard the workout, reopen twice: it must not come back.

**NEW-05 · Meal and progress photos.** Take a meal photo (Pro) and a progress photo; then pick each from the library.
Refuse the camera once. Expect: a clear message and a way to Settings; nothing saved without a confirmation.

**NEW-06 · Faith reminders across time zones.** Set reading and prayer reminders. Change the phone's time zone to one
five hours behind. Expect: reminders at the new local times; a strict journey's day does not end early.

**NEW-07 · Live AI on staging.** Needs a staging API key with a spend cap, approved by the owner. Run the 30 scenarios described in
`docs/LIVE_AI_TEST_PLAN.md` (`scripts/ai-eval/run.ts`), and send at least five real coach messages from the phone. Record: reply quality against its checklist, seconds to first word, failures, and the
provider's billed cost. Until this runs, AI answer quality is NOT TESTED.

**NEW-08 · Home after midnight and offline.** Open Home, turn on Airplane Mode, leave the app past midnight, reopen.
Expect: the next day's picture and no error.
