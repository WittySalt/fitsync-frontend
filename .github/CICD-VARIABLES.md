# GitHub Actions — CI/CD variables & secrets

GitHub Actions is the only CI/CD for this repo (the old GitLab CI/CD has been retired).

- **CI** (`ci.yml`) needs **no** variables or secrets — green out of the box
  (typecheck, headless-Chrome unit tests + coverage, production build, gitleaks
  secret scan). SAST is via SonarCloud; GitHub CodeQL is not wired up because code
  scanning on a private repo requires GitHub Advanced Security.
- **CD** (`cd.yml`) is **dormant** until the `AWS_ROLE_ARN` *repository variable* is
  set. AWS auth uses **GitHub OIDC**: the role in `AWS_ROLE_ARN` must trust
  `token.actions.githubusercontent.com` for the subjects
  `repo:WittySalt/fitsync-frontend:ref:refs/heads/main` and
  `repo:WittySalt/fitsync-frontend:environment:staging|production`. Deploys are
  manual (Actions → Run workflow). See "IAM for CD" below for what the role needs.

Set under **Settings → Secrets and variables → Actions**.

## Release flow

A CD run builds the SPA once and promotes that one build, the same shape as the
backend CD:

```
ci-gate → build → deploy-staging → deploy-production (if deploy_prod)
```

The inputs are `deploy_prod`, `skip_staging` and `skip_reason`. CD changes no
infrastructure: the staging and prod Terraform workspaces are planned and
applied by an operator (see [`infra/terraform/RUNBOOK.md`](../infra/terraform/RUNBOOK.md)).

1. `ci-gate` is read only and stops the run unless it is on `main` and the CI
   workflow (`ci.yml`) succeeded on a push for exactly this commit. If CI is
   still running, wait for it and start CD again. It also refuses inputs that do
   not fit together (`skip_staging` without `deploy_prod`, or without a
   `skip_reason`).
2. `build` runs `npm run build -- --configuration production` once and uploads
   the output as the artifact `spa-<sha>`. Its job summary records the file
   count and a sha256 of a sorted manifest of every file. One build serves both
   environments because the app chooses its Cognito pool from the hostname at
   runtime (`src/app/core/auth/auth.config.ts`) and calls a same-origin `/api`.
3. `deploy-staging` downloads the artifact, checks its fingerprint, syncs it to
   the staging bucket, invalidates the staging distribution and, as its last
   step, smoke-tests staging in **gate** mode (see below).
4. `deploy-production` runs only when `deploy_prod` is ticked and
   `deploy-staging` succeeded in the same run. It downloads the same artifact,
   refuses it if the fingerprint differs from the one `build` recorded, syncs
   it to the prod bucket, invalidates the prod distribution and smoke-tests
   production in **warn** mode.

### Smoke test

`.github/scripts/smoke-spa.sh <gate|warn> <url> <dist-dir> [timeout]` retries
each check for up to 180 s so the CloudFront invalidation can land.

| Check | Staging (`gate`) | Production (`warn`) |
|---|---|---|
| `/` returns 200 and names this artifact's `main-*.js` | blocks | warns |
| that `main-*.js` returns 200 | blocks | warns |
| `/progress` returns 200 through the SPA fallback and names the same bundle | warns | warns |
| `/api/v1/health` returns 200 with status `UP` | warns | warns |

A blocking failure fails `deploy-staging`, so production is not deployed. A
warning is shown as a `::warning::` annotation and listed under a ⚠️ line in the
job summary, and the job stays green. The health check only warns because the
SPA can be correct while the backend is down. Production only warns because its
files are already live when the test runs, so failing the job would undo nothing.

Leaving `deploy_prod` unticked deploys staging only. A later run with
`deploy_prod` ticked builds again and goes through staging again; production is
never fed from an earlier run.

The only way to production without staging is break-glass: tick `deploy_prod`
and `skip_staging` and fill in `skip_reason`. An empty reason fails `ci-gate`.
The reason, the commit and who started the run are written to the run summary.
The `ci-gate` checks always apply.

The run is titled after the action and its targets, for example
`CD deploy → staging → production @ <sha>`. Every job writes the commit, who
started it and its result to the job summary. Only one CD run per ref runs at a
time (`concurrency: cd-<ref>`, queued runs wait). The gate needs only
`actions: read`; `build` needs only `contents: read`; the deploy jobs add
`id-token: write` for OIDC.

## IAM for CD

With no Terraform in CD, the deploy needs only:

| Action | Resource |
|---|---|
| `s3:ListBucket` | `arn:aws:s3:::fitsync-staging-frontend-437659978621`, `arn:aws:s3:::fitsync-frontend-prod` |
| `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject` | the same two buckets, `/*` |
| `cloudfront:CreateInvalidation`, `cloudfront:GetInvalidation` | `arn:aws:cloudfront::437659978621:distribution/EE1XAW2NAZ576` (staging) and `arn:aws:cloudfront::437659978621:distribution/E1APOLMHRQOW5Y` (prod) |

`AWS_ROLE_ARN` currently points at `fitsync-github-cd`, which the backend
bootstrap Terraform (`backend/infra/terraform/bootstrap/main.tf`) defines with
`PowerUserAccess` and shares with the backend CD. Narrowing it would break the
backend CD, so the least-privilege setup is a separate frontend-only role in the
bootstrap, trusted only by this repository's `main` branch and its `staging` and
`production` environments, with the policy above. Once that role exists, point
`AWS_ROLE_ARN` at it and drop this repository from the trust of
`fitsync-github-cd`.

## Repository variables

| Variable | Notes |
|---|---|
| `AWS_ROLE_ARN` | **Master gate.** IAM role ARN with the GitHub OIDC trust (see "IAM for CD"). Empty = CD dormant. |
| `AWS_REGION` | e.g. `ap-southeast-1` |
| `S3_BUCKET_STAGING` | staging SPA bucket |
| `S3_BUCKET_PROD` | production SPA bucket |
| `CLOUDFRONT_DISTRIBUTION_ID_STAGING` | optional; invalidation skipped if unset |
| `CLOUDFRONT_DISTRIBUTION_ID` | optional; prod invalidation skipped if unset |
| `STAGING_SITE_URL` | optional; the staging smoke test target, default `https://staging.fitsyncapp.click` |
| `PROD_SITE_URL` | optional; the production smoke test target, default `https://fitsyncapp.click` |

## Secrets

None required — deploy uses OIDC, and CI needs no secrets.

## Quick set with `gh`

```bash
gh variable set AWS_REGION   --repo WittySalt/fitsync-frontend --body "ap-southeast-1"
gh variable set AWS_ROLE_ARN --repo WittySalt/fitsync-frontend --body "arn:aws:iam::<acct>:role/<frontend deploy role>"
gh variable set S3_BUCKET_PROD --repo WittySalt/fitsync-frontend --body "<bucket>"
```
