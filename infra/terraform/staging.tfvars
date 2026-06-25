# ── STAGING — the frontend environment we run for testing ────────────────────
# Apply with:  terraform workspace select staging && terraform apply -var-file=staging.tfvars
# Resources are named fitsync-staging-frontend-* and share the AWS account with
# the backend staging infra, but live in a SEPARATE Terraform state.

region = "ap-southeast-1"
env    = "staging"

# CloudFront stands up the HTTPS SPA distribution for the staging demo. It is
# required for Cognito hosted login (Cognito only accepts HTTPS callback URLs)
# and proxies /api/* to the staging backend gateway. `terraform destroy` after
# the demo to stop the (tiny) bill.
enable_cloudfront = true

# Staging backend gateway (EC2 fitsync-staging-app, :8088) for the /api/* origin.
api_origin_domain = "ec2-52-221-91-77.ap-southeast-1.compute.amazonaws.com"
