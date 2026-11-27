# Narrow Gate Fitness design system

Written 2026-11-15 from the code as it is (Tailwind CSS 4, tokens in `src/app/globals.css`, shared components in
`src/components/ui/`). This is the specification later screen work follows. It describes what exists, what was tightened
on this date, and what is still inconsistent. It is not a redesign.

## Tokens (`src/app/globals.css`)

| Role | Token / class | Value |
|---|---|---|
| Page background | `background` | `#070707` |
| Card surface | `card` | `#151515` |
| Raised surface (inputs, popovers, secondary buttons) | `elevated` | `#1e1e1e` |
| Divider and border | `border` | `#2b2824` |
| Brand accent | `gold` | `#c9a54c` |
| Accent text on dark | `gold-highlight` | `#e2c477` |
| Quiet accent (hover borders) | `gold-muted` / `bronze` | `#8c6a2f` |
| Wordmark | `champagne` | `#f1dfa8` |
| Text | `foreground` | `#ffffff` |
| Secondary text | `muted-foreground` | `#b3b0aa` |
| Success fill / success text | `success` / `success-foreground` | `#3fa077` / `#5fc49a` |
| Error fill / error text | `destructive-solid` / `destructive-foreground` | `#b93a3a` / `#f08a8a` |
| Words of Jesus | `red-letter` | `#f0736a` |

Radii: `sm` 6 px, `md` 10 px, `lg`/`xl` 12 px, `2xl` 16 px, `3xl` 20 px, `full`.
Fonts: `font-sans` (Inter) for interface text, `font-display` for headings and numbers, `font-serif` for Scripture.
Motion: `fade-in` 0.2 s, `pop-in` 0.26 s, `sheet-in` 0.32 s, `page-in` 0.32 s; all are switched off under
`prefers-reduced-motion`.

## Rules

1. **Gold means action, achievement or brand.** One gold-filled button per screen: the primary action. Secondary actions
   are `secondary` (raised surface) or `outline`. Body text is never gold.
2. **Surfaces step once.** Page → card → raised. No card inside a card inside a card.
3. **Cards are `rounded-2xl` with a `border`; controls inside them are `rounded-xl`; pills are `rounded-full`.**
4. **Type scale.** Page title `text-2xl`/`text-3xl` display; section heading `text-lg` semibold; card title
   `text-base` semibold; body `text-body` (15 px) or `text-sm`; captions `text-xs`. Metrics use `font-display` with
   `tabular-nums`.
5. **Touch targets are 44 px** (`min-h-11`, button `h-11`). Compact buttons keep a 44 px hit area.
6. **Colour is never the only signal.** Success, error and Pro states carry an icon or words.
7. **Scripture is serif, calm, and never decorated.**

## Shared components (`src/components/ui/`)

`button` (default, secondary, outline, ghost, destructive, link; sizes default 44 px, sm, lg, icon), `card`, `badge`,
`dialog`, `confirm`, `input`, `label`, `switch`, `tabs`, `segmented`, `progress-bar`, `progress-ring`, `stat-tile`,
`skeleton`, `toaster`. Empty, loading and error blocks are in `src/components/common/states.tsx`.

## What was measured (2026-11-15, `src/app` and `src/components`)

| Finding | Count | Status |
|---|---|---|
| Error text colour typed as a raw hex (`#f08a8a`) instead of the token | 68 | **Fixed**: now `destructive-foreground` |
| Success text colour typed as a raw hex (`#5fc49a`), no token existed | 39 | **Fixed**: new `success-foreground` token |
| Brand gold typed as a raw hex in class names (`#C9A54C`) | 27 | **Fixed**: now `gold` |
| Body size typed as `text-[0.9375rem]` | 94 | **Fixed**: new `text-body` token |
| All-caps labels (`uppercase`) | 309 | Open: too many; to be cut to section eyebrows only, screen by screen |
| Distinct letter-spacing values on those labels | 11 | Open: collapse to two (`tracking-wide`, one eyebrow value) |
| Corner radii in use | 7 | Acceptable: 92 % are `2xl`, `xl` or `full`; the 22 `md`/`sm`/`3xl` uses to be reviewed |
| Other one-off font sizes (`text-[…]`) | 28 | Open |

The four fixes are value-for-value replacements: the rendered colours and sizes are identical, so no screen changed
appearance. They make the next phases a matter of changing a token once.

## Screen review order

1. Design system and Home. 2. Train and the active workout. 3. Nutrition and Faith. 4. AI Coach, Progress and the rest.
5. Regression testing and review on a physical iPhone.

Baseline screenshots for every route (180 for an experienced account, 170 for a new one) were captured on 2026-11-15
with `scripts/ux/capture.mjs` before any screen change. They are not stored in the repository.

### Observed on the baseline, by screen (to act on in order)

| Screen | Observation | Measure |
|---|---|---|
| Home | The verse ran to five lines on a phone and pushed today's workout down | **Fixed**: three lines, whole verse on tap |
| Home | The code-drawn background pictures were rejected | **Removed**; a plain dark panel until the owner supplies seven real photographs |
| Home | Header button reads "Coach" here and "AI Coach" on every other tab | Open |
| Nutrition | Calories and macros sit below the quick actions and the recent-foods list; 4.5 screens long, 1,061 words, 120 controls | Open (phase 3); the order is member-customisable, so the default is an owner choice |
| Faith | 4.6 screens long; 6 controls under 44 px | Open (phase 3) |
| Run | 5 controls under 44 px | Open (phase 4) |
| Sleep | 4 controls under 44 px | Open (phase 4) |
| You | 3 controls under 44 px | Open (phase 4) |
| Program library | 7.7 screens long | Open (phase 4) |
