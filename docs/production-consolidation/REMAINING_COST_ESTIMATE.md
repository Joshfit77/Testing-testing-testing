# Remaining cost estimate

All figures are estimates in USD, before tax, from public list prices as known on 2026-11-26; confirm current prices
before buying. Nothing has been purchased.

## One-time

| Item | Low | High | Notes |
|---|---|---|---|
| Consultant engagement, iOS launch with paid subscriptions: 25.5–41.5 h (docs/engagement/ENGAGEMENT_AGENDA.md) | $9,818 | $15,978 | at $385/h, AI-assisted: Claude implements, consultants verify on devices and accounts, and review |
| Consultant engagement including Android: 29–47 h | $11,165 | $18,095 | at $385/h |
| Legal review of privacy policy and terms | $1,000 | $3,000 | health + faith + AI data |
| Trademark search / filing (US, one class) | $350 | $1,500 | filing fee plus optional attorney |
| Test devices (if you don't own them) | $0 | $600 | one used older iPhone; optional Android |
| Google Play registration | $25 | $25 | one-time, only if launching on Android |

## Recurring (monthly unless noted)

| Item | At launch / 100 subs | 1,000 subs | 10,000 subs | Notes |
|---|---|---|---|---|
| Apple Developer Program | $99 / year | $99 / year | $99 / year | |
| Hosting (Vercel Pro or similar) | $20 | $20–50 | $50–300 | usage-based above included limits |
| Supabase | $25 (Pro) | $25–60 | $100–400 | compute add-ons as load grows (PERFORMANCE_REPORT.md) |
| AI (Anthropic), typical use | $41 | $406 | $4,056 | AI_COST_ANALYSIS.md typical column; capped by the budget settings |
| RevenueCat | $0 | $0 | ~1% of tracked revenue above its free threshold | check current terms |
| Store fees | 15% (Small Business Program) | 15% | 15–30% | Apple/Google commission on subscriptions |
| Stripe (web subs) | 2.9% + $0.30 per charge | same | same | |
| Email (SMTP provider) | $0–20 | $20 | $20–90 | |
| Error monitoring (optional) | $0 | $0–26 | $26–80 | free tiers usually enough at first |

The largest controllable cost is AI. The app already has per-member and global daily budgets, a per-request ceiling and
kill switches; set a monthly limit in the Anthropic console as a second guard.

## What this work avoided

Everything in this consolidation (fixes B-01..B-22, O-01..O-20 and T-01..T-26, migrations 088–098, the native
Swift/Java recorder, tests, scripts, reports) was done without new dependencies, paid services or recurring costs.
Doing the O-items by hand at $385/h was estimated at 45–90 hours for the launch minimum ($17,325–$34,650). The
remaining 25.5–41.5 hours are verification on devices and accounts and independent review, which need a person.
