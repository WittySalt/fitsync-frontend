# ── STAGING — the frontend environment we run for testing ────────────────────
# Apply with:  terraform workspace select staging && terraform apply -var-file=staging.tfvars
# Resources are named fitsync-staging-frontend-* and share the AWS account with
# the backend staging infra, but live in a SEPARATE Terraform state.

region = "ap-southeast-1"
env    = "staging"

# Flip to true to stand up the SPA CloudFront for an end-to-end staging demo,
# then `terraform destroy` to stop the bill. The S3 bucket alone is near-free.
enable_cloudfront = false
