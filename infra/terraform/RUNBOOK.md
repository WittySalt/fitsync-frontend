# Frontend infrastructure (Terraform)

Owns the **frontend** AWS resources only — the SPA S3 bucket and its CloudFront
distribution. Backend infra (VPC, ALB, EC2, RDS, ECR, Cognito, media S3) stays in
the backend repo's `infra/terraform/`. Separate state ⇒ separate blast radius.

| | |
|---|---|
| State | `s3://fitsync-tfstate-437659978621/env:/<workspace>/fitsync/frontend/terraform.tfstate` |
| Workspaces | `staging` (run now), `prod` (reserved — prod FE is hand-built) |
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
