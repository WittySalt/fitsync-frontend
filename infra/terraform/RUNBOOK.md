# Frontend infrastructure (Terraform)

Owns the **frontend** AWS resources only — the SPA S3 bucket and its CloudFront
distribution. Backend infra (VPC, EC2, RDS, ECR, Cognito, media S3) stays in
`backend/infra/terraform/`. Separate state ⇒ separate blast radius.

| | |
|---|---|
| State | `s3://fitsync-tfstate-437659978621/env:/<workspace>/fitsync/frontend/terraform.tfstate` |
| Workspaces | `staging` (run now), `prod` (reserved — prod FE is hand-built) |
| Shared (not owned here) | **Cognito** lives in the backend state; the SPA only *references* the pool/client IDs via CI build config. The `/api` CloudFront origin points at the backend gateway via a variable — no hard cross-stack dependency. |

## Normal use (staging)

```bash
cd frontend/infra/terraform
terraform init
terraform workspace select staging || terraform workspace new staging
terraform plan  -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
# … demo …
terraform destroy -var-file=staging.tfvars   # stop the bill (CloudFront esp.)
```

`enable_cloudfront=false` keeps it to the (near-free) S3 bucket; flip to `true`
for the full SPA distribution.

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
   cd frontend/infra/terraform
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

## One-time state migration (split out of backend state)

These four resources currently live in the **backend** staging state and must be
moved here **once**. CloudFront is not yet created in staging (`enable_cloudfront`
was false), so only the S3 resources move. Do the backend `state rm` and the
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
cd frontend/infra/terraform
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
