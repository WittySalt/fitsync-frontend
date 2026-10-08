variable "region" {
  description = "AWS region for the provider (Route 53 and CloudFront are global)"
  type        = string
  default     = "ap-southeast-1"
}

# The hand-built prod distribution (d26vi6hikexzev.cloudfront.net). It is only
# read here, never managed.
variable "distribution_id" {
  description = "Id of the hand-built prod CloudFront distribution"
  type        = string
  default     = "E1APOLMHRQOW5Y"
}

# Public hosted zone fitsyncapp.click, owned by the backend bootstrap Terraform.
# It is only looked up here; its SES records are never touched.
variable "hosted_zone_id" {
  description = "Route 53 public hosted zone id of fitsyncapp.click (owned by backend bootstrap)"
  type        = string
  default     = "Z03373831R8G5N1TEF6LB"
}

variable "domain_name" {
  description = "Primary prod hostname, the certificate subject"
  type        = string
  default     = "fitsyncapp.click"
}

variable "alternative_names" {
  description = "Further prod hostnames on the same certificate and distribution"
  type        = list(string)
  default     = ["www.fitsyncapp.click"]
}

# Phase gate. Leave false for the first apply (certificate only). Set true only
# after attach-prod-domain.ps1 has added the aliases and certificate to the
# distribution, so DNS never points a name at a distribution that does not
# serve it. A precondition on the records enforces this.
variable "create_alias_records" {
  description = "Create the A/AAAA alias records (phase 2, after the aliases are on the distribution)"
  type        = bool
  default     = false
}
