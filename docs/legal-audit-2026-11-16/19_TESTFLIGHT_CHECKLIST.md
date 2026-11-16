# 19. Private TestFlight checklist, separate from public and paid launch

Date: 2026-11-16. A private TestFlight is a closed test with people you invite. It is not a public launch and takes
no money. This list keeps the two apart.

**On company formation:** an individual can enrol in the Apple Developer Program and distribute through TestFlight.
A company is **not** required for that. Apple's guideline 5.1.1(ix) asks for a legal entity for apps in highly
regulated fields; whether this app falls there is a question to raise with counsel before public release, not a
barrier to a private test. With an individual account, your legal name is shown as the developer.

## A. Needed for a private TestFlight

| # | Item | Who | Status |
|---|---|---|---|
| T1 | Apple Developer Program membership (individual or company) | Owner | Not verified here |
| T2 | App record in App Store Connect with the bundle identifier `com.narrowgatefitness.app` (or one you own) | Owner | Not verified here |
| T3 | A hosted staging copy of the app and database for testers to use (the native app loads the hosted site) | Owner, with `docs/STAGING_ENVIRONMENT.md` | Not set up per repository records |
| T4 | A signed build uploaded (`docs/TESTFLIGHT_STEPS.md`) | Owner | Not done |
| T5 | The offline fix on the release candidate | Claude, on your approval | Patch ready (file 20) |
| T6 | Member-facing statements that contradict the code corrected | Claude | Two done; four await your wording decision (file 15) |
| T7 | A working support or feedback email shown to testers (TestFlight asks for one) | Owner | Missing |
| T8 | Beta description and "what to test" notes; a test account for Apple's beta review if you invite external testers | Owner | Missing |
| T9 | A first pass of the device plan on a physical iPhone: sign-up, a workout, the rest timer with the screen locked, a GPS walk, the barcode camera, a reminder, Apple Health import (`docs/release/IPHONE_PLAN_2026-11-15.md`) | Owner | Not done; cannot be done here |
| T10 | Testers told plainly: test build, draft Terms and Privacy pages, data may be reset, the AI Coach is on or off | Owner | To write |
| T11 | Paid features in the test: keep purchases off, or use Apple's sandbox, so nobody is charged | Owner | Decide |
| T12 | The AI Coach in the test: either off, or on with a staging key and a spending cap | Owner | Decide (no key provided yet) |
| T13 | Friends & Challenges and accountability partners switched off | — | Off by default; verified |
| T14 | Export-compliance answer (the app uses standard encryption only) and the privacy answers Apple asks for at upload | Owner | At upload |

**Internal testers** (up to 100 people on your App Store Connect team) need no Apple review. **External testers**
(by email or public link) need Apple's beta review of the first build, for which T7 and T8 are required.

## B. Sensible to settle for TestFlight, required by public launch

| # | Item | Why now |
|---|---|---|
| S1 | Counsel's quick view on testers accepting draft legal pages | The app records an acceptance; the pages are placeholders |
| S2 | The health-data decision (file 18) | Testers with an Apple Watch will have real health data in the app |
| S3 | Where the badge art and the supplied clip came from | Cheaper to replace before anyone sees them |
| S4 | Keep testers to adults you know | The age gate is a checkbox |

## C. Not needed for a private TestFlight; required for a public Free launch

Final Terms and Privacy Policy with a named operating party and address; trademark search and decision; the Open Food
Facts decision; ownership records for all artwork; professional review of safety content; the full device plan on
iPhone and Android; store listing, screenshots, age rating, privacy labels; a public account-deletion page; a
reviewer demo account; retention and age decisions; the seven Home photographs or a final decision to ship without.

## D. Additionally required for a paid launch

Store products created at $17.99 a month and $119.99 a year; purchase, restore, cancel, refund and expiry run end to
end in the sandbox; subscription disclosures reviewed against auto-renewal law; the paid-apps agreement, tax and
banking set up in the store accounts; live AI quality and cost measured under a spending cap; the open AI-policy and
prayer-journal decisions answered.

## E. Status in one line each

- **Private TestFlight:** blocked mainly by things only you can do (T1–T4, T7–T12), plus T5 and T6, which are ready
  or nearly ready on my side.
- **Public Free launch:** blocked by section C.
- **Paid launch:** blocked by sections C and D.
