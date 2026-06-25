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
