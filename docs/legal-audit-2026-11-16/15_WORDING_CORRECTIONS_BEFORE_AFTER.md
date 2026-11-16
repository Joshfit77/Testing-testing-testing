# 15. Wording corrections: exact before and after

Date: 2026-11-16. Owner's instruction: show the exact wording first; apply only clearly factual corrections that
reflect the code; do not finalise policies, consent language or legally consequential promises without approval and
attorney review. Status of each item is stated. All changes are on `claude/friends-challenges` only.

## Applied (the statement was false and the fix makes no new promise)

### B1. Onboarding, "About you" step

`src/components/onboarding/onboarding-questionnaire.tsx:487`

- **Before:** "Used to confirm you're an adult and to estimate your daily calories. Never shared."
- **After:** "Used to confirm you're an adult and to estimate your daily calories."

`src/components/onboarding/onboarding-wizard.tsx:249`

- **Before:** "Only used to estimate your daily calories. Never shared."
- **After:** "Used to estimate your daily calories."

Why: age, height and sex are sent to the AI provider once a member allows the AI Coach (the coach's own consent
card says so). "Never shared" and "Only" were untrue. The fix removes the untrue words and adds nothing. Whether to
add a positive statement is B1-option below, for approval.

### B5. Plans & billing, cancellation note

`src/app/(app)/profile/billing/page.tsx:230`

- **Before:** "Deleting the app or your Narrow Gate account cancels a website subscription for you, but not one billed
  by Apple or Google: cancel those in your store account."
- **After:** "Deleting your Narrow Gate account cancels a website subscription for you, but not one billed by Apple or
  Google: cancel those in your store account. Removing the app from your phone doesn't cancel any subscription."

Why: account deletion does cancel a website subscription (`src/server/services/account-deletion.ts:52`). Deleting
the app does not cancel anything, and the old sentence told members it did. This is a subscription disclosure, so
counsel should still read it with the rest of the paywall text.

## Proposed, not applied (consent language, privacy representations or pricing promises)

### B1-option. A positive statement in place of "Never shared"

- **Proposed:** "Used to calculate your plan. Sent to the AI Coach's provider only if you turn the AI Coach on. Never
  sold, and never shown to other members."
- Needs approval because it is a privacy representation ("never sold", "never shown").

### B2. Body Scan consent card and dashboard

`src/components/body-scan/consent-card.tsx:13`

- **Now:** "They're kept in private storage that only your account can open. Our team and admins can't view them."
- **Concern:** the app gives administrators no screen or permission to view them (file 06). But the photos
  sit with the hosting provider, and anyone holding the server's master key could technically read them. "Can't" is
  stronger than the facts.
- **Proposed:** "They're kept in private storage that only your account can open. The app gives our team and admins no
  way to view them."

`src/components/body-scan/consent-card.tsx:14`

- **Now:** "Your photos are never sent to the AI coach or to any other company or service. If that ever changes, we'll
  ask for your separate consent first."
- **Concern:** they are stored with the hosting provider, which is another company.
- **Proposed:** "Your photos are stored with our hosting provider and are never sent to the AI coach or to anyone else.
  If that ever changes, we'll ask for your separate consent first."

`src/components/body-scan/scan-dashboard.tsx:140`

- **Now:** "They aren't sent to the AI coach or any other service …"
- **Proposed:** "They're stored with our hosting provider and aren't sent to the AI coach or anyone else …"

Not applied: this is consent language.

### B3. "The complete Faith & Discipline section, always free"

`src/lib/domain/plans.ts:143`, `src/components/profile/membership-plans.tsx:43`; related:
`src/app/(app)/profile/billing/page.tsx:169` ("Faith is always free: the Bible, devotionals and prayer journal"),
`src/app/(auth)/signup/page.tsx:23` ("Free forever plan").

- **Concern, factual:** "complete" is inaccurate. The AI Bible study helper is part of Pro.
- **Concern, legal:** "always free" and "Free forever" are open-ended promises.
- **Option A (factual fix only):** "The Faith & Discipline section: Bible, prayer journal, devotionals and reading
  journeys, always free"
- **Option B (also softens the promise):** "The Faith & Discipline section: Bible, prayer journal, devotionals and
  reading journeys, free"

Not applied: the owner chose, on principle, never to put Scripture behind a paywall. Whether to state that as a
promise is the owner's and counsel's decision.

### B4. AI Coach consent card

`src/components/coach/ai-consent-card.tsx:36-52`

- **Concern:** the list of what is sent to the AI provider omits five things the privacy audit found are sent:
  questions asked of the Bible study helper; the figures in the scheduled weekly report; food-label photos; the text of
  earlier messages in the conversation; and the factors a member ticks in sleep check-ins.
- **Proposed additions to the list:**
  - "Earlier messages in the same conversation"
  - "Questions you ask the Bible study helper, with the passage you are reading"
  - "The figures in your weekly progress report (workouts, nutrition, weight, runs and sleep totals)"
  - "Food-label photos you choose to analyse, only after you agree to that separately"
  - "Sleep check-in answers (such as caffeine, late meals or stress), when you ask about sleep"

Not applied: this is consent language, and each line should be checked against file 06 by counsel.

### B6. Supplement disclaimer

`src/data/supplements.ts:314-315`

- **Now:** "… talk to your doctor before starting anything new, especially if you're pregnant, under 18, have a medical
  condition or take medication."
- **Earlier suggestion:** remove "under 18", because the app is for adults only.
- **Recommendation now: keep it.** It is a safety caution, it is not false, and removing a caution is not a factual
  correction. Counsel may prefer to keep it as protective wording.

## Also corrected earlier in this audit

README exercise count; a code comment that said no Open Food Facts data is stored; the Notices page's statement that
licence texts are "included with each package". See file 12, part A.
