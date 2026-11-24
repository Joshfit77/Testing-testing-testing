# Protecting the release on GitHub (owner steps)

Written 2026-11-24. Plain steps; about 15 minutes. GitHub's menus can be worded slightly differently; look for the
nearest match. None of this costs money while the repository is **public**. For a **private** repository, see the
last section.

## 1. Protect `main` and the release branch (a ruleset)

Why: the website (and so the iPhone app) updates by itself from the release branch, so nobody should be able to
overwrite or delete it, and every change should pass the tests first.

1. github.com → the repository → **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. **Ruleset name:** `Release branches`. **Enforcement status:** **Active**.
3. **Bypass list:** **Add bypass** → **Repository admin** (that's you, for emergencies only).
4. **Target branches:** **Add target** → **Include by pattern** → `main`; again → `claude/rc-testflight-1`
   (later also `release/*`).
5. **Rules**, tick:
   - **Restrict deletions**;
   - **Block force pushes**;
   - **Require a pull request before merging**, with **Required approvals: 0** (you can't approve your own pull
     request, and you're the only reviewer);
   - **Require status checks to pass** → **Add checks** → `checks`, `integration` and `security-scan` (from the "CI"
     workflow).
6. **Create**.

*You'll know it worked* when the ruleset is listed as Active with 2 targets. From then on, changes reach the release
branch through a pull request that you merge once its checks are green, including Claude's.

## 2. GitHub Actions settings

github.com → the repository → **Settings** → **Actions** → **General**:

- **Workflow permissions:** **Read repository contents and packages permissions**; untick **Allow GitHub Actions to
  create and approve pull requests**. Save. (Each workflow already asks only for read access; this makes it the
  default too.)
- **Fork pull request workflows from outside collaborators:** **Require approval for all external contributors**.
- If offered: **Require actions to be pinned to a full-length commit SHA**: tick it (every workflow already does).

## 3. The "testflight" environment (Apple key)

Set up in [TESTFLIGHT_FIRST_BUILD_GUIDE.md](../TESTFLIGHT_FIRST_BUILD_GUIDE.md), step 15: required reviewer = you,
deployment branch = `claude/rc-testflight-1`, four `TF_…` environment secrets, and no Apple secrets at repository
level. The TestFlight job also runs only when you (Joshfit77) start it.

## 4. If the repository becomes private: what still works

Checked against GitHub's documentation on 2026-11-24 ([rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets),
[protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches),
[environments](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)).
Confirm on GitHub's pricing page before deciding.

| Protection | Public (any plan) | Private, GitHub Free | Private, GitHub Pro |
|---|---|---|---|
| Rulesets / protected branches (section 1) | Yes | **No** | Yes |
| Environment `testflight` with its own secrets and branch rule | Yes | **No** | Yes |
| Required reviewer on the environment (approve each build) | Yes | No | **No** (GitHub Enterprise only) |
| "Only Joshfit77 can start the TestFlight job" (in the workflow) | Yes | Yes | Yes |
| Actions settings (section 2) | Yes | Yes | Yes |

So a private repository needs **GitHub Pro** to keep the branch rules and the protected Apple key. The approval click
is lost, but the key still can't leave the release branch, only you can start a build, and nobody can change the
release branch without a pull request you merge.
