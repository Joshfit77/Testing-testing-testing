# Final repository review

Reviewed 2026-10-26 from GitHub's current state, not from earlier reports.

## Branches and pull requests

| Item | State | Contents |
|---|---|---|
| `main` | Last merged PR 2 (Scripture opening, offline edition, APK and iOS builds) | Behind `claude/testflight-prep` |
| `claude/testflight-prep` | Main development branch | Opening, app, sleep, GPS, Body Scan, billing (Free/Plus/Pro before this PR) |
| [PR 3](https://github.com/Joshfit77/Testing-testing-testing/pull/3) `claude/launch-audit` | Open, mergeable, CI green | Nutrition Score rename (Food IQ retired), privacy fixes (deleted runs lose their route, sign-out clears recordings, `plan_of` private, export limit), audit docs A–E |
| [PR 4](https://github.com/Joshfit77/Testing-testing-testing/pull/4) `claude/android-hardening` | Open, mergeable, CI green | No Android app-data backups, only the Health Connect permissions used |
| [PR 5](https://github.com/Joshfit77/Testing-testing-testing/pull/5) `claude/ios-ci-reliability` | Open, mergeable, CI green | iOS opening-test harness timed to the opening; no app change |
| `claude/free-pro-membership` (this work) | New PR against `claude/testflight-prep` | Built on PRs 3, 4 and 5 merged together (they combine without conflicts); once those merge, its diff shrinks to this work only |
| Older feature branches (`stage1-memberships`, `stage2-store-billing`, `security-nasb-deletion`, `app-cleanup`, `badges-polish`, `nine-features`) | Fully contained in `claude/testflight-prep` | Nothing left to integrate |

Nothing was merged, deployed, uploaded or published.

## Unresolved issues

Severity: High blocks a stage, Medium should be fixed before paid launch, Low is improvement. TF = blocks internal
TestFlight; Paid = blocks public paid launch.

| Issue | Sev. | Evidence | User impact | Recommended fix | TF | Paid | Owner approval | Device / account | Specialist |
|---|---|---|---|---|---|---|---|---|---|
| No deployed site or production Supabase | High | `capacitor.config.ts` refuses a build without an `https://` server URL | App can't load | Create Supabase project, deploy | Yes | Yes | Yes | Account | — |
| No Apple Developer account, App ID or signing secrets | High | `ios.yml` `testflight` job needs `ASC_*` | No signed build | Enrol, create records, add secrets | Yes | Yes | Yes | Account | — |
| Nothing verified on a physical iPhone (Health, background GPS, camera, purchases, opening) | High | Only Simulator/browser CI | Unknown device defects | Run `IOS_DEVICE_TEST_PLAN.md` | No | Yes | — | Device | — |
| Store subscriptions never run against App Store Connect / Play | High | Code and tests only | Members couldn't buy in the app | Create products and RevenueCat config; sandbox run | No | Yes | Yes | Account + device | — |
| Final Terms, Privacy Policy, consumer-health-data policy | High | Drafts in `docs/legal/`; in-app pages are placeholders | Weak contract and disclosure | Counsel review, owner publishes | No | Yes | Yes | — | Legal |
| Legal entity, contact details, governing law, arbitration choice | High | Placeholders in drafts; Apple 5.1.1(ix) | App Review and liability exposure | Form entity; supply details | No | Yes | Yes | — | Legal |
| Auto-renewal acknowledgment email and annual reminder | Medium | Consent now captured and recorded in code; emails not configured | ARL/ROSCA exposure | Turn on Stripe receipt and renewal emails; counsel to confirm wording | No | Yes | Yes | Account | Legal |
| Trademark clearance; "Narrow Gate Nutrition Score" next to Nutri-Score grades | Medium | `FINAL_TRADEMARK_REVIEW.md` (registers were blocked here; mirror data only) | Possible dispute or rename later | Attorney search; decide on the score title | No | Yes | Yes | — | Trademark |
| Patent claims not read in full | Medium | `FINAL_PATENT_REVIEW.md` (claims text was unreachable here) | Unknown infringement risk | Counsel reads Fitbod '760, Amazon '629/'693 first | No | Yes | — | — | Patent |
| No consent screen for progress photos; no notice for faith/religious data | Medium | Body Scan has one, progress photos don't | Sensitive data without explicit consent | Add consent step and notice after counsel confirms wording | No | Yes | — | — | Legal |
| Rate limiting for non-AI endpoints is per server instance | Low | `src/server/rate-limit.ts`; AI limits are database-backed | Abuse could raise server load, not AI cost | Platform firewall or a shared limiter at deploy time | No | No | — | Account | — |
| Web price switching requires Stripe portal configuration | Low | Portal settings live in Stripe | Members switch monthly↔yearly only if enabled | Enable in Stripe Dashboard | No | Yes | Yes | Account | — |

## Verified as already fixed (re-checked in this review)

- Deleted GPS activities keep no route, splits or signal data (PR 3, constraint `activities_deleted_no_route`).
- GPS drafts are cleared on sign-out and account change (PR 3).
- Progress-photo and Body Scan deletion now remove the image before the row, so no private image is left orphaned
  (this PR; previously a failed file removal orphaned the image).
- Stripe refunds and disputes now end the access they paid for (this PR; previously ignored).
- Account deletion cancels Stripe subscriptions and says clearly that Apple/Google subscriptions must be cancelled in the
  store (deletion screen, paywall terms, "How to cancel").
- Every AI feature reserves its request in the database before calling the model, so limits hold across instances.
