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

## Release flow

A CD run with `action: deploy` builds the SPA once and promotes that one build,
the same shape as the backend CD:

```
ci-gate → build → deploy-staging → smoke-staging → deploy-production (if deploy_prod)
```

1. `ci-gate` is read only and stops the run unless it is on `main` and the CI
   workflow (`ci.yml`) succeeded on a push for exactly this commit. If CI is
   still running, wait for it and start CD again. It also refuses inputs that do
   not fit together (for example `deploy_prod` with `infra_staging`).
2. `build` runs `npm run build -- --configuration production` once and uploads
   the output as the artifact `spa-<sha>`. Its job summary records the file
   count and a sha256 of a sorted manifest of every file. One build serves both
   environments because the app chooses its Cognito pool from the hostname at
   runtime (`src/app/core/auth/auth.config.ts`) and calls a same-origin `/api`.
3. `deploy-staging` downloads the artifact, checks its fingerprint, syncs it to
   the staging bucket and invalidates the staging distribution.
4. `smoke-staging` retries for up to three minutes until the staging site
   serves this build: `/` returns 200 and names this artifact's `main-*.js`, that
   bundle returns 200, the deep link `/progress` returns 200 through the SPA
   fallback, and `/api/v1/health` returns 200 with status `UP`.
5. `deploy-production` runs only when `deploy_prod` is ticked and
   `smoke-staging` succeeded in the same run. It downloads the same artifact,
   refuses it if the fingerprint differs from the one `build` recorded, syncs
   it to the prod bucket, invalidates the prod distribution and runs the same
   smoke test against production.

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
`actions: read`; `build` and `smoke-staging` need only `contents: read`; the
deploy jobs add `id-token: write` for OIDC.

## Repository variables

| Variable | Notes |
|---|---|
| `AWS_ROLE_ARN` | **Master gate.** IAM role ARN with the GitHub OIDC trust. Empty = CD dormant. |
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
gh variable set AWS_ROLE_ARN --repo WittySalt/fitsync-frontend --body "arn:aws:iam::<acct>:role/fitsync-frontend-deploy"
gh variable set S3_BUCKET_PROD --repo WittySalt/fitsync-frontend --body "<bucket>"
```
