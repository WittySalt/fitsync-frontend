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
