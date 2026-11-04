# Intermittent hydration error #418: root cause and fix

**Status (2026-11-04):** root cause found and fixed. The cause was a bug in the React build that Next.js bundles, not
in the app's code. Fix: `scripts/react-hydration-replay-fix.mjs` applies React's own upstream fix to Next's bundled
copy of React DOM, on every install and build. The evidence and the tests are below.

## Symptom

In the automated phone sweep, about 1 in 200–250 page loads (0.4%, with three test users loading pages at the same
time) logged `Minified React error #418 … args[]=HTML` ("Hydration failed because the server rendered HTML didn't
match the client"). Different pages each time (`/plan`, `/train`, `/train/programs`, `/faith`, `/faith/practices`,
`/nutrition/recipes`, `/nutrition/insights`), at different depths. A rerun usually passed.

What a member would see: React recovers by throwing away the server-rendered page and re-rendering all of it in the
browser. The page stays correct, but it costs a second full render, can flash, can lose scroll position and text typed
in the first instant, and would fill production error reports with noise.

## How it was found

A production build with source maps was loaded about 1,600 times by three parallel browsers (the phone sizes 320, 375,
393 and 440 px; 44 pages; a signed-in Pro test account), recording for every failed load: the server HTML, the final
DOM, every DOM change from first byte to the error with its JavaScript stack, every server request, and React's
component stack for the mismatch.

Ruled out, with evidence:

- **The server sending different HTML.** The browser's re-render of the page is identical to the server HTML (apart
  from React's internal ids and comment markers) in every failed load.
- **Something changing the page before React.** No script touched the page body between the HTML arriving and the
  error. The HTML was complete before React started (the server payload follows the HTML in the document).
- **Browser-only values in render** (time, screen size, storage, toasts, the opening animation, scroll and navigation
  memory, the service worker, prefetching): either checked and clean, or fixed where they could ever differ (the
  toaster now gives React the same empty list on the server and on first render).

The deciding evidence: in **all 7 failed loads**, React's error stack was the same three frames:

```
throwOnHydrationMismatch   ← beginWork   ← replaySuspendedUnitOfWork
```

`replaySuspendedUnitOfWork` runs only when part of the page "suspended" (was not ready) during hydration and React
re-runs that element.

## Root cause

Next.js 15.5.28 (and the newest 15.x patch, 15.5.29) bundles React DOM `19.2.0-canary-0bdb9206-20250818`. In that
build, when an HTML element's children are still loading during hydration (for example a component whose JavaScript
file has not finished downloading), React pauses. If the missing piece arrives in the short moment before React
resumes, React re-runs ("replays") that element. The replay looks for the element's server HTML at the wrong place:
it has already moved its position marker onto the element's first child, so it compares, say, a `<ul>` with its first
`<li>`, decides the server HTML is wrong, and re-renders the whole page in the browser.

That timing window is why it was rare, random across pages, and more frequent when the server and browser were busy.

React fixed this upstream: react-dom 19.3 resets the position marker to the element itself before replaying it
(`replayBeginWork`, HostComponent branch). The fix is in the React build bundled with Next 16 (checked: Next 16.4.5
bundles `19.3.0-canary-278794d7-20261002`, which has it), but not in any Next 15 release.

## The fix

`scripts/react-hydration-replay-fix.mjs` adds React's upstream change (6 lines) to the bundled React DOM builds in
`node_modules/next/dist/compiled/react-dom*/cjs/`:

- Runs automatically: `postinstall` (every `npm install` / `npm ci`), `prebuild` and `predev`.
- `postbuild` (`--verify-build`) checks the shipped browser bundle contains the fix and fails the build if not.
- `next.config.ts` keys webpack's build cache to the script, so a cached build of the unfixed React is never reused.
- Idempotent; keeps each original file as `<file>.ngf-orig`; `--restore` puts the originals back.
- If an upgrade changes React so the expected code is not found, it fails loudly instead of skipping; if the bundled
  React already has the fix, it reports `upstream-fixed` and changes nothing.

No app code changed for this fix.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Diagnostic production build, 1,584 loads, 3 parallel browsers, 4 phone widths, 44 pages | **7** × #418 (all via the replay path) | see below |
| `tests/unit/react-hydration-replay.test.ts`: the exact replay situation run through Next's bundled React DOM (production and development builds) | reproduces #418 and discards the server HTML | hydrates cleanly, keeps the server HTML |
| `npm run build` | — | `--verify-build` confirms the fix is in the browser bundle |
| Phone sweep (`e2e/phone-sweep.spec.ts`), three consecutive runs | intermittent #418 | see the release candidate document |

The "after" load test counts every load that went through the replay path that used to fail; those loads now hydrate
without an error. Results are recorded in `docs/RELEASE_CANDIDATE.md`.

## When to remove it

When Next is upgraded to a version whose bundled React has the fix (Next 16.x does), the script reports
`upstream-fixed` for every file. Then delete the script, its `.d.mts`, the four `package.json` hooks, the `webpack`
block in `next.config.ts` and the unit test. Upgrading to Next 16 is a major version change and was not done here.

## Maintenance risks (and how each is covered)

The fix edits code inside `node_modules/next`, which is unusual. What can go wrong, and what catches it:

| Risk | What would happen | Covered by |
| --- | --- | --- |
| A build that skips the hooks (`npx next build` directly, or an install with `--ignore-scripts` followed by `next build`) | The unfixed React ships and the intermittent error returns | CI, the iOS workflow and the demo script all use `npm run build` (prebuild applies the fix, postbuild verifies the bundle). **On the host, set the Build Command to `npm run build`** (not `next build`). `tests/unit/release-guards.test.ts` fails if the hooks are removed from `package.json` |
| A Next.js patch upgrade changes the bundled React | Either React already has the fix (script reports `upstream-fixed` and does nothing) or the code it patches moved (script fails `npm install`/`npm run build` with a message pointing here) | The script refuses to guess; `tests/unit/react-hydration-replay.test.ts` checks the installed builds |
| A stale build cache reuses the unfixed React | Same as the first row | `next.config.ts` keys webpack's cache to the script; postbuild `--verify-build` fails the build if the browser bundle lacks the fix |
| Switching the build to Turbopack | Turbopack ignores the webpack cache hook | The patched source is still what gets bundled, and `--verify-build` still finds the React chunk (checked in the Next 16 trial, which builds with Turbopack). Not planned on Next 15 |
| The patch differs from React's own fix | A subtle hydration difference | The patch is React's upstream change verbatim; the regression test reproduces the bug without it and passes with it on both the production and development builds |
| Someone edits `node_modules` by hand | Unknown state | `npm ci` reinstalls clean files and the postinstall hook re-applies the fix; `node scripts/react-hydration-replay-fix.mjs --check` reports the state; `--restore` puts the originals back |
| Package integrity | npm verifies each package before install scripts run; the fix changes files only after that, and only the 6 listed React DOM builds | `TARGETS` in the script |

**Exit:** upgrading to Next 16 removes the need for the patch (its bundled React has the fix; checked in a trial).
That is a separate, larger change that needs the owner's approval and has not been done. The trial, the conditions
and the step-by-step plan are in `docs/NEXT16_UPGRADE_EVALUATION.md`.
