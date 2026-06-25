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
variable "api_origin_domain" {
  description = "EC2 gateway DNS for the CloudFront /api/* origin (empty = SPA only)"
  type        = string
  default     = ""
}
