# Making the repository private: checklist (updated 2026-11-24, not done)

Only the owner changes visibility. Nothing here has been changed. Prices and plan features below were read from
GitHub's and Vercel's documentation on 2026-11-24; check the pricing pages again on the day you decide.

## Why

The repository holds the app's source, design, legal drafts and engineering reports. While it is public, anyone can
read and copy them. Making it private stops new readers; it doesn't recall copies already made (the repository has
0 forks as of 2026-11-24).

## What changes, and what it costs

| Area | While public | After making it private | Cost to keep things working |
|---|---|---|---|
| **Branch protection / rulesets** ([GITHUB_PROTECTION.md](GITHUB_PROTECTION.md)) | Free | Need **GitHub Pro** | GitHub Pro (personal account): about $4 a month (check the price) |
| **"testflight" environment** (Apple key, branch rule) | Free | Need **GitHub Pro** | included in Pro |
| **Approval click on each TestFlight build** (required reviewer) | Free | Not available on Free or Pro (GitHub Enterprise only) | — The workflow's "only Joshfit77 can start it" rule and the branch rule still protect the key |
| **GitHub Actions** | Free | Billed against a monthly allowance: **$12 of compute on Free, $18 on Pro** ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Mac machines cost about **$0.062 a minute** ([runner pricing](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/actions-minute-multipliers)) | One iOS "checks" run (about 34 Mac minutes) ≈ $2; one TestFlight build (20–30 Mac minutes) ≈ $1.25–1.90. $12 covers about 5 checks runs or 6–9 TestFlight builds a month. Set a budget: Settings → Billing → Budgets → Actions, with "Stop usage when budget limit is reached" |
| **Vercel (staging website)** | Hobby (free) works | On Hobby, only the owner's own commits deploy ([Vercel](https://vercel.com/docs/deployments/troubleshoot-project-collaboration)) | Either merge every change yourself with **Create a merge commit** (your commit, so it deploys), or Vercel Pro ($20 a month, plus a seat for each person whose commits must deploy) |
| **Claude Code** | Works | Works while the Claude GitHub App keeps access to the repository | Free. If a session can't reach the repository: claude.ai/connect-github, check the app's repository access |
| GitHub secret-scanning alerts | Free | Paid add-on for private personal repositories | The repository's own gitleaks check in CI keeps running |
| Dependabot alerts | Free | Free | — |
| Stars and watchers | Kept | Removed by GitHub | — |
| Android test download (`android-latest` release) | Anyone | Signed-in collaborators only | — |

## Checklist (in this order)

1. **Decide on GitHub Pro.** Without it, a private repository loses branch rules and the protected Apple key
   environment. Recommended: buy Pro the same day (github.com → Settings → Billing and plans → Plans → GitHub Pro).
2. **Set an Actions budget** (Settings → Billing → Budgets) with "stop at limit", so nothing is billed by surprise.
3. **Vercel:** decide "I merge everything myself with merge commits" (free) or Vercel Pro.
4. **Check collaborators** (Settings → Collaborators): today `Joshfit77` (owner) and `desourich-creator` (write).
   Confirm `desourich-creator` is John.
5. **Make it private:** Settings → General → Danger Zone → **Change visibility** → **Make private** → type the
   repository name.
6. **Afterwards, check:**
   - the ruleset still shows Active (Settings → Rules) and the `testflight` environment still has its branch rule
     and 4 secrets;
   - John (signed in as `desourich-creator`) can still open the repository;
   - Actions → run **CI** by hand on `claude/rc-testflight-1`: it should go green;
   - a new Claude Code session can open the repository.
7. **Tell your attorney** from which date the legal, trademark and patent documents were public.

## Giving an independent developer access (least privilege)

A repository on a personal account can't give "read-only" or "triage" roles; a collaborator gets write access. So
the protection comes from the branch rules, the protected Apple environment and keeping owner accounts to yourself:

1. **GitHub:** Settings → Collaborators → **Add people** → their GitHub username. They can push their own branches
   and open pull requests; the ruleset stops them changing `main` or the release branch directly, and only you can
   start a TestFlight build. Never make them an admin, and never add them as a reviewer of the `testflight`
   environment.
2. **Supabase:** invite them to the **staging** project's organization with the **Developer** role (or Read-only),
   never Owner, and never to a future production project unless needed. Don't send them the secret key by chat or
   email: they can run everything locally with `npx supabase start`.
3. **Vercel:** not needed: they work locally and in pull requests. Add them only if you buy Pro seats.
4. **Apple:** add them to App Store Connect only if they must test builds, with the **Developer** role (not Admin);
   never share the `.p8` key.
5. **Claude Code / other AI tools:** they use their own accounts.
6. **When they finish:** remove them from GitHub, Supabase (and Apple); rotate any secret they ever saw (if the steps
   above were followed, none).
