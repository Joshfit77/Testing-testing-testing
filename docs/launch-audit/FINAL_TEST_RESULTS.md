# Final test results

Branch `claude/free-pro-membership`, 2026-10-26. Local runs use a local Supabase stack with every migration applied
(including 20261026000044 and 20261026000045) and never contact Stripe, RevenueCat, Anthropic or Open Food Facts
(local stand-ins are used). **Nothing here ran on a physical iPhone or Android phone, and no store purchase ran.**

## Results

| Check | Where | Result |
|---|---|---|
| Typecheck (`tsc --noEmit`) | local and CI | ✓ clean |
| Lint (`eslint`) | local and CI | ✓ clean |
| Unit tests | local and CI | ✓ 2,623 passed (105 files) |
| Integration tests (database, RLS, billing webhooks) | local Supabase and CI | ✓ 185 passed, 1 skipped (pre-existing, environment-dependent) |
| Production build (`next build`) | local | ✓ |
| Browser end-to-end (Playwright, Pixel 7 size), full suite with the mock AI provider | local | ✓ 73 passed, 0 failed, 7 skipped (they need the Open Food Facts stand-in or the "no AI key" mode) |
| The 7 skipped tests, in their own modes | local | ✓ the Open Food Facts specs pass with the stand-in (12 passed); the "no AI key" coach test passed in the first full run |
| CI (`ci.yml`: checks + integration) on the PR head | GitHub | ✓ green on every pushed commit |
| iOS compile (offline edition, unsigned) | GitHub run 40325063952 | ✓ |
| iOS Simulator: opening on a fresh launch, relaunch replays it, return from background doesn't | GitHub run 40325063952 | ✓ (Enter Narrow Gate press skipped by design on that busy runner; the screenshot service stalled 3.7 s) |
| WebKit (iPhone size): opening, Enter Narrow Gate into the light, navigation | GitHub run 40325063952 | ✓ |
| Android debug APK (offline edition) | GitHub run 40325068650 | ✓ |
| Android release bundle (.aab): target SDK 36, merged permissions, 16 KB alignment, no background location | GitHub run 40326693973 | ✓ (unsigned: no upload key yet) |

## What the new tests cover

- **Plans**: only Free and Pro All Access are offered at $19.99 / $149.99 (37% saving); legacy Plus keeps its toolkit
  and live GPS; every Pro row on the comparison matches a server gate; Faith, the 157 demos and manual runs stay free.
- **Live GPS**: Free can't create a GPS recording or turn a manual entry into one (database), but can edit and delete
  earlier recordings; the record screen shows the lock; Pro records as before.
- **Stripe**: full refund ends the current period's access; partial refund doesn't; a later paid period restores it;
  disputes pause access until won, stay ended when lost; refunding an earlier period leaves the current one.
- **Store paywall**: monthly/yearly with the store's localized prices and per-month equivalent; switching interval
  names the old product for Google Play; legacy Plus upgrade; no second purchase for members billed elsewhere; no
  success message unless the server confirms; default product ids match App Store and Google Play base plans.
- **Consent records**: sign-up records Terms, Privacy Policy and the whole-app acknowledgment in the same step;
  members can't edit, delete, backdate or forge records; checkout consent records price and period; fingerprints
  match the exact texts shown.
- **AI meal plans**: ordinary preferences, diet styles and substitutions reach the AI; notes about medical conditions
  don't, and the plan says why.

## Fixed during testing

- 15 browser tests still expected the old Plus wording, $11.99/$24.99 prices, or recorded GPS runs as Free members;
  they now assert the approved structure (GPS tests sign up on Pro; Free GPS is tested separately).
- Two labels missed by the wording pass ("Unlimited with Plus", the coach's lock text) now say Pro.
- A store-billing sentence read "billed through App Store"; it now names "the App Store" and the Apple Account
  subscription settings.

## Not verified (needs hardware or accounts)

Installing on an iPhone or Android phone; Apple Health and Health Connect imports; background GPS with the screen
locked; camera barcode scanning; notifications and exact alarms; App Store and Google Play sandbox purchases;
TestFlight processing; Play internal testing.
