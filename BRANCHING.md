# FitSync Frontend — Branching & Trunk Rules (authoritative)

> Binding for every human and AI agent (Codex, Claude) touching `frontend/`.
> Read this before creating a branch, a worktree, or a merge. It exists because the
> repo drifted into parallel branches cut from different/stale bases, with work left
> uncommitted in worktrees — which makes merges dangerous.

## 1. Trunk
- **`main` is the single integration trunk.** All feature work merges back into it.
- Trunk must always be the *real, current app*. It is **not** allowed to lag behind
  the shipped feature state.

> **Current reality (2026-06-19):** on the GitLab remote the lines have **diverged** —
> `origin/main` (`56c4fbc`) and `origin/frontend-design-token-adoption` (`5e9e913`,
> the real app: auth/onboarding redesign, account center, nutrition/workout, design
> tokens FE-1/2/3, charts FE-4) share no common ancestor and have forked. They must
> be reconciled via a **Merge Request on GitLab**, never by moving `main` locally.
> Until that reconciliation lands, treat `frontend-design-token-adoption` as the
> integration base for new frontend feature branches and open MRs **against it**.

## 2. Always branch from up-to-date `main`
```bash
git checkout main
git pull --ff-only            # or: git fetch && git merge --ff-only origin/main
git checkout -b frontend-<ticket>-<slug>   # e.g. frontend-fe12-goal-onboarding
```
- **Never** branch from an arbitrary or old commit. If you use `git worktree`, the
  base still must be current `main`:
```bash
git worktree add ../frontend-<ticket> -b frontend-<ticket>-<slug> main
```
- Before starting work, prove the base is correct:
```bash
git merge-base --is-ancestor main HEAD && echo OK-base    # must print OK-base
```

## 3. Branch naming
`frontend-<ticket-id>-<short-slug>` — e.g. `frontend-fe11-profile-overview`,
`frontend-fe19-guided-training`. One ticket per branch/worktree.

## 4. A ticket is not done until it is COMMITTED on its branch
- The recurring failure mode here: an agent reports "done / tests pass" but leaves
  everything as **uncommitted worktree state**. That is **not done**.
- Definition of done: changes committed on the feature branch, `npm run build`
  passes, tests run, summary written. Protected files
  (`package-lock.json`, `angular.json` beyond an approved diff) untouched per root
  `AGENTS.md`.

## 5. Integrate via `--no-ff`, after rebasing if trunk moved
```bash
git checkout frontend-<ticket>-<slug>
git rebase main            # resolve conflicts here, on the feature branch
git checkout main
git merge --no-ff frontend-<ticket>-<slug>
```
- Resolve conflicts on the feature branch (rebase), never by improvising on `main`.

## 6. Before ANY merge or history op, look at the graph
```bash
git log --oneline --graph --all -30
git status        # both the target worktree AND any sibling worktrees must be clean
```
- If a worktree is dirty, commit/stash it **before** branch operations. Never discard
  uncommitted work you did not create without explicit owner confirmation.

## 7. Pushing
- Pushing `main` to `origin` is outward-facing — only on explicit owner approval.
- Feature branches may be pushed for review/CI.

## TL;DR for Codex
Branch from current `main` → name it `frontend-<ticket>-<slug>` → **commit your work
on that branch** (build + tests) → `git rebase main` → owner merges `--no-ff`.
Never start from a stale base; never leave work uncommitted in a worktree.
