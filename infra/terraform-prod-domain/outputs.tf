output "certificate_arn" {
  description = "Validated ACM certificate (us-east-1) to attach to the prod distribution"
  value       = aws_acm_certificate_validation.prod.certificate_arn
}

output "hostnames" {
  description = "Hostnames covered by the certificate"
  value       = local.hostnames
}

output "distribution_domain" {
  description = "The hand-built prod distribution the alias records point at"
  value       = data.aws_cloudfront_distribution.prod.domain_name
}

output "distribution_aliases" {
  description = "Aliases currently on the distribution (empty until the attach step)"
  value       = data.aws_cloudfront_distribution.prod.aliases
}

output "alias_records" {
  description = "Alias records managed here (empty in phase 1)"
  value       = [for r in aws_route53_record.alias : "${r.name} ${r.type}"]
}
