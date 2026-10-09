variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project name, used as a resource name prefix"
  type        = string
  default     = "fitsync"
}

variable "env" {
  description = "Environment name (staging / prod). Suffixes all resource names."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "prod"], var.env)
    error_message = "env must be one of: staging, prod."
  }
}

# CloudFront is slow to provision (~15-20 min). Off by default so the first apply
# is fast and free (S3 only); flip on to stand up the full SPA distribution, then
# `terraform destroy` to stop the bill. Mirrors the backend cost-flag convention.
variable "enable_cloudfront" {
  description = "Create the CloudFront distribution for the SPA (slow, ~15-20 min)"
  type        = bool
  default     = false
}

# Backend gateway host that CloudFront proxies /api/* to, so the SPA can use
# same-origin relative /api calls over HTTPS (mirrors prod's hand-built dist).
# Empty = no /api behavior (SPA-only distribution). Set to the env's EC2 gateway
# public DNS, e.g. ec2-52-221-91-77.ap-southeast-1.compute.amazonaws.com.
variable "api_origin_port" {
  description = "HTTP port of the /api/* origin (80 for the backend ALB)"
  type        = number
  default     = 80
}

variable "api_origin_domain" {
  description = "Backend ALB DNS (alb_dns_name output) for the CloudFront /api/* origin (empty = SPA only)"
  type        = string
  default     = ""
}

# Custom hostname for the SPA, e.g. staging.fitsyncapp.click. Empty = none: no
# certificate, no DNS records, and the distribution keeps the default
# *.cloudfront.net certificate. The *.cloudfront.net hostname keeps working
# either way. Needs enable_cloudfront = true.
variable "custom_domain" {
  description = "Custom hostname for the SPA distribution (empty = none)"
  type        = string
  default     = ""
}

# Public hosted zone that holds custom_domain. The zone is created and owned by
# the BACKEND bootstrap Terraform; this stack only looks it up and adds records.
variable "hosted_zone_name" {
  description = "Route 53 public hosted zone containing custom_domain (owned by backend bootstrap)"
  type        = string
  default     = "fitsyncapp.click"
}

# Further hostnames on the same certificate and distribution, e.g. www for prod.
variable "alternative_names" {
  description = "Extra hostnames for the certificate (SANs), the aliases and the DNS records"
  type        = list(string)
  default     = []
}

# ── Settings where the hand-built prod distribution differs from staging ─────
# Defaults are staging's values, so staging.tfvars does not need to set them.

variable "bucket_name" {
  description = "SPA bucket name (empty = <project>-<env>-frontend-<account id>)"
  type        = string
  default     = ""
}

variable "s3_origin_type" {
  description = "How CloudFront reads the bucket: website (public website endpoint) or oac (private bucket, Origin Access Control)"
  type        = string
  default     = "website"

  validation {
    condition     = contains(["website", "oac"], var.s3_origin_type)
    error_message = "s3_origin_type must be website or oac."
  }
}

variable "oac_name" {
  description = "Name of the Origin Access Control when s3_origin_type = oac (empty = <project>-<env>-frontend-oac)"
  type        = string
  default     = ""
}

variable "oac_description" {
  description = "Description of the Origin Access Control"
  type        = string
  default     = "OAC for the FitSync frontend bucket"
}

variable "distribution_comment" {
  description = "CloudFront comment (empty = <project>-<env>-frontend)"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_All"
}

variable "ipv6_enabled" {
  description = "Answer on IPv6 at the edge"
  type        = bool
  default     = false
}

variable "default_cache_policy_id" {
  description = "Cache policy on the default (S3) behaviour (empty = legacy forwarded_values, no query string or cookies)"
  type        = string
  default     = ""
}

variable "default_compress" {
  description = "Compress responses on the default (S3) behaviour"
  type        = bool
  default     = false
}

variable "default_allowed_methods" {
  description = "Allowed methods on the default (S3) behaviour"
  type        = list(string)
  default     = ["GET", "HEAD", "OPTIONS"]
}

# ── One-time adoption of hand-built resources (imports.tf) ───────────────────
# null = import nothing (staging). Set only in prod.tfvars, for the import apply.
variable "adopt" {
  description = "Ids of existing resources to import into this workspace (null = none)"
  type = object({
    distribution_id         = string
    oac_id                  = string
    certificate_arn         = string
    cert_validation_records = map(string) # hostname => validation CNAME name
  })
  default = null
}

# ── Content-Security-Policy (security_headers.tf) ────────────────────────────
# The backend's media bucket (its media_public_base_url output): exercise images,
# exercise videos and avatars. The only CSP source that differs per environment.
variable "csp_media_origin" {
  description = "Origin of the media bucket allowed in img-src and media-src, e.g. https://<bucket>.s3.<region>.amazonaws.com (empty = none)"
  type        = string
  default     = ""

  validation {
    condition     = var.csp_media_origin == "" || can(regex("^https://[a-z0-9.-]+$", var.csp_media_origin))
    error_message = "csp_media_origin must be an https origin with no path, e.g. https://fitsync-media.s3.ap-southeast-1.amazonaws.com."
  }
}
