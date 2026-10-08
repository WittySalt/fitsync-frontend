# ── STAGING — the frontend environment we run for testing ────────────────────
# Apply with:  terraform workspace select staging && terraform apply -var-file=staging.tfvars
# Resources are named fitsync-staging-frontend-* and share the AWS account with
# the backend staging infra, but live in a SEPARATE Terraform state.

region = "ap-southeast-1"
env    = "staging"

# CloudFront stands up the HTTPS SPA distribution for the staging demo. It is
# required for Cognito hosted login (Cognito only accepts HTTPS callback URLs)
# and proxies /api/* to the staging backend ALB. `terraform destroy` after
# the demo to stop the (tiny) bill.
enable_cloudfront = true

# Staging backend ALB (alb_dns_name output of the backend staging stack) for /api/*.
api_origin_domain = "fitsync-staging-alb-489104795.ap-southeast-1.elb.amazonaws.com"

# Custom hostname: ACM cert (us-east-1) + DNS validation + A/AAAA aliases in the
# fitsyncapp.click zone (zone owned by the backend bootstrap Terraform). The old
# d1z92tpb353lfi.cloudfront.net hostname keeps working.
custom_domain = "staging.fitsyncapp.click"
