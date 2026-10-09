# Frontend infrastructure (Terraform)

Owns the **frontend** AWS resources only: the SPA S3 bucket, its CloudFront
distribution, and the custom domain's certificate and DNS records. Backend infra (VPC, ALB, EC2, RDS, ECR, Cognito, media S3) stays in
the backend repo's `infra/terraform/`. Separate state ⇒ separate blast radius.

| | |
|---|---|
| State | `s3://fitsync-tfstate-437659978621/env:/<workspace>/fitsync/frontend/terraform.tfstate` |
| Workspaces | `staging` (`staging.tfvars`), `prod` (`prod.tfvars`, adopted from the hand-built prod; see "Prod" below) |
| Shared (not owned here) | **Cognito** lives in the backend state; the SPA only *references* the pool/client IDs, which are set per environment in `src/app/core/auth/auth.config.ts`. The `/api/*` CloudFront origin is the backend **ALB** (`api_origin_domain`, the backend's `alb_dns_name` output; `api_origin_port`, default 80; 60 s read timeout so the streamed coach answer is not cut off at CloudFront's 30 s default). These are plain variables, so there is no hard cross-stack dependency. |

## Normal use (staging)

Staging frontend infrastructure is applied by an operator from their own
machine, plan then apply, the same way as prod. CD does not run Terraform.

```bash
cd infra/terraform
terraform init
terraform workspace select staging || terraform workspace new staging
terraform plan  -var-file=staging.tfvars -out=staging.tfplan
# read the plan; stop on any destroy or replacement you did not expect
terraform apply staging.tfplan
# … demo …
terraform destroy -var-file=staging.tfvars   # stop the bill (CloudFront esp.)
```

`enable_cloudfront=false` keeps it to the (near-free) S3 bucket; flip to `true`
for the full SPA distribution.

### What the CD workflow does

CD (Actions → CD → Run workflow on `main`) has no infrastructure action for
either environment. It builds the SPA once, deploys it to staging and
smoke-tests the staging site; ticking `deploy_prod` then promotes that same
artifact to production in the same run. Every run first passes `ci-gate`: the
commit must be on `main` with a successful CI push run. Production is skipped
unless the staging deploy and its blocking smoke test passed in that run, or
`skip_staging` is ticked with a `skip_reason`, which is recorded in the run
summary. The full rules are in
[`.github/CICD-VARIABLES.md`](../../.github/CICD-VARIABLES.md).

Both deploys only sync the build to the bucket and invalidate the distribution,
so the CD role needs no Terraform, state or CloudFront configuration rights
(the exact list is under "IAM for CD" in `CICD-VARIABLES.md`). The prod deploy
reads `S3_BUCKET_PROD`
(`fitsync-frontend-prod`) and `CLOUDFRONT_DISTRIBUTION_ID` (`E1APOLMHRQOW5Y`),
which stay the same after prod is adopted into Terraform.

The `.tf` and `.tfvars` files are kept LF by `.gitattributes`. With
`core.autocrlf=true`, a Windows checkout would otherwise turn the CloudFront
function's heredoc into CRLF, and plan would then rewrite the live function.

## Custom domain (staging.fitsyncapp.click)

Staging is served at **https://staging.fitsyncapp.click**. The old
https://d1z92tpb353lfi.cloudfront.net keeps working, because CloudFront always
answers on its own `*.cloudfront.net` name as well as its aliases.

Set by `custom_domain` in `staging.tfvars` (empty = nothing is created). Further
names on the same certificate come from `alternative_names` (prod sets `www`). `domain.tf` then creates:

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

## Prod (fitsyncapp.click, www.fitsyncapp.click)

Prod serves on **https://fitsyncapp.click**, **https://www.fitsyncapp.click** and
the distribution's own name **https://d26vi6hikexzev.cloudfront.net**. It runs
from the same code as staging, in workspace `prod`, with `prod.tfvars`.

The settings where prod differs from staging are variables whose defaults are
staging's values, so `staging.tfvars` does not set them:

| Variable | Staging (default) | Prod |
|---|---|---|
| `bucket_name` | `fitsync-staging-frontend-<account>` | `fitsync-frontend-prod` |
| `s3_origin_type` | `website`: public-read bucket, S3 website endpoint as a custom origin | `oac`: private bucket (all public access blocked), S3 REST endpoint, Origin Access Control `fitsync-frontend-oac`, bucket policy that lets only this distribution read |
| `default_cache_policy_id` | empty: legacy `forwarded_values` | Managed-CachingOptimized |
| `default_compress` | `false` | `true` |
| `default_allowed_methods` | GET, HEAD, OPTIONS | GET, HEAD |
| `price_class` | `PriceClass_All` | `PriceClass_200` |
| `ipv6_enabled` | `false` | `true` |
| `distribution_comment` | `fitsync-staging-frontend` | the hand-built comment |
| `alternative_names` | none | `www.fitsyncapp.click` (certificate SAN, alias, A/AAAA records) |

The `/api/*` behaviour (CachingDisabled, AllViewer, ALB on port 80, 60 s read
timeout) and the `<env>-spa-fallback` viewer-request function are the same in
both. Neither environment has custom error responses or access logging.

The edge forwards only /api/*. /actuator is not exposed; the ALB health-checks the gateway inside the VPC.

**Never `terraform destroy` the prod workspace.** It would delete the live site,
and a new distribution gets a new `*.cloudfront.net` name. (Staging is destroyed
after demos, so the code cannot carry `prevent_destroy`.)

### One-time adoption of the hand-built prod frontend

Prod was built by hand: the distribution `E1APOLMHRQOW5Y`, the bucket, the OAC
and the function with the AWS CLI, and the certificate, its two validation
records and the four A/AAAA alias records by a separate root,
`infra/terraform-prod-domain` (state key `fitsync/frontend-prod-domain/terraform.tfstate`).
That root and its `attach-prod-domain.ps1` are deleted by the PR that adds this
section; their job is done.

`imports.tf` adopts all of it into the `prod` workspace. Import blocks cannot be
tied to a workspace, so each one has a `for_each` over a map that is empty unless
`var.adopt` is set, and only `prod.tfvars` sets it. Staging plans them as nothing.

The domain resources are adopted with **import here, then `state rm` in the old
root**, not `terraform state mv`: `state mv` across two S3 backends means pulling,
editing and pushing state files by hand, while import plus `state rm` only touches
state through Terraform and never deletes anything. Between the two steps both
states list the same records; that is safe as long as nobody runs `apply` or
`destroy` in the old root, which is why the old root is cleaned up right after.

Expected prod plan (checked on 2026-10-09 against the live resources):

```
Plan: 13 to import, 1 to add, 6 to change, 0 to destroy.
```

| Resource | Action | Why it is safe |
|---|---|---|
| bucket, public access block, bucket policy, OAC, 4 alias records | import, no change | live values match the code |
| `aws_s3_bucket.frontend` | import + tags | adds the default tags (the bucket has none); `force_destroy = false` is state only |
| `aws_cloudfront_distribution.frontend[0]` | import + tags | tags only; the provider tags the distribution without an `UpdateDistribution`, so nothing redeploys |
| `aws_cloudfront_function.spa_fallback[0]` | import + `publish = true` | republishes the same code (DEVELOPMENT and LIVE are identical) |
| `aws_acm_certificate.frontend[0]` | import + tags | tag `Component` changes from `frontend-domain` to `frontend` |
| 2 certificate validation records | import + `allow_overwrite = true` | state only; the record values do not change |
| `aws_acm_certificate_validation.frontend[0]` | create | has no import; it only waits until the certificate is `ISSUED`, which it already is |

Anything else in the plan, above all a `destroy`, `must be replaced` or a change to
`origin`, `aliases` or `viewer_certificate`, means the live config has drifted:
stop and do not apply.

#### Before you start

- Run this by hand from your machine; CD runs no Terraform. Merging the PR
  first is safe: nothing touches prod until you apply the `prod` workspace.
- Credentials for account 437659978621 with S3, CloudFront, ACM (us-east-1) and
  Route 53 rights.
- Save the live distribution config, for the record and for the rollback:
  ```powershell
  aws cloudfront get-distribution-config --id E1APOLMHRQOW5Y > prod-dist-before.json
  ```
- The old-root steps need a checkout that still has `infra/terraform-prod-domain`.
  From the repo root, add one at the base of this PR (any commit before the
  merge works; on `main` after the merge the folder is gone):
  ```powershell
  git worktree add ..\frontend-old-domain 3ed6c6a
  ```

#### Apply sequence

```powershell
# 1. The old root must show no changes, so nothing there is pending.
cd <repo>\..\frontend-old-domain\infra\terraform-prod-domain
terraform init
terraform plan -var-file="prod.tfvars"          # expect: No changes

# 2. Adopt everything into the prod workspace.
cd <repo>\infra\terraform
terraform init
terraform workspace select prod 2>$null; if (-not $?) { terraform workspace new prod }
terraform plan -var-file="prod.tfvars" "-out=prod-adopt.tfplan"
#    Check: 13 to import, 1 to add, 6 to change, 0 to destroy, and only the diffs
#    in the table above.
terraform apply prod-adopt.tfplan

# 3. Prod is now in this state; a second plan must be clean.
terraform plan -var-file="prod.tfvars"          # expect: No changes

# 4. Drop the domain resources from the OLD state. state rm forgets them;
#    it does not touch AWS.
cd <repo>\..\frontend-old-domain\infra\terraform-prod-domain
terraform state rm `
  aws_acm_certificate.prod `
  aws_acm_certificate_validation.prod `
  'aws_route53_record.cert_validation[\"fitsyncapp.click\"]' `
  'aws_route53_record.cert_validation[\"www.fitsyncapp.click\"]' `
  'aws_route53_record.alias[\"fitsyncapp.click/A\"]' `
  'aws_route53_record.alias[\"fitsyncapp.click/AAAA\"]' `
  'aws_route53_record.alias[\"www.fitsyncapp.click/A\"]' `
  'aws_route53_record.alias[\"www.fitsyncapp.click/AAAA\"]'
terraform state list                            # expect only the two data sources

# 5. Remove the old checkout.
cd <repo>
git worktree remove ..\frontend-old-domain
```

In Windows PowerShell 5.1 the inner quotes of a resource address have to be
escaped as `\"` inside single quotes, as above; in bash use
`'aws_route53_record.alias["fitsyncapp.click/A"]'`.

The old state object, `fitsync/frontend-prod-domain/terraform.tfstate` in the
tfstate bucket, then holds no resources. It can stay; deleting it is optional.

After the PR is merged, `adopt` in `prod.tfvars` can be removed in a follow-up
(the import blocks are no-ops once the resources are in state, so keeping it is
harmless too).

#### Verify

```powershell
aws cloudfront get-distribution --id E1APOLMHRQOW5Y --query "Distribution.Status"   # Deployed
curl.exe -sI https://fitsyncapp.click/
curl.exe -sI https://www.fitsyncapp.click/workout                                   # 200, SPA fallback
curl.exe -sI https://d26vi6hikexzev.cloudfront.net/
Resolve-DnsName fitsyncapp.click -Type A -Server 8.8.8.8
Resolve-DnsName www.fitsyncapp.click -Type AAAA -Server 8.8.8.8
```

#### Rollback

The apply only writes tags and republishes the function; everything else is state.
To undo the adoption without touching AWS:

1. **Before step 4** (the old state still owns the domain): forget everything in
   the prod workspace and the old root keeps working as before.
   ```powershell
   cd <repo>\infra\terraform
   terraform workspace select prod
   terraform state list                     # then, for every address listed:
   terraform state rm <address> ...
   ```
2. **After step 4**: do step 1, then import the domain back into the old root,
   from the old checkout (add it again as in "Before you start" if it is gone;
   Route 53 ids are `<zone>_<name>_<type>`):
   ```powershell
   $Z = 'Z03373831R8G5N1TEF6LB'
   terraform import aws_acm_certificate.prod arn:aws:acm:us-east-1:437659978621:certificate/78a6d0bd-f182-4157-8771-463c7c9c32db
   terraform import 'aws_route53_record.cert_validation[\"fitsyncapp.click\"]' "${Z}__6b584e9a754a1e576cbf9f52c69930f8.fitsyncapp.click_CNAME"
   terraform import 'aws_route53_record.cert_validation[\"www.fitsyncapp.click\"]' "${Z}__6fc2078ac07d00df49eb45b07f2439c7.www.fitsyncapp.click_CNAME"
   terraform import 'aws_route53_record.alias[\"fitsyncapp.click/A\"]' "${Z}_fitsyncapp.click_A"
   terraform import 'aws_route53_record.alias[\"fitsyncapp.click/AAAA\"]' "${Z}_fitsyncapp.click_AAAA"
   terraform import 'aws_route53_record.alias[\"www.fitsyncapp.click/A\"]' "${Z}_www.fitsyncapp.click_A"
   terraform import 'aws_route53_record.alias[\"www.fitsyncapp.click/AAAA\"]' "${Z}_www.fitsyncapp.click_AAAA"
   terraform apply -var-file="prod.tfvars"  # creates only the validation wait resource
   ```
3. **If a later prod apply changed the distribution** in a way you want to undo,
   send back the config saved in "Before you start" (strip the `ETag` wrapper,
   keep `DistributionConfig`) with
   `aws cloudfront update-distribution --id E1APOLMHRQOW5Y --if-match <current ETag> --distribution-config file://...`.

Do not run `terraform destroy` in either place as a rollback: in the prod
workspace it deletes the live site, in the old root it deletes the certificate
and the DNS records.

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
