# Frontend infrastructure (Terraform)

Owns the **frontend** AWS resources only — the SPA S3 bucket and its CloudFront
distribution. Backend infra (VPC, ALB, EC2, RDS, ECR, Cognito, media S3) stays in
the backend repo's `infra/terraform/`. Separate state ⇒ separate blast radius.

| | |
|---|---|
| State | `s3://fitsync-tfstate-437659978621/env:/<workspace>/fitsync/frontend/terraform.tfstate` |
| Workspaces | `staging` (run now), `prod` (reserved — prod FE is hand-built) |
| Prod domain | separate root `infra/terraform-prod-domain/` (own state key, no workspaces); see "Prod custom domain" below |
| Shared (not owned here) | **Cognito** lives in the backend state; the SPA only *references* the pool/client IDs, which are set per environment in `src/app/core/auth/auth.config.ts`. The `/api/*` CloudFront origin is the backend **ALB** (`api_origin_domain`, the backend's `alb_dns_name` output; `api_origin_port`, default 80; 60 s read timeout so the streamed coach answer is not cut off at CloudFront's 30 s default). These are plain variables, so there is no hard cross-stack dependency. |

## Normal use (staging)

```bash
cd infra/terraform
terraform init
terraform workspace select staging || terraform workspace new staging
terraform plan  -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
# … demo …
terraform destroy -var-file=staging.tfvars   # stop the bill (CloudFront esp.)
```

`enable_cloudfront=false` keeps it to the (near-free) S3 bucket; flip to `true`
for the full SPA distribution.

### Through the CD workflow

The CD workflow (Actions → CD → Run workflow on `main`) can run the same apply
with `action: infra_staging`, and it deploys the SPA with `deploy_staging` and
`deploy_production`. Every action first passes `ci-gate`: the commit must be on
`main` with a successful CI push run. `deploy_production` also requires an earlier
successful `deploy_staging` run for the same commit, unless `skip_staging` is
ticked with a `skip_reason`, which is recorded in the run summary. The full rules
are in [`.github/CICD-VARIABLES.md`](../../.github/CICD-VARIABLES.md).

## Custom domain (staging.fitsyncapp.click)

Staging is served at **https://staging.fitsyncapp.click**. The old
https://d1z92tpb353lfi.cloudfront.net keeps working, because CloudFront always
answers on its own `*.cloudfront.net` name as well as its aliases.

Set by `custom_domain` in `staging.tfvars` (empty = nothing is created; `prod.tfvars`
leaves it empty because prod is hand-built). `domain.tf` then creates:

- an ACM certificate in **us-east-1** (CloudFront only accepts certificates from
  there) through the `aws.us_east_1` provider alias, validated by DNS;
- the validation CNAME records and `aws_acm_certificate_validation`, which waits
  until ACM has issued the certificate;
- `aliases` and an SNI `viewer_certificate` (TLSv1.2_2021) on the distribution,
  an in-place update with no replacement;
- `A` and `AAAA` alias records for the hostname pointing at the distribution.

**The hosted zone `fitsyncapp.click` (`Z03373831R8G5N1TEF6LB`) is owned by the
backend bootstrap Terraform**, not by this stack. It is only looked up here
(`data "aws_route53_zone"`, name from `hosted_zone_name`). Never import or manage
the zone in this state.

**Apply order:**
1. Backend bootstrap first, so the zone exists and the registrar points at its
   name servers.
2. Then this stack:
   ```powershell
   cd infra/terraform
   terraform init
   terraform workspace select staging
   terraform plan -var-file="staging.tfvars" "-out=staging-domain.tfplan"
   terraform apply staging-domain.tfplan
   ```
   Expect only additions (cert, validation record, cert validation, two alias
   records) and an in-place update of the distribution. Certificate validation
   usually takes a few minutes; the distribution update another 5-15 minutes.
3. The SPA picks the staging Cognito pool on this host (`STAGING_HOSTS` in
   `src/app/core/auth/auth.config.ts`). Cognito callback URLs only matter for the
   hosted UI; the password sign-in flow needs no change on the pool.

## Prod custom domain (fitsyncapp.click and www.fitsyncapp.click)

Prod serves on **https://fitsyncapp.click** and **https://www.fitsyncapp.click**.
Both names are aliases on the existing hand-built prod distribution
`E1APOLMHRQOW5Y` (https://d26vi6hikexzev.cloudfront.net, which keeps working),
and one ACM certificate covers both.

The prod distribution is not in any Terraform state, and this stack's `prod`
workspace must not be applied against it. The domain therefore has its own small
root, `infra/terraform-prod-domain/`, with its own state key
(`fitsync/frontend-prod-domain/terraform.tfstate` in the same tfstate bucket, no
workspaces). It only **reads** the distribution (`data "aws_cloudfront_distribution"`)
and the hosted zone, and creates:

| Phase | Resources |
|---|---|
| 1 (`create_alias_records = false`) | ACM certificate in us-east-1 for `fitsyncapp.click` with SAN `www.fitsyncapp.click`, its two DNS validation CNAMEs, `aws_acm_certificate_validation` |
| 2 (`create_alias_records = true`) | `A` and `AAAA` alias records for the apex and `www`, pointing at the distribution |

The aliases and the certificate are put on the distribution between the two
phases by `infra/terraform-prod-domain/attach-prod-domain.ps1`, which changes only
`Aliases` and `ViewerCertificate` (SNI, `TLSv1.2_2021`) and sends every other field
back as CloudFront returned it. It is a dry run unless `-Apply` is passed, and it
saves the current config to `backups/` first (git-ignored), which is the rollback.

**Why this order.** CloudFront refuses an alias unless an issued certificate on
the distribution covers it, so the certificate comes first. DNS comes last,
because a record that points a name at a distribution which does not list it as
an alias gives users a CloudFront error. Phase 2 has preconditions that fail the
plan unless the distribution already lists each name and is `Deployed`.

The SES records in the zone (DKIM, `mail.`, `_dmarc`) are not touched. The zone has
no apex or `www` record and no CAA record today, so nothing is overwritten and ACM
is free to issue.

### Before you start

1. **Backend CORS first.** CloudFront forwards the browser's `Origin` to the
   gateway, and the gateway rejects origins it does not list with 403, which the
   distribution serves as the SPA's `index.html`. Every POST from the new names
   would fail. Merge the backend PR that adds both origins to the gateway's default
   allowlist and deploy it to prod (backend CD, `deploy_prod`). Check:
   ```powershell
   curl.exe -s -i -X OPTIONS https://d26vi6hikexzev.cloudfront.net/api/v1/auth/bootstrap `
     -H "Origin: https://fitsyncapp.click" -H "Access-Control-Request-Method: POST"
   ```
   Expect `Access-Control-Allow-Origin: https://fitsyncapp.click`, not `text/html`.
2. **Frontend.** Merge this repo's PR and deploy the SPA to prod (CD
   `deploy_staging`, then `deploy_production` on the same commit). `auth.config.ts`
   lists the apex, `www` and the CloudFront name in `PROD_HOSTS`, so all three use
   the prod Cognito pool. Sign-in is direct `InitiateAuth`, so no callback URL is
   added on the pool.
3. Credentials with ACM (us-east-1), Route 53 and CloudFront rights, account
   437659978621.

### Phase 1: certificate

```powershell
cd infra/terraform-prod-domain
terraform init
terraform plan -var-file="prod.tfvars" "-out=phase1.tfplan"
terraform apply phase1.tfplan
terraform output certificate_arn
```

Expect **4 to add, 0 to change, 0 to destroy** (certificate, two validation
records, certificate validation). The apply waits until ACM has issued the
certificate, usually a few minutes.

### Attach the aliases and the certificate

```powershell
.\attach-prod-domain.ps1           # dry run: shows current and new Aliases/ViewerCertificate
.\attach-prod-domain.ps1 -Apply    # update-distribution with the ETag it just read
aws cloudfront wait distribution-deployed --id E1APOLMHRQOW5Y
```

The script reads the certificate ARN from `terraform output`, and refuses to run
unless the certificate is `ISSUED` in us-east-1 and covers both names. Note the
backup file name it prints, for example
`backups\E1APOLMHRQOW5Y-20261009-120000.json`.

Before any DNS exists, check the distribution already serves the names with the new
certificate by connecting to the CloudFront name directly:

```powershell
curl.exe -sI https://fitsyncapp.click/ --connect-to fitsyncapp.click:443:d26vi6hikexzev.cloudfront.net:443
curl.exe -sI https://www.fitsyncapp.click/ --connect-to www.fitsyncapp.click:443:d26vi6hikexzev.cloudfront.net:443
```

Both should answer `HTTP/1.1 200 OK` with no certificate error.

### Phase 2: DNS

Set `create_alias_records = true` in `infra/terraform-prod-domain/prod.tfvars` and
keep it that way (commit that one-line change afterwards).

```powershell
terraform plan -var-file="prod.tfvars" "-out=phase2.tfplan"
terraform apply phase2.tfplan
```

Expect **4 to add, 0 to change, 0 to destroy** (A and AAAA for the apex and `www`).
If the plan stops on a precondition, the attach step has not finished; wait for
`Deployed` and plan again.

### Verify

```powershell
Resolve-DnsName fitsyncapp.click -Type A -Server 8.8.8.8
Resolve-DnsName fitsyncapp.click -Type AAAA -Server 8.8.8.8
Resolve-DnsName www.fitsyncapp.click -Type A -Server 8.8.8.8
# or: dig +short fitsyncapp.click A; dig +short www.fitsyncapp.click AAAA
curl.exe -sI https://fitsyncapp.click/
curl.exe -sI https://www.fitsyncapp.click/
curl.exe -sI http://fitsyncapp.click/            # 301 to https
curl.exe -s -i -X OPTIONS https://fitsyncapp.click/api/v1/auth/bootstrap `
  -H "Origin: https://fitsyncapp.click" -H "Access-Control-Request-Method: POST"
curl.exe -sI https://d26vi6hikexzev.cloudfront.net/   # old name still 200
```

Then sign in on `https://fitsyncapp.click` in a browser and save something (a POST),
to confirm the gateway accepts the origin. Sessions are stored per origin, so a
user signed in on the CloudFront name signs in again on the new domain.

### Rollback

Undo in reverse order, and only as far as needed.

1. **DNS only** (the names stop resolving; the CloudFront name is unaffected): set
   `create_alias_records = false`, then
   `terraform apply -var-file="prod.tfvars"`. Expect 4 to destroy.
2. **Distribution**: put back the config saved by the attach step:
   ```powershell
   .\attach-prod-domain.ps1 -RestoreFrom .\backups\E1APOLMHRQOW5Y-<stamp>.json          # dry run
   .\attach-prod-domain.ps1 -RestoreFrom .\backups\E1APOLMHRQOW5Y-<stamp>.json -Apply
   aws cloudfront wait distribution-deployed --id E1APOLMHRQOW5Y
   ```
   Use the **first** backup, taken before `-Apply`. If `backups/` is lost, get the
   config, set `Aliases` to `{"Quantity": 0}` and `ViewerCertificate` to
   `{"CloudFrontDefaultCertificate": true, "MinimumProtocolVersion": "TLSv1"}`, and
   call `update-distribution` with the ETag.
3. **Certificate**: `terraform destroy -var-file="prod.tfvars"`, only after step 2,
   because ACM will not delete a certificate a distribution still uses.

The backend CORS change can stay: an extra allowed origin that nobody serves does
no harm.

## History: one-time split out of the backend state (done, June 2026)

> Kept for reference only. This ran once, when the frontend resources moved out of
> the backend state. Do not run it again.

These four resources lived in the **backend** staging state and were moved here
**once**. CloudFront did not exist in staging yet at the time (`enable_cloudfront`
was false), so only the S3 resources moved. Do the backend `state rm` and the
backend config removal **together** — if the blocks stay in backend config after
`state rm`, the next backend apply recreates them; if they stay in state after the
config is removed, the next backend apply **destroys** them.

**1. Remove from backend state (keeps the real AWS resources):**
```bash
cd backend/infra/terraform
terraform workspace select staging
terraform state rm \
  aws_s3_bucket.frontend \
  aws_s3_bucket_website_configuration.frontend \
  aws_s3_bucket_public_access_block.frontend \
  aws_s3_bucket_policy.frontend_public_read
```

**2. Delete the frontend blocks from backend config (same change):**
- `backend/infra/terraform/storage.tf` — delete the "frontend SPA bucket" +
  "CloudFront for the SPA" sections (the 5 `*.frontend` / `frontend_public_read`
  resources).
- `backend/infra/terraform/outputs.tf` — delete `frontend_bucket` and
  `cloudfront_domain` outputs.
- `backend/infra/terraform/variables.tf` — delete the now-unused `enable_cloudfront`
  variable, and drop it from `backend/infra/terraform/staging.tfvars`/`prod.tfvars`.
Then `terraform plan -var-file=staging.tfvars` in backend — expect **no changes**.

**3. Import into this (frontend) state:**
```bash
cd infra/terraform
terraform init
terraform workspace new staging   # or: terraform workspace select staging
B=fitsync-staging-frontend-437659978621
terraform import aws_s3_bucket.frontend                    "$B"
terraform import aws_s3_bucket_website_configuration.frontend "$B"
terraform import aws_s3_bucket_public_access_block.frontend   "$B"
terraform import aws_s3_bucket_policy.frontend_public_read    "$B"
terraform plan -var-file=staging.tfvars   # expect NO changes (clean adoption)
```

A clean `plan` (no destroy/recreate) on **both** states confirms the split worked.
