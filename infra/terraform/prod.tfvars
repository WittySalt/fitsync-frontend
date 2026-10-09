# ── PROD — https://fitsyncapp.click, www, and d26vi6hikexzev.cloudfront.net ──
# Apply with:  terraform workspace select prod && terraform apply -var-file=prod.tfvars
# The distribution, bucket, OAC, function, certificate and DNS records were built
# by hand (the domain pieces by the old infra/terraform-prod-domain root) and are
# ADOPTED by the import blocks in imports.tf. Follow RUNBOOK.md, "Prod: adopt the
# hand-built frontend", for the first apply. Nothing here may be recreated: a new
# distribution gets a new *.cloudfront.net name, and the bucket holds the live site.

region            = "ap-southeast-1"
env               = "prod"
enable_cloudfront = true

# Live names, kept as they were built.
bucket_name          = "fitsync-frontend-prod"
distribution_comment = "FitSync frontend - S3 static + EC2 /api proxy"

# Private bucket read through an Origin Access Control (staging uses the public
# website endpoint instead).
s3_origin_type  = "oac"
oac_name        = "fitsync-frontend-oac"
oac_description = "OAC for fitsync frontend S3"

price_class  = "PriceClass_200"
ipv6_enabled = true

# Default (S3) behaviour: Managed-CachingOptimized, compressed, GET/HEAD only.
default_cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
default_compress        = true
default_allowed_methods = ["GET", "HEAD"]

# Prod backend ALB (alb_dns_name output of the backend prod stack) for /api/*.
api_origin_domain = "fitsync-prod-alb-2084536414.ap-southeast-1.elb.amazonaws.com"

# Apex plus www on one certificate; A/AAAA alias records for both.
custom_domain     = "fitsyncapp.click"
alternative_names = ["www.fitsyncapp.click"]

# One-time import of the hand-built resources (imports.tf). Harmless to keep
# after the first apply; remove it in a follow-up once prod is in state.
adopt = {
  distribution_id = "E1APOLMHRQOW5Y"
  oac_id          = "ESM4Q7D1KTNCH"
  certificate_arn = "arn:aws:acm:us-east-1:437659978621:certificate/78a6d0bd-f182-4157-8771-463c7c9c32db"
  cert_validation_records = {
    "fitsyncapp.click"     = "_6b584e9a754a1e576cbf9f52c69930f8.fitsyncapp.click"
    "www.fitsyncapp.click" = "_6fc2078ac07d00df49eb45b07f2439c7.www.fitsyncapp.click"
  }
}
