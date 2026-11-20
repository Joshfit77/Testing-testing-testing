# Making the repository private: what changes (prepared 2026-11-20, not done)

Only the owner changes visibility. Nothing here has been changed.

## Who keeps access

Making a repository private removes access for everyone except its collaborators. Today (read from GitHub,
2026-11-20) those are:

| GitHub account | Access | Keeps it after the change |
|---|---|---|
| `Joshfit77` | Owner (admin) | Yes |
| `desourich-creator` | Write | Yes (**confirm this account is John's**) |

No branch is protected today, so no protection rule is lost. Any copy someone made while the repository was public
(a fork or a clone) is not recalled: a public fork stays public. Check the **Forks** count on the repository page.
The legal, trademark and patent documents have been public until now; tell your attorney from when.

## GitHub Actions cost

Public repositories use GitHub's standard runners free. Private ones draw on the account's monthly allowance:
**2,000 minutes on GitHub Free (3,000 on Pro)**; a Linux minute counts once, a **macOS minute counts 10 times**, and
every job is rounded up to a whole minute. When the allowance is used up, GitHub stops running jobs until the next
month unless paid usage has been set up (Settings → Billing). Sources: GitHub's
[Actions billing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
and [how use is measured](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Measured on this repository's own recent runs:

| Run | Machines | Counted minutes |
|---|---|---|
| CI (checks, integration, security scan) | 3 Linux jobs, ~12 min | **~12** |
| iOS `checks` | 3 macOS jobs (7 + 7 + 20 min) + 1 Linux (7) | **~347** |
| iOS `testflight` | 1 macOS job; not yet run, estimated 10–30 min | **~100–300** (estimate) |

So 2,000 minutes cover about **five iOS checks runs**, or one TestFlight build plus a few checks runs, or about
160 CI runs. A month with one or two TestFlight builds fits; a week of pushes that each start iOS checks does not.

## What starts runs, and what was changed

| Trigger | Starts | Status |
|---|---|---|
| Push to `claude/rc-testflight-1` | nothing | (RC workflows run on `main` and `release/**` only) |
| Push to `main` or `release/**` | CI (~12), plus iOS checks (~347) when app files changed | as designed: release branches get the full check |
| Pull request | CI (~12) | as designed |
| Push to `claude/sharp-cray-8y0uuv` | iOS checks (~347), from that branch's older workflow | **avoid pushing there once private**; the RC replaces it |
| Billing reconciliation schedule (every 30 min, only once on `main`) | was 1 job per run, ~1,440 a month even while switched off | **fixed**: the job is now skipped until the owner sets it up |
| iOS `testflight`, Android, data-file workflows | only when started by hand (or narrow file changes) | — |

## Other things that change

- **Vercel Hobby** deploys only the owner's own commits from a private repository; commits by Claude or John are
  blocked ("Hobby Plan does not support collaboration for private repositories"). Use Vercel Pro for the staging
  project, or keep the repository public until it is set up. See the TestFlight guide, step 13.
- The Android test download in `docs/INSTALL.md` (the `android-latest` release page) only opens for signed-in
  collaborators.
- GitHub's own secret-scanning alerts on private personal repositories need a paid add-on. The repository's own
  gitleaks check (CI, every branch and full history) keeps running regardless.
- Dependabot alerts and update pull requests keep working.
- GitHub warns that stars and watchers are removed when a repository is made private.

## How (owner, when approved)

github.com → the repository → **Settings** → **General** → scroll to **Danger Zone** → **Change visibility** →
**Make private** → type the repository name to confirm. Then open the repository signed in as John's account to
check he still sees it.
