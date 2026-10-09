# GitHub Actions — CI/CD variables & secrets

GitHub Actions is the only CI/CD for this repo (the old GitLab CI/CD has been retired).

- **CI** (`ci.yml`) needs **no** variables or secrets — green out of the box
  (typecheck, headless-Chrome unit tests + coverage, production build, gitleaks
  secret scan). SAST is via SonarCloud; GitHub CodeQL is not wired up because code
  scanning on a private repo requires GitHub Advanced Security.
- **CD** (`cd.yml`) is **dormant** until the `AWS_ROLE_ARN` *repository variable* is
  set. AWS auth uses **GitHub OIDC** — the `fitsync-frontend-deploy` IAM role must
  trust `token.actions.githubusercontent.com` with subject
  `repo:WittySalt/fitsync-frontend:*`. Deploys are manual (Actions → Run workflow).

Set under **Settings → Secrets and variables → Actions**.

## Release gates

Every CD job waits for the read-only `ci-gate` job, which follows the same rules
as the backend CD:

1. The run must be on `main`; any other ref is refused.
2. The CI workflow (`ci.yml`) must have succeeded on a push for exactly the commit
   being deployed. If CI is still running, wait for it and start CD again.
3. `deploy_production` also needs the same commit on staging first: an earlier CD
   run on `main` for that commit must have a `deploy-staging` job that succeeded.
   The gate reads the jobs of past CD runs through the Actions API, so the normal
   order is `deploy_staging`, check staging, then `deploy_production` on the same
   commit. The job name `deploy-staging` is part of this check and must not be
   renamed.

The only way past rule 3 is break-glass: tick `skip_staging` and fill in
`skip_reason`. An empty reason fails the run. The reason, the commit and who
started the run are written to the run summary. Rules 1 and 2 always apply.

Each run is titled `CD <action> @ <sha>`, and every deploy writes the action, the
commit and the result to its job summary. The gate needs only `actions: read`;
the deploy jobs keep `id-token: write` for OIDC and `contents: read`.

## Repository variables

| Variable | Notes |
|---|---|
| `AWS_ROLE_ARN` | **Master gate.** IAM role ARN with the GitHub OIDC trust. Empty = CD dormant. |
| `AWS_REGION` | e.g. `ap-southeast-1` |
| `S3_BUCKET_STAGING` | staging SPA bucket |
| `S3_BUCKET_PROD` | production SPA bucket |
| `CLOUDFRONT_DISTRIBUTION_ID_STAGING` | optional; invalidation skipped if unset |
| `CLOUDFRONT_DISTRIBUTION_ID` | optional; prod invalidation skipped if unset |

## Secrets

None required — deploy uses OIDC, and CI needs no secrets.

## Quick set with `gh`

```bash
gh variable set AWS_REGION   --repo WittySalt/fitsync-frontend --body "ap-southeast-1"
gh variable set AWS_ROLE_ARN --repo WittySalt/fitsync-frontend --body "arn:aws:iam::<acct>:role/fitsync-frontend-deploy"
gh variable set S3_BUCKET_PROD --repo WittySalt/fitsync-frontend --body "<bucket>"
```
