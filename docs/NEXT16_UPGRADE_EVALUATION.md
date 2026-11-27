# Next.js 16 upgrade evaluation: Narrow Gate Fitness

**Date:** 2026-11-04 · **Scope:** evaluation only. Nothing in the real project changed (no commit, no push, main repo `node_modules` and package files untouched).
**From:** `next@15.5.28` + `eslint-config-next@15.5.28` (bundled React DOM `19.2.0-canary-0bdb9206-20250818`)
**To (trialled):** `next@16.4.5` (npm `latest`) + `eslint-config-next@16.4.5` (bundled React DOM `19.3.0-canary-278794d7-20261002`)
**Trial base commit:** `f868275` on `claude/faith-discipleship`. The branch moved to `b75ea48` during the trial. The new commits are docs/scripts plus `tests/unit/release-guards.test.ts`, which matters here (see section 7).

**How it was done:** a throwaway detached worktree outside the repo, with a real `npm install`, a production build, a server on port 3005 and a browser smoke run. All runtime tests started at or after 20:29 UTC, after the local Supabase came back (about 20:21 UTC), so the database outage didn't affect any of them. The worktree was removed afterwards.

**Sources:** nextjs.org couldn't be reached from this session (the network policy blocks the host). The breaking-change list comes from:
- the version-matched docs that ship inside `next@16.4.5` (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` and the API reference pages);
- the canary upgrade guide (`docs/01-app/02-guides/upgrading/version-16.mdx` on raw.githubusercontent.com).

The 16.1 to 16.4 blog posts and release notes weren't read. The only minor-release changes I know of come from the canary guide (see table row 24).

---

## 1. Summary and recommendation

**Recommendation: upgrade later, not on this release candidate.** Do it on its own branch right after the RC ships, under the conditions below. Technically the upgrade is small and low-risk. The production build, unit tests, type check and a 27-test browser smoke all pass on Next 16 after a handful of config changes. But it is a framework major version change on a release candidate that is about to go to TestFlight, and the bug it fixes is already handled by the local patch.

What the trial found:

- **The hydration bug is fixed upstream.**
  - `react-hydration-replay-fix.mjs --check` reports `upstream-fixed` for all 6 React DOM builds.
  - The exact replay race from `docs/HYDRATION_418.md`, run through Next 16's own bundled React with no local patch, hydrates cleanly: 20 of 20 runs each for the production and development builds. An instrumented copy confirms the race really goes through `replaySuspendedUnitOfWork`.
  - The patch script, its 4 hooks, the `webpack()` block and the patch test can all be removed (section 7).
- **Required changes are small and mechanical:**
  1. Remove the `webpack()` hook. Next 16 builds with Turbopack by default and refuses to build with a custom webpack config. The hook exists only for the patch.
  2. Rewrite `eslint.config.mjs` as a native flat config. The current `FlatCompat` config crashes ESLint against eslint-config-next 16.
  3. Commit the `tsconfig.json` edits that `next build` makes automatically.
- **Conditions to settle before merging:**
  1. **ESLint:** eslint-config-next 16 brings eslint-plugin-react-hooks 7 (React Compiler rules), which reports **54 new errors in 37 files**. The baseline is 0 errors. Either downgrade those rules to warnings in the upgrade PR and fix them in follow-ups, or fix them first.
  2. **iPhones on iOS 16.0–16.3:** Next 16's default browser target is Safari 16.4, while the iOS app's deployment target is iOS 16.0. The Next 16 build ships class static blocks (a Safari 16.4+ syntax) in 8 browser chunks, including Next's own app-router chunk. On those iOS versions the JavaScript would likely fail to parse (not verified on a device). A `browserslist` entry in `package.json` removes them, which I verified in the build output. The alternative is raising the iOS minimum to 16.4.
  3. **Scroll behaviour:** `html { scroll-behavior: smooth }` (`src/app/globals.css`) will make Next's scroll-to-top on navigation animate, unless `<html data-scroll-behavior="smooth">` is added. This is a behaviour change, not a failure.
  4. **`next dev` writes `AGENTS.md`:** commit it, or set `agentRules: false`.
  5. **Full verification on the upgrade branch:** full e2e (Chromium and WebKit), integration, the iOS/Android workflows, the hydration load test, and a Vercel preview. None of these were run here.
- **Keep `src/middleware.ts` in the upgrade PR.** Next 16 only deprecates the name (one build warning). It still runs on the Edge runtime exactly as today. Renaming it to `proxy.ts` switches it to the Node.js runtime, so do that as a separate change.

**Estimated effort:** about 0.5 day of code and config changes, plus about 1 day of verification. Add 1–3 days if the 54 lint findings are fixed rather than downgraded. **Risk:** low to medium, with the iOS 16.0–16.3 point the only one that could break real users if missed.

---

## 2. What the upgrade fixes

| Item | Detail | Verified? |
| --- | --- | --- |
| **Hydration error #418 (false mismatch on replay)** | Next 16.4.5 bundles React DOM `19.3.0-canary-278794d7-20261002`. Its `replaySuspendedUnitOfWork` resets the hydration cursor in the HostComponent branch: `fiber === hydrationParentFiber && (isHydrating ? (popToNextHostParent(fiber), 5 === fiber.tag && null != fiber.stateNode && (nextHydratableInstance = fiber.stateNode)) : …)`. This is the same change our script adds by hand. | **Yes.** The source was inspected, `--check` reports upstream-fixed for 6/6 files, and a trial-only test ran the `docs/HYDRATION_418.md` race through the bundled production and development builds: 20/20 clean each, server HTML kept, 0 recoverable errors. An instrumented copy showed 1 call to `replaySuspendedUnitOfWork`, so the test really exercises the replay path. The minified browser chunk also contains the fix (`case 5:az(t);var r=t;r===rY&&(rG?(r3(r),5===r.tag&&null!=r.stateNode&&(rX=r.stateNode)):…`). |
| No more patching inside `node_modules/next` | Removes every row of the "Maintenance risks" table in `docs/HYDRATION_418.md`: skipped hooks, `--ignore-scripts`, stale webpack cache, a future Next patch moving the code, Turbopack chunk layout. It also removes the rule that hosts must use `npm run build` rather than `next build`. | Yes (follows from the above) |
| Phone sweep on Next 16 | `e2e/phone-sweep.spec.ts` (all signed-in screens, 320–440 px, largest text and reduced motion) passed with no script errors. React 19 reports recoverable hydration errors through `reportError`, which the spec's `pageerror` listener catches. | One run only. The 1,584-load hydration stress test **was not repeated** on Next 16. |
| Proxy errors reach `onRequestError` (only after a later proxy migration) | `instrumentation.ts` returns early unless `NEXT_RUNTIME === "nodejs"`, and middleware runs on Edge today, so middleware errors are never logged. A Node.js `proxy.ts` would report them with `routeType: "proxy"`. | Not verified (proxy not trialled) |
| Staying on the supported major | npm dist-tags list `latest: 16.4.5` and `backport: 15.5.29`. I couldn't read Next's support policy (nextjs.org unreachable). | Not verified |

Build speed: compile took 20.3 s with Turbopack (28.5 s on a second build), against 22.9–29.5 s for Next 15 + webpack in older logs on this machine. That is about the same; I didn't measure it rigorously.

---

## 3. Breaking and behaviour changes, checked against this codebase

| # | Change in Next 16 | Affects us? | Files | Required work |
| --- | --- | --- | --- | --- |
| 1 | Node.js ≥ 20.9 required | No | `.github/workflows/*.yml` all use `node-version: 22`; local Node 22.22.0 | None |
| 2 | TypeScript ≥ 5.1 required | No | `typescript@6.0.3` | None |
| 3 | **Default browser targets raised** to Chrome/Edge/Firefox 111 and Safari 16.4. Next 15's default was Chrome 64, Edge 79, Firefox 67, Opera 51, Safari 12 (read from `MODERN_BROWSERSLIST_TARGET` in each version). | **Yes.** iOS shell `IPHONEOS_DEPLOYMENT_TARGET = 16.0` (`ios/App`; docs say "iOS 16 minimum"). Android `minSdkVersion = 26` (its WebView is updated through the Play Store, so less exposed). Phone web users on old Safari are affected too. | `package.json`, `ios/App/App.xcodeproj` (deployment target), docs | Next 16 output contains `static{…}` class blocks in 8 of 135 chunks: Next's app-router error boundary (`class … extends Component{static{this.contextType=…AppRouterContext}}`) and Radix's `OrderedDict` (7 chunks). The Next 15 build has none (0 of 248). **Add** `"browserslist": ["chrome 111","edge 111","firefox 111","safari 16.0","ios_saf 16.0"]`, which I verified: rebuilt, 0 static blocks, build and verify step pass. **Or** raise the iOS minimum to 16.4. Running on a real iOS 16.0–16.3 device was **not verified**. |
| 4 | **Turbopack is the default** for `next dev` and `next build`. A build **fails** if a custom `webpack` config exists and there's no `turbopack` config. | **Yes** | `next.config.ts` (`webpack()` block, `import path`) | Delete the block and the `path` import. They exist only to key webpack's cache to the hydration patch. Verified: `npm run build` failed with the block (`ERROR: This build is using Turbopack, with a webpack config and no turbopack config`) and passed without it. `--webpack` would also work, but there's no reason to keep webpack. |
| 5 | Turbopack filesystem cache on by default; `experimental.turbopack` moved to top-level `turbopack` | No | No turbopack config | None |
| 6 | Turbopack: `resolve.fallback` becomes `turbopack.resolveAlias`; Sass `~` imports not supported | No | No Sass files, no fallbacks | None |
| 7 | `outputFileTracingIncludes` under Turbopack | Works | `next.config.ts` | None. Verified: `/faith`, `/home`, `/progress` and `/api/health` each trace the 68 `public/bible/bsb` files, the same as the Next 15 build. |
| 8 | **Async request APIs**: synchronous `cookies()`, `headers()`, `draftMode()`, `params` and `searchParams` removed | No (already migrated) | `src/app/layout.tsx`, `src/lib/supabase/server.ts`, `src/server/{native,rate-limit}.ts`, `src/server/actions/{demo,profile}.ts`, pages with `params`/`searchParams` (all `await`) | None. `tsc --noEmit` passes before and after the build. |
| 9 | Async `params`/`id` for `opengraph-image`, `icon`, `apple-icon` and `sitemap` | No | Only `src/app/manifest.ts` exists | None |
| 10 | App Router uses React canary 19.2+ (View Transitions, `useEffectEvent`, Activity) | Yes (benign) | — | None. Bundled React DOM is `19.3.0-canary-278794d7-20261002`; the app's `react`/`react-dom` stay at 19.3.1. |
| 11 | React Compiler stable (`reactCompiler: true`, off by default) | No | — | None. Don't enable it as part of the upgrade. |
| 12 | Caching: `revalidateTag(tag, profile)` needs 2 arguments; new `updateTag` and `refresh`; `cacheLife`/`cacheTag` stable | No | Only `revalidatePath` is used (`src/server/actions/*.ts`); no `revalidateTag`, `unstable_cache` or `"use cache"` | None |
| 13 | PPR flag / `experimental_ppr` removed; `cacheComponents` | No | No `experimental` config | None |
| 14 | **`middleware` → `proxy`** rename. The `middleware` name is deprecated. `proxy` runs only on Node.js. Config flags renamed (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). | **Warning only** | `src/middleware.ts` | Not required now. Verified: the build prints the deprecation warning, and `middleware.ts` is still built as **Edge** middleware (`middleware-manifest.json` → `server/edge/chunks/...`), as on Next 15. A later move to `proxy.ts` changes the runtime to Node.js; see section 8 for what to check. |
| 15 | `next/image` defaults (`minimumCacheTTL` 4 h, `imageSizes` without 16, `qualities: [75]`, local-IP block, `maximumRedirects: 3`, query-string `localPatterns`) | No | No `next/image` imports, no `images` config | None |
| 16 | Concurrent dev/build: `next dev` writes to `.next/dev`, plus a lockfile | Minor | `tsconfig.json` (Next adds `.next/dev/types/**/*.ts`) | Commit the tsconfig change. No script reads `.next/` paths except the hydration script, which is removed. |
| 17 | Parallel routes need `default.js` | No | No `@slot` folders | None |
| 18 | **`next lint` removed; `eslint` config option removed; `@next/eslint-plugin-next` defaults to flat config** | **Yes** | `eslint.config.mjs`, `package.json` (`@eslint/eslintrc`) | We already run `eslint .` and have no `eslint` option. But the `FlatCompat` config **crashes** with eslint-config-next 16 (`TypeError: Converting circular structure to JSON … property 'react' closes the circle`, exit 2). Rewrite it as a native flat config (section 5), then drop `@eslint/eslintrc`, whose only user is `FlatCompat`. |
| 19 | **eslint-config-next 16 pulls eslint-plugin-react-hooks 5.2.0 → 7.1.1** (React Compiler-based rules) and new `@next/next` rules | **Yes** | 37 files with errors (list in section 5) | 54 errors and 2 new warnings. Downgrade the 6 new `react-hooks/*` rules to `warn` for the upgrade (verified: 0 errors, 60 warnings, exit 0), then fix them in follow-ups. |
| 20 | **Scroll behaviour:** Next no longer forces `scroll-behavior: auto` during navigation | **Yes (behaviour)** | `src/app/globals.css:222` (`html { scroll-behavior: smooth }`), `src/app/layout.tsx:62` | Add `data-scroll-behavior="smooth"` to `<html>` to keep today's instant scroll-to-top on route changes. Reduced-motion users already get `auto !important`, and `src/components/shell/scroll-memory.tsx` uses `behavior: "instant"`. **Not visually verified**; the smoke suite passed without the attribute. |
| 21 | `size` / `First Load JS` columns removed from `next build` output | No | No script parses them | None |
| 22 | Config loaded once in `next dev` (`process.argv` has no `dev`) | No | `next.config.ts` checks `NODE_ENV` only | None |
| 23 | Removed: AMP, `serverRuntimeConfig`/`publicRuntimeConfig`, `devIndicators` options, `experimental.dynamicIO`/`useCache`, `unstable_rootParams` | No | None used | None |
| 24 | Later 16.x removals: `experimental.viewTransition` (16.3), `experimental.appNewScrollHandler` (16.4); `adapterPath` stable (16.2) | No | No experimental config | None (from the canary guide; the per-version release notes weren't read) |
| 25 | `tsconfig.json` auto-edits on `next build` | **Yes** | `tsconfig.json` | Next sets `jsx: "react-jsx"` (mandatory), adds `.next/dev/types/**/*.ts`, and reformats the arrays. Commit this. `next-env.d.ts` (gitignored) now imports `./.next/types/routes.d.ts`. |
| 26 | **`next dev` generates `AGENTS.md`** (`agentRules`, on by default) | **Yes** | repo root | Observed: running `npm run dev` created an untracked `AGENTS.md` with a "read `node_modules/next/dist/docs/`" block. Commit it, or set `agentRules: false` in `next.config.ts`. |
| 27 | `onRequestError` context: `routeType` value `'middleware'` renamed to `'proxy'` | No code impact | `src/instrumentation.ts` | None (it passes the value through) |
| 28 | CSP nonces | Works unchanged | `src/middleware.ts`, `src/app/layout.tsx`, `next.config.ts` `headers()` | None. Verified: 20/20 `<script>` tags carry the nonce from the response's CSP header, the `headers()` headers are present, and the `csp-and-layout` specs pass. |
| 29 | `instrumentation-client.ts` / `instrumentation.ts` | Works unchanged | `src/instrumentation*.ts` | None. Built (`.next/server/instrumentation.js`); the CSP specs, which watch for the Zod `Function("")` probe violation, pass. `onRequestError` was never triggered in the trial. |
| 30 | Turbopack emits server source maps | Minor | `.next/server` | 84 MB against 24 MB on Next 15, but the server JS itself is the same (18.5 against 18.8 MB); the difference is 52 MB of `.map` files. Function size on Vercel **not verified**. |
| 31 | Routing/prefetch rewrite (layout dedup, incremental prefetch) | Possibly (more, smaller prefetch requests) | — | None required; not measured |
| 32 | `overrides.next.postcss` | Still applies | `package.json` | Next 16.4.5 depends on `postcss 8.5.23`; the override lifts it to 8.5.30. Keep it unless the reason it was added no longer applies. |

Dependency changes from the install (lockfile):
- 26 packages changed version, mainly `next`, the `@next/swc-*` binaries, `@next/env`, `@swc/helpers` 0.5.15 → 0.5.23, `eslint-plugin-react-hooks` 5.2.0 → 7.1.1 and `typescript-eslint` 8.71 → 8.72.
- 34 added (Babel core, `hermes-parser` and `zod-validation-error` for the react-hooks plugin, plus `browserslist` and `baseline-browser-mapping`).
- 1 removed (`@rushstack/eslint-patch`).

`npm audit --omit=dev --audit-level=high` (the CI gate): **0 vulnerabilities**.

---

## 4. Trial results

Environment: Linux, Node v22.22.0, npm 10.9.4; local Supabase at `127.0.0.1:54321` (checked 200 before runs); the Next 15 server on port 3000 left running.

| # | Command (in the trial worktree) | Result | Counts / notable output |
| --- | --- | --- | --- |
| 1 | `npm install next@^16.4.5 eslint-config-next@^16.4.5 --no-audit --no-fund` | **Pass** (56 s) | 789 packages added (fresh worktree). Pre-existing warnings only: `EBADENGINE @zxing/library@0.23.0 requires node >= 24`, plus deprecations. postinstall ran the hydration script (upstream-fixed). |
| 2 | `node scripts/react-hydration-replay-fix.mjs --check` | **Pass**, exit 0 | **`upstream-fixed` for all 6** targets (react-dom and react-dom-experimental: client production, client development, profiling profiling, profiling development). No `.ngf-orig` backups created. |
| 3 | `npx tsc --noEmit` (before the build, no `next-env.d.ts`, as in CI) | **Pass**, exit 0 (42 s) | 0 errors |
| 3b | `npx tsc --noEmit` (after the build, with Next's tsconfig edits and generated `.next/types`) | **Pass**, exit 0 (50 s) | 0 errors |
| 4a | `npx eslint .` with the **unchanged** `eslint.config.mjs` | **Fail**, exit 2 (crash) | `TypeError: Converting circular structure to JSON` in `@eslint/eslintrc` config-validator (FlatCompat + eslint-config-next 16) |
| 4b | `npx eslint .` with a native flat config (section 5) | **Fail**, exit 1 | **60 problems: 54 errors, 6 warnings** in 40 files. Errors: `react-hooks/set-state-in-effect` 39 (31 files), `react-hooks/refs` 5, `react-hooks/purity` 3, `react-hooks/error-boundaries` 3, `react-hooks/immutability` 2, `react-hooks/preserve-manual-memoization` 2. Warnings: 4 `@typescript-eslint/no-unused-vars` (pre-existing) and 2 new `@next/next/no-location-assign-relative-destination`. **Baseline (Next 15 config, main repo, read-only run): 0 errors, 4 warnings.** |
| 4c | `npx eslint .` with the 6 new react-hooks rules set to `warn` | **Pass**, exit 0 | 0 errors, 60 warnings |
| 5 | `npx vitest run --project unit` | **Pass**, exit 0 (79 s) | **162 files, 3,198 tests passed.** Note: `react-hydration-replay.test.ts` passes vacuously on Next 16. Its reproduce tests `return` early when the bundled React has no patch marker, so a trial-only test (below) covered the upstream fix. |
| 5b | Trial-only `tests/unit/zz-trial-next16-replay.test.ts` (the same harness, against the unpatched Next 16 React) | **Pass** | 3/3 tests. Production and development builds each hydrate the race cleanly 20/20 times. The instrumented copy logged `replays: 1 errors: 0 kept: true`. |
| 6a | `npm run build` with the **unchanged** `next.config.ts` | **Fail**, exit 1 (0.7 s) | `▲ Next.js 16.4.5 (Turbopack)`, `⚠ The "middleware" file convention is deprecated`, then `⨯ ERROR: This build is using Turbopack, with a webpack config and no turbopack config.` |
| 6b | `npm run build` with the `webpack()` block removed | **Pass**, exit 0 (1 m 05 s) | Built with **Turbopack** (`✓ Compiled successfully in 20.3s`, TypeScript 42 s, 88 pages generated). 120 routes: 119 dynamic (ƒ), 1 static (○ `/manifest.webmanifest`), plus `ƒ Proxy (Middleware)`. Only warning: middleware deprecation. Next rewrote `tsconfig.json` (row 25). **postbuild `--verify-build` passes unchanged:** "present in the browser bundle (1 React DOM chunk)". The script's regex finds Turbopack's minified React chunk too, which contradicts the Turbopack row in `docs/HYDRATION_418.md` "Maintenance risks". It's moot once the script is removed. |
| 6c | `npm run build` + `browserslist` (Safari/iOS 16.0) | **Pass**, exit 0 (44 s) | Class static blocks gone (0/135 chunks); verify step passes |
| 7 | `npx next start -p 3005` (env from `.env.local` + `AUTH_RATE_LIMIT_SCALE=50 ANTHROPIC_API_KEY=e2e-test-key ANTHROPIC_BASE_URL=http://127.0.0.1:4777 OFF_API_BASE_URL=http://127.0.0.1:4778 DEMO_MODE=`) | **Pass** | `✓ Ready in 128ms`. `/api/health` 200. Landing page 200 with CSP nonce on all 20 scripts. Server log had **no errors or warnings** across both smoke runs. |
| 8a | `E2E_ANTHROPIC_MOCK_PORT=4777 E2E_OFF_MOCK_PORT=4778 E2E_BASE_URL=http://localhost:3005 npx playwright test e2e/opening-gate.spec.ts e2e/fast-logging.spec.ts e2e/csp-and-layout.spec.ts e2e/phone-sweep.spec.ts --project=mobile --reporter=line` (run 1, 20:29–20:37 UTC) | 25 passed, **2 failed** (8.2 min) | Both failures were in `opening-gate` (`plays on every reload and fresh launch…` line 180; `signed in: the gate opens onto Home…` line 430), and both were reproducible. **The cause is the test environment, not Next 16** (below). |
| 8b | The same command, **re-run** with the trial-only helper fix (20:42–20:50 UTC) | **27 passed, 0 failed** (8.2 min) | `phone-sweep` 6.7 min, all screens clean |
| 9 | `npm run dev -- -p 3006` (extra check) | **Pass** | `predev` hook ran (upstream-fixed). `▲ Next.js 16.4.5 (Turbopack)`, ready in 503 ms, `/` 200 (5.6 s first compile), `/login` 200. Dev output in `.next/dev`. **Created `AGENTS.md`** (row 26). |

**Why run 1 failed (re-run result 8b is the one to use).**
- The confirmation email comes from the local Supabase, which builds the link from its `site_url` (`supabase/config.toml`: `site_url = "http://localhost:3000"`; template `{{ .SiteURL }}/auth/confirm…`). So `signUpAndConfirm` (`e2e/helpers.ts`) landed the browser on the port-3000 **Next 15** server.
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local` points the same way.
- The two tests then cleared the `ngf.e2e.noIntro` localStorage flag on the `localhost:3000` origin. The next navigation went to `localhost:3005`, where Playwright's `storageState` flag was still `1`, so the opening was correctly suppressed.
- Diagnosis: a diagnostic spec logged `flag: "1"` on port 3005 right after the test cleared it. A curl check showed the middleware sets `ngf_gate=1` correctly on launch responses.
- Fix, for the trial only: rewrite the link's origin to `E2E_BASE_URL` in `signUpAndConfirm`. After that, both tests passed (2/2 in 34 s) and the full smoke passed.
- **Side effect to disclose:** in run 1, the email-confirmation step and the onboarding steps that follow it in each spec ran against the port-3000 server, for throwaway test accounts. It was never stopped or restarted and still returned 200 afterwards. Some run-1 "passes" therefore partly exercised Next 15, which is why only run 8b counts as Next 16 evidence.
- For future trials on a port other than 3000, keep this rewrite or add the port to Supabase's `additional_redirect_urls` and `site_url`.

Changes made in the trial worktree (all discarded with it):
1. `package.json` / `package-lock.json`: `next` and `eslint-config-next` bumped to `^16.4.5`. Later, for check 6c only, a `browserslist` entry.
2. `eslint.config.mjs`: native flat config (section 5), then the same with the new hook rules set to `warn`.
3. `next.config.ts`: removed the `webpack()` block and `import path from "node:path"`.
4. `tsconfig.json`: edited automatically by `next build` (row 25).
5. `.env.local`: copied from the main repo (gitignored) so the build used the same public env.
6. `e2e/helpers.ts`: confirmation-link origin rewrite (trial only, not proposed for the upgrade).
7. Added `tests/unit/zz-trial-next16-replay.test.ts` and `e2e/zz-trial-debug.spec.ts` (diagnostics). `AGENTS.md` was generated by `next dev`.

**Not run / not verified:**
- the integration suite (`vitest --project integration`);
- the other ~100 e2e tests;
- the `iphone-webkit` project;
- the 1,584-load hydration stress test;
- iOS Simulator and Android builds;
- any real iOS 16.0–16.3 device;
- a Vercel preview deploy (Turbopack build on Vercel, function sizes);
- Stripe and RevenueCat webhooks;
- the `/train/3d` redirect;
- the scroll-behaviour change, visually.

---

## 5. ESLint: proposed config and findings

Proposed `eslint.config.mjs`, verified on Next 16 (same ignores and rule override as today):

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts", ".claude/**", "ios/**", "android/**"]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // eslint-plugin-react-hooks 7 (React Compiler rules): warnings until the findings below are reviewed.
      ...Object.fromEntries(
        ["set-state-in-effect", "refs", "purity", "error-boundaries", "immutability", "preserve-manual-memoization"]
          .map((r) => [`react-hooks/${r}`, "warn"]),
      ),
    },
  },
]);
```

The 54 errors are mostly `set-state-in-effect`: state set inside `useEffect`, typically when reading localStorage, device or native state on mount. They are code-quality findings, not upgrade breakages; the app behaves the same, as the tests show. Each one needs a judgement call, because the "fix" often means restructuring components that hydrate from browser-only state. That is sensitive code for this app, given #418. Files:

- **set-state-in-effect (39 errors, 31 files)**
  - `src/components/auth/auth-forms.tsx`
  - `badges/rank-board.tsx`
  - `bible/chapter-reader.tsx`, `bible/offline-bible.tsx`
  - `body-scan/scan-capture.tsx`
  - `coach/coach-chat.tsx`
  - `demo/presenter-panel.tsx` (×2)
  - `faith/journey-checkin.tsx`
  - `notifications/notification-settings.tsx`, `notifications/todays-reminders.tsx`
  - `nutrition/barcode-scanner.tsx`, `nutrition/favorite-star.tsx`, `nutrition/food-picker.tsx` (×2), `nutrition/grocery-client.tsx`, `nutrition/nutrition-client.tsx` (×2), `nutrition/planner-client.tsx`
  - `onboarding/onboarding-questionnaire.tsx`
  - `progress/progress-photos.tsx`
  - `run/activity-form.tsx`, `run/gps-recorder.tsx`
  - `shell/app-shell.tsx`, `shell/navigation-progress.tsx`
  - `sleep/alarm-form.tsx`, `sleep/import-card.tsx`, `sleep/session-form.tsx`, `sleep/source-card.tsx`
  - `steps/steps-card.tsx` (×2)
  - `ui/toaster.tsx`
  - `workout/current-set-card.tsx`, `workout/workout-logger.tsx` (×3)
  - `src/lib/nav-memory.ts` (×3)
- **refs (5):** `body-scan/scan-capture.tsx`, `run/gps-recorder.tsx` (×3), `src/lib/use-draft.ts`
- **purity (3):** `src/app/(app)/admin/page.tsx`, `notifications/notification-settings.tsx`, `workout/exercise-card.tsx`
- **error-boundaries (3):** `notifications/todays-reminders-section.tsx`
- **immutability (2):** `src/app/(app)/nutrition/planner/page.tsx`, `workout/workout-logger.tsx`
- **preserve-manual-memoization (2):** `profile/profile-forms.tsx`, `run/gps-recorder.tsx`
- **New warnings:** `@next/next/no-location-assign-relative-destination` in `demo/presenter-panel.tsx:102` and `src/lib/native-alarm.ts:151`

(Paths without `src/` are under `src/components/`.)

Alternative: keep `eslint-config-next@15.5.x` for now. The guide says the lint stack doesn't have to move with Next. That avoids all of the above, but leaves lint rules out of step with the framework. I recommend upgrading it with the rules downgraded to warnings.

---

## 6. Effort and risk

| Work item | Effort | Risk |
| --- | --- | --- |
| Package bump, `next.config.ts` cleanup, tsconfig commit, ESLint flat config (rules downgraded) | ~2 h | Low (all verified in the trial) |
| Remove the hydration patch and its tests/guards, update docs | ~1–2 h | Low |
| Browser target decision (`browserslist` or iOS 16.4 minimum) | ~0.5 h + device check | **Medium** if skipped: iOS 16.0–16.3 users could get a non-working app. Verified only by bundle inspection. |
| `data-scroll-behavior`, `AGENTS.md` decision | ~0.5 h | Low |
| Verification: full CI, full e2e (mobile + WebKit), integration, phone sweep ×3, hydration stress test, iOS/Android workflows, Vercel preview | ~1 day (mostly machine time) | Finds what the trial didn't cover |
| Optional: fix the 54 react-hooks findings | 1–3 days | Medium (touches hydration-sensitive client code); do it in separate PRs |
| Optional, later: `middleware.ts` → `proxy.ts` | ~0.5 day + verification | Medium (runtime change from Edge to Node.js) |

**Total for the upgrade itself: about 1.5 days including verification.** Overall risk is low to medium. The trial found no runtime regressions in the covered flows (auth and sign-up, onboarding, the opening gate, CSP nonces, fast workout logging, every signed-in screen at phone widths).

---

## 7. Step-by-step upgrade plan (for later)

**Before starting:** the RC has shipped or been tagged; the owner approves the upgrade; the iOS minimum (16.0 vs 16.4) is decided.

1. **Branch and rollback point**
   - `git switch -c upgrade/next-16` from the released commit.
   - `git tag pre-next16` on that commit.
   - Note the current production deployment ID on the host (Vercel), so it can be promoted back.
2. **Packages**
   - `npm install next@^16.4.5 eslint-config-next@^16.4.5`. React 19.3.1 and the `@types/react*` 19.3 packages already satisfy Next 16's peers.
   - `npm uninstall @eslint/eslintrc` (its only user is `FlatCompat`).
   - Keep the `postcss` override.
3. **Remove the hydration patch (section 9).** After this, `npm install`, `npm run dev` and `npm run build` run plain Next with no hooks.
4. **`next.config.ts`:** delete the `webpack()` block and `import path from "node:path"`. Optionally add `agentRules: false` (step 8).
5. **ESLint:** replace `eslint.config.mjs` with the section 5 config. `npm run lint` must exit 0. Open a follow-up issue for the 54 findings.
6. **Browser targets:** add `"browserslist": ["chrome 111", "edge 111", "firefox 111", "safari 16.0", "ios_saf 16.0"]` to `package.json`, **or** raise `IPHONEOS_DEPLOYMENT_TARGET` to 16.4 and update the "iOS 16 minimum" docs. After the build, confirm `grep -l 'static{' .next/static/chunks/*.js` finds nothing (if keeping 16.0).
7. **Scroll:** add `data-scroll-behavior="smooth"` to `<html>` in `src/app/layout.tsx`, then check page-to-page navigation on a phone (instant scroll to top, as today).
8. **`AGENTS.md`:** commit what `next dev` generates, or disable it with `agentRules: false`.
9. **Run `npm run build` once and commit Next's `tsconfig.json` edits** (`jsx: "react-jsx"`, `.next/dev/types/**/*.ts`).
10. **Leave `src/middleware.ts` as is.** Accept the deprecation warning for now.
11. **Verify on the branch:**
    - `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run build`.
    - Full `npx playwright test` (mobile) on port 3000, or on another port with the confirmation-link caveat from section 4.
    - The `iphone-webkit` project (`E2E_WEBKIT=1`).
    - Phone sweep three times, and the hydration stress test from `docs/HYDRATION_418.md`; expect 0 × #418.
    - The iOS workflow (Simulator) and the Android APK workflow.
    - The `demo-preview` workflow for a Vercel preview: check the build log says Turbopack, function sizes, and that the CSP header and nonce are present.
    - `npm audit --omit=dev --audit-level=high`.
    - An iPhone on the lowest supported iOS, if available.
12. **Merge and deploy** as a single squash commit after owner sign-off. Watch error reports for #418 and CSP violations for a few days.

**Rollback**
- On the host, promote the previous deployment (instant). Then `git revert` the squash commit and redeploy.
- `npm ci` on the reverted tree reinstalls Next 15.5.28, and the restored `postinstall` hook re-applies the hydration patch automatically.
- The Capacitor shells load the deployed site, so neither direction needs an app-store release, unless step 6 raised the iOS minimum. That change ships in a native build and is not reverted by redeploying the site.

## 8. Later and separate: `middleware.ts` → `proxy.ts`

Run `npx @next/codemod@canary middleware-to-proxy .` (renames the file and the function). Then verify:
- **Runtime becomes Node.js** and can't be configured. `generateNonce` uses `crypto.getRandomValues` and `btoa`, both global in Node 22, and `@supabase/ssr` works on Node; both need testing.
- **Request bodies are buffered up to `proxyClientMaxBodySize`** (default 10 MB). Over the limit, the route gets a **truncated body**, not an error. The matcher covers `/api/ai/food-photo` and `/api/ai/label-photo`, whose limit is `FOOD_PHOTO_MAX_BYTES` = 5 MB, so they're inside the default. Keep that in mind if upload limits grow, or exclude those routes from the matcher.
- `onRequestError` would start logging proxy errors (`routeType: "proxy"`).
- On Vercel, the proxy runs as a Node function instead of Edge. Check latency and cost.
- Re-run `e2e/opening-gate.spec.ts` (launch cookie, redirects), `csp-and-layout`, and the auth flows.

## 9. What gets removed after the upgrade

| Item | Location |
| --- | --- |
| Patch script and its types | `scripts/react-hydration-replay-fix.mjs`, `scripts/react-hydration-replay-fix.d.mts` |
| 4 npm hooks | `package.json`: `postinstall`, `predev`, `prebuild`, `postbuild` (`--verify-build`) |
| webpack cache key | `next.config.ts`: `webpack()` block + `import path` |
| Patch regression test | `tests/unit/react-hydration-replay.test.ts`. Recommendation: replace it with a slim test that runs the same replay race against Next's bundled React and expects a clean hydration, like the trial test. It would then catch a future Next upgrade that regresses the bug. |
| Release guard for the hooks | `tests/unit/release-guards.test.ts`: the `describe("hydration fix stays wired into install and build …")` block (added in the commits after the trial base; **it will fail as soon as the hooks are removed**) |
| Docs | `docs/HYDRATION_418.md` (status: fixed upstream by Next 16; patch removed; drop the "Maintenance risks" table and the "use `npm run build`, not `next build`" host rule); `docs/RELEASE_CANDIDATE.md` section I (P3 "Upgrade to Next 16" row); references in `docs/APP_OPTIMIZATION_REPORT.md` and `docs/TESTFLIGHT_STEPS.md` |
| Dev dependency | `@eslint/eslintrc` (ESLint config change, not the patch) |

Nothing else in the app depends on the patch: no application code changed for it.
