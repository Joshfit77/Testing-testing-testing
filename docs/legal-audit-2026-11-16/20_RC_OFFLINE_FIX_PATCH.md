# 20. Release-candidate offline fix: the proposed patch and its verification

Date: 2026-11-16. **Not merged.** The fix is on its own branch, `claude/rc-offline-fix` (commit `8ea238f`), cut from
`release/testflight-rc-2026-11-15` at `56500ff`. The release candidate itself is unchanged. The patch file is
`rc-offline-fix.patch` beside this document.

## What it fixes

When the rejected Home pictures were removed (`56500ff`), the service worker still asked for those seven files at
install. Some of those requests never finished, so the worker never installed, and offline use (the saved Bible, the
offline page) stopped working. This is on the release candidate today.

## What the patch contains

Two files, 14 lines added and 6 removed. Nothing from Friends & Challenges.

| File | Change |
|---|---|
| `public/sw.js` | The list of Home pictures to store offline is empty until the photographs exist; cache version `ngf-v2` to `ngf-v3` so installed copies update |
| `tests/unit/home-backgrounds.test.ts` | The test now requires the list to be empty while the photographs are not ready, and to name all seven once they are |

`git diff --stat release/testflight-rc-2026-11-15 claude/rc-offline-fix` shows only those two files.

## Verification, run on the release-candidate copy with only this patch applied

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npx eslint .` | Clean |
| Unit suite | 256 files; 4,713 passed, 1 skipped |
| Production build | Built |
| Offline and service-worker browser tests (`e2e/bible-reader.spec.ts`, `e2e/home-backgrounds.spec.ts`) | 6 passed, 2 skipped (the two that wait for photographs). Both offline Bible tests pass; before the patch they timed out |
| Whole browser suite (`--project mobile`, stand-ins for the AI provider and food database) | 147 passed, 101 skipped, 0 failed |
| Integration suite | Not re-run for this patch: it changes no server or database code |
| On a physical phone | Not tested |

## To apply, once approved

```
git checkout release/testflight-rc-2026-11-15
git merge --ff-only claude/rc-offline-fix
```

or `git cherry-pick 8ea238f`. When the seven photographs are added later, restore the list in `public/sw.js` as its comment
describes and raise the version again.
