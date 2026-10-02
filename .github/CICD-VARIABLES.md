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
