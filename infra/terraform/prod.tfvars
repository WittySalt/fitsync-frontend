# ── PROD — reserved interface (not applied yet) ──────────────────────────────
# Production frontend (S3 + CloudFront d26vi6hikexzev.cloudfront.net, which also
# proxies /api to the backend gateway) is currently hand-built and NOT managed by
# Terraform. Cut-over (terraform import of the existing prod bucket/distribution)
# is post-defense; until then do NOT `apply` this workspace against prod.

region            = "ap-southeast-1"
env               = "prod"
enable_cloudfront = true

# No custom domain from this stack: prod is hand-built (see above). Leave empty.
# The prod domain (fitsyncapp.click, www) lives in ../terraform-prod-domain.
custom_domain = ""
